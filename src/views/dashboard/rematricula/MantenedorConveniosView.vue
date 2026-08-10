<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { FileUp, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CONVENIO_ESTADOS,
  CONVENIO_OFERTAS,
  periodoLabel,
} from '@/constants/convenioInstitucional'
import {
  defaultDescuentos,
  type ConvenioDescuentoInput,
  type ConvenioInstitucionalCompleto,
  type ConvenioPeriodoInput,
  type ConvenioUpsertInput,
} from '@/services/convenioInstitucional'
import { useConvenioInstitucionalStore } from '@/stores/convenioInstitucional'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'

const store = useConvenioInstitucionalStore()
const periodoStore = usePeriodoActivoStore()
const {
  rowsFiltradas,
  loading,
  saving,
  importing,
  error: loadError,
  total,
  totalFiltrado,
  filtroTexto,
  filtroEstado,
  soloPeriodoActivo,
} = storeToRefs(store)
const { anio, semestre, label: periodoActivoLabel } = storeToRefs(periodoStore)

const dialogOpen = ref(false)
const importOpen = ref(false)
const editingId = ref<string | null>(null)

const form = ref<ConvenioUpsertInput>(blankForm())
const selectedPeriodKeys = ref<string[]>([])
const importPeriodKeys = ref<string[]>(['2026-2', '2027-1'])
const importFile = ref<File | null>(null)
const importPreviewCount = ref<number | null>(null)

const periodoOpciones = computed(() => {
  const set = new Set<string>(['2026-2', '2027-1'])
  for (const r of periodoStore.rows) {
    set.add(periodoLabel(r.anio_periodo, r.semestre_periodo))
  }
  if (anio.value != null && semestre.value != null) {
    set.add(periodoLabel(anio.value, semestre.value))
  }
  for (const row of store.rows) {
    for (const p of row.periodos) {
      set.add(periodoLabel(p.anio_periodo, p.semestre_periodo))
    }
  }
  return [...set].sort()
})

function blankForm(): ConvenioUpsertInput {
  return {
    codigo_beneficio: null,
    institucion: '',
    beneficiarios: null,
    estado: 'VIGENTE',
    obs_1: null,
    obs_2: null,
    concepto: 'ARANCEL',
    activo: true,
    descuentos: defaultDescuentos(),
    periodos: [],
  }
}

function keysToPeriodos(keys: string[]): ConvenioPeriodoInput[] {
  return keys
    .map((k) => {
      const [a, s] = k.split('-')
      const anioN = Number(a)
      const semN = Number(s)
      if (!Number.isFinite(anioN) || (semN !== 1 && semN !== 2)) return null
      return { anio_periodo: anioN, semestre_periodo: semN, activo: true }
    })
    .filter((p): p is ConvenioPeriodoInput => p != null)
}

function openCreate() {
  editingId.value = null
  form.value = blankForm()
  selectedPeriodKeys.value =
    anio.value != null && semestre.value != null
      ? [periodoLabel(anio.value, semestre.value)]
      : ['2026-2', '2027-1']
  dialogOpen.value = true
}

function openEdit(row: ConvenioInstitucionalCompleto) {
  editingId.value = row.id
  const descMap = new Map(row.descuentos.map((d) => [d.oferta_codigo, d]))
  form.value = {
    id: row.id,
    codigo_beneficio: row.codigo_beneficio,
    institucion: row.institucion,
    beneficiarios: row.beneficiarios,
    estado: row.estado,
    obs_1: row.obs_1,
    obs_2: row.obs_2,
    concepto: row.concepto,
    activo: row.activo,
    descuentos: CONVENIO_OFERTAS.map((o) => {
      const d = descMap.get(o.codigo)
      return {
        oferta_codigo: o.codigo,
        aplica: d?.aplica ?? false,
        porcentaje: d?.porcentaje ?? null,
      } satisfies ConvenioDescuentoInput
    }),
    periodos: [],
  }
  selectedPeriodKeys.value = row.periodos
    .filter((p) => p.activo)
    .map((p) => periodoLabel(p.anio_periodo, p.semestre_periodo))
  dialogOpen.value = true
}

function togglePeriodKey(list: string[], key: string, on: boolean) {
  if (on) {
    if (!list.includes(key)) list.push(key)
  } else {
    const i = list.indexOf(key)
    if (i >= 0) list.splice(i, 1)
  }
}

function onPorcentajeInput(d: ConvenioDescuentoInput, raw: string) {
  const n = Number(String(raw).replace(',', '.'))
  if (!Number.isFinite(n)) {
    d.porcentaje = null
    return
  }
  d.porcentaje = n > 1 ? n / 100 : n
  d.aplica = true
}

function pctDisplay(d: ConvenioDescuentoInput): string {
  if (!d.aplica || d.porcentaje == null) return ''
  return String(Math.round(d.porcentaje * 1000) / 10)
}

async function saveForm() {
  if (!form.value.institucion.trim()) {
    toast.error('La institución es obligatoria')
    return
  }
  const periodos = keysToPeriodos(selectedPeriodKeys.value)
  if (periodos.length === 0) {
    toast.error('Seleccione al menos un periodo de vigencia')
    return
  }
  for (const d of form.value.descuentos) {
    if (d.aplica && (d.porcentaje == null || d.porcentaje < 0 || d.porcentaje > 1)) {
      toast.error(`Porcentaje inválido en ${d.oferta_codigo}`)
      return
    }
    if (!d.aplica) d.porcentaje = null
  }

  const payload: ConvenioUpsertInput = {
    ...form.value,
    id: editingId.value ?? undefined,
    periodos,
  }
  const result = await store.upsert(payload)
  if (!result.ok) {
    toast.error(result.error ?? 'No se pudo guardar')
    return
  }
  toast.success(editingId.value ? 'Convenio actualizado' : 'Convenio creado')
  dialogOpen.value = false
}

async function removeRow(row: ConvenioInstitucionalCompleto) {
  if (!confirm(`¿Desactivar convenio "${row.institucion}"?`)) return
  const result = await store.softDelete(row.id)
  if (!result.ok) {
    toast.error(result.error ?? 'No se pudo desactivar')
    return
  }
  toast.success('Convenio desactivado')
}

function onImportFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  importFile.value = input.files?.[0] ?? null
  importPreviewCount.value = null
}

async function runImport() {
  if (!importFile.value) {
    toast.error('Seleccione un archivo Excel')
    return
  }
  const periodos = keysToPeriodos(importPeriodKeys.value)
  if (periodos.length === 0) {
    toast.error('Seleccione periodos destino')
    return
  }
  const buffer = await importFile.value.arrayBuffer()
  const result = await store.importFromExcel(buffer, periodos)
  if (result.ok === 0) {
    toast.error(result.errors[0] ?? 'Importación fallida')
    return
  }
  toast.success(`Importados/actualizados: ${result.ok}`)
  if (result.errors.length) {
    toast.warning(`${result.errors.length} advertencia(s)`)
  }
  importOpen.value = false
  importFile.value = null
  importPreviewCount.value = result.ok
}

watch(
  [anio, semestre],
  ([a, s]) => {
    store.setPeriodoFiltro(a ?? null, s ?? null)
  },
  { immediate: true },
)

onMounted(async () => {
  await periodoStore.ensureLoaded()
  store.setPeriodoFiltro(anio.value ?? null, semestre.value ?? null)
  await store.ensureLoaded()
})
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Convenios</CardTitle>
          <CardDescription class="text-zinc-600">
            Catálogo institucional MNP (import Excel + CRUD). Periodo activo:
            <span class="font-semibold text-zinc-900">{{ periodoActivoLabel ?? '—' }}</span>
            · Registros: <span class="font-semibold text-zinc-900">{{ total }}</span>
          </CardDescription>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button type="button" variant="outline" class="gap-1.5" :disabled="loading" @click="store.fetchAll()">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            Recargar
          </Button>
          <Button type="button" variant="outline" class="gap-1.5" @click="importOpen = true">
            <FileUp class="h-4 w-4" />
            Importar Excel
          </Button>
          <Button type="button" class="gap-1.5 bg-uniacc-orange hover:bg-uniacc-orange/90" @click="openCreate">
            <Plus class="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>

        <div class="flex flex-wrap items-end gap-3">
          <div class="min-w-[200px] flex-1">
            <Label class="mb-1.5 block">Buscar</Label>
            <Input v-model="filtroTexto" placeholder="Institución, código, beneficiarios…" />
          </div>
          <div class="w-[160px]">
            <Label class="mb-1.5 block">Estado</Label>
            <select
              v-model="filtroEstado"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            >
              <option value="">Todos</option>
              <option v-for="e in CONVENIO_ESTADOS" :key="e" :value="e">{{ e }}</option>
            </select>
          </div>
          <label class="mb-2 flex items-center gap-2 text-sm text-zinc-700">
            <Checkbox
              :checked="soloPeriodoActivo"
              @update:checked="(v: boolean | 'indeterminate') => (soloPeriodoActivo = v === true)"
            />
            Solo periodo activo
          </label>
        </div>

        <div class="overflow-x-auto rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institución</TableHead>
                <TableHead>Cód. ERP</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Periodos</TableHead>
                <TableHead>Ofertas</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead class="w-[120px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading && total === 0">
                <TableCell colspan="7" class="text-center text-zinc-500">Cargando…</TableCell>
              </TableRow>
              <TableRow v-else-if="rowsFiltradas.length === 0">
                <TableCell colspan="7" class="text-center text-zinc-500">Sin registros.</TableCell>
              </TableRow>
              <TableRow v-for="row in rowsFiltradas" :key="row.id">
                <TableCell class="max-w-[280px] font-medium" :title="row.institucion">
                  {{ row.institucion }}
                </TableCell>
                <TableCell class="font-mono text-xs">{{ row.codigo_beneficio ?? '—' }}</TableCell>
                <TableCell>
                  <Badge :variant="row.estado === 'VIGENTE' ? 'default' : 'secondary'">
                    {{ row.estado }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div class="flex flex-wrap gap-1">
                    <Badge
                      v-for="chip in store.periodoChips(row)"
                      :key="chip"
                      variant="outline"
                      class="text-xs"
                    >
                      {{ chip }}
                    </Badge>
                    <span v-if="store.periodoChips(row).length === 0" class="text-xs text-zinc-400">—</span>
                  </div>
                </TableCell>
                <TableCell class="text-xs">{{ store.ofertasActivasCount(row) }}/8</TableCell>
                <TableCell>{{ row.activo ? 'Sí' : 'No' }}</TableCell>
                <TableCell class="text-right">
                  <Button type="button" variant="ghost" size="sm" class="gap-1" @click="openEdit(row)">
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="gap-1 text-red-600"
                    :disabled="!row.activo || saving"
                    @click="removeRow(row)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p class="text-xs text-zinc-500">Mostrando {{ totalFiltrado }} de {{ total }}.</p>
      </CardContent>
    </Card>

    <!-- Dialog crear/editar -->
    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ editingId ? 'Editar convenio' : 'Nuevo convenio' }}</DialogTitle>
          <DialogDescription>Descuentos por oferta (arancel) y periodos de vigencia.</DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-2">
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <Label class="mb-1.5 block">Institución *</Label>
              <Input v-model="form.institucion" />
            </div>
            <div>
              <Label class="mb-1.5 block">Código beneficio ERP</Label>
              <Input
                :model-value="form.codigo_beneficio ?? ''"
                placeholder="Nullable"
                @update:model-value="(v) => (form.codigo_beneficio = String(v || '') || null)"
              />
            </div>
            <div>
              <Label class="mb-1.5 block">Estado</Label>
              <select
                v-model="form.estado"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option v-for="e in CONVENIO_ESTADOS" :key="e" :value="e">{{ e }}</option>
              </select>
            </div>
            <div>
              <Label class="mb-1.5 block">Beneficiarios</Label>
              <Input
                :model-value="form.beneficiarios ?? ''"
                @update:model-value="(v) => (form.beneficiarios = String(v || '') || null)"
              />
            </div>
            <div class="sm:col-span-2">
              <Label class="mb-1.5 block">OBS 1</Label>
              <Input
                :model-value="form.obs_1 ?? ''"
                @update:model-value="(v) => (form.obs_1 = String(v || '') || null)"
              />
            </div>
            <div class="sm:col-span-2">
              <Label class="mb-1.5 block">OBS 2</Label>
              <Input
                :model-value="form.obs_2 ?? ''"
                @update:model-value="(v) => (form.obs_2 = String(v || '') || null)"
              />
            </div>
          </div>

          <div>
            <Label class="mb-2 block">Periodos vigencia</Label>
            <div class="flex flex-wrap gap-3">
              <label
                v-for="key in periodoOpciones"
                :key="key"
                class="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  :checked="selectedPeriodKeys.includes(key)"
                  @update:checked="
                    (v: boolean | 'indeterminate') => togglePeriodKey(selectedPeriodKeys, key, v === true)
                  "
                />
                {{ key }}
              </label>
            </div>
          </div>

          <div>
            <Label class="mb-2 block">Descuentos por oferta (% sobre arancel)</Label>
            <div class="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oferta</TableHead>
                    <TableHead>Aplica</TableHead>
                    <TableHead class="w-[120px]">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="d in form.descuentos" :key="d.oferta_codigo">
                    <TableCell class="text-sm">
                      {{ CONVENIO_OFERTAS.find((o) => o.codigo === d.oferta_codigo)?.label ?? d.oferta_codigo }}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        :checked="d.aplica"
                        @update:checked="
                          (v: boolean | 'indeterminate') => {
                            d.aplica = v === true
                            if (!d.aplica) d.porcentaje = null
                          }
                        "
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        :disabled="!d.aplica"
                        :model-value="pctDisplay(d)"
                        placeholder="25"
                        class="h-8"
                        @update:model-value="(v) => onPorcentajeInput(d, String(v))"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="dialogOpen = false">Cancelar</Button>
          <Button
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="saving"
            @click="saveForm"
          >
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog import -->
    <Dialog v-model:open="importOpen">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar convenios desde Excel</DialogTitle>
          <DialogDescription>
            Upsert por institución. Elija los periodos donde quedarán vigentes (p. ej. 2026-2 y 2027-1).
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div>
            <Label class="mb-1.5 block">Archivo .xlsx</Label>
            <Input type="file" accept=".xlsx,.xls,.csv" @change="onImportFileChange" />
          </div>
          <div>
            <Label class="mb-2 block">Periodos destino</Label>
            <div class="flex flex-wrap gap-3">
              <label
                v-for="key in periodoOpciones"
                :key="key"
                class="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  :checked="importPeriodKeys.includes(key)"
                  @update:checked="
                    (v: boolean | 'indeterminate') => togglePeriodKey(importPeriodKeys, key, v === true)
                  "
                />
                {{ key }}
              </label>
            </div>
          </div>
          <p v-if="importPreviewCount != null" class="text-xs text-zinc-500">
            Última importación: {{ importPreviewCount }} filas.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="importOpen = false">Cancelar</Button>
          <Button
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="importing || !importFile"
            @click="runImport"
          >
            {{ importing ? 'Importando…' : 'Importar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
