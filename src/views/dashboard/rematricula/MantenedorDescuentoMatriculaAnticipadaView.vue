<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next'

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DESCUENTO_MATRICULA_APLICABLE,
  DESCUENTO_MATRICULA_APLICABLE_FILTRO_TODOS,
  DESCUENTO_MATRICULA_APLICABLE_LABEL,
  type DescuentoMatriculaAplicable,
} from '@/constants/descuentoMatriculaAnticipada'
import {
  fmtFechaCalendario,
  fmtMontoDescuento,
  toInputFechaCalendario,
  type DescuentoMatriculaAnticipadaInput,
} from '@/services/descuentoMatriculaAnticipada'
import { useDescuentoMatriculaAnticipadaStore } from '@/stores/descuentoMatriculaAnticipada'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type { TpMnpDescuentoMatriculaAnticipadaRow } from '@/types/supabase'

const store = useDescuentoMatriculaAnticipadaStore()
const periodoStore = usePeriodoActivoStore()
const {
  rowsFiltradas,
  loading,
  saving,
  error: loadError,
  total,
  totalFiltrado,
  filtros,
} = storeToRefs(store)
const { label: periodoActivoLabel } = storeToRefs(periodoStore)

const dialogOpen = ref(false)
const deleteOpen = ref(false)
const editingId = ref<number | null>(null)
const pendingDelete = ref<TpMnpDescuentoMatriculaAnticipadaRow | null>(null)

const form = ref<DescuentoMatriculaAnticipadaInput>(blankForm())

const periodoOpciones = computed(() => {
  const set = new Set<string>()
  for (const r of store.rows) set.add(r.periodo)
  if (periodoActivoLabel.value) set.add(periodoActivoLabel.value)
  set.add('2027-1')
  set.add('2026-2')
  return [...set].sort().reverse()
})

function blankForm(): DescuentoMatriculaAnticipadaInput {
  return {
    cod_beneficio: 0,
    nombre: '',
    periodo: periodoActivoLabel.value ?? '2027-1',
    vigencia_desde: '',
    vigencia_hasta: '',
    reserva_hasta: null,
    aplicable_a: 'MATRICULA',
    monto_descuento: 0,
    activo: true,
  }
}

function openCreate() {
  editingId.value = null
  form.value = blankForm()
  dialogOpen.value = true
}

function openEdit(row: TpMnpDescuentoMatriculaAnticipadaRow) {
  editingId.value = row.id
  form.value = {
    cod_beneficio: row.cod_beneficio,
    nombre: row.nombre,
    periodo: row.periodo,
    vigencia_desde: toInputFechaCalendario(row.vigencia_desde),
    vigencia_hasta: toInputFechaCalendario(row.vigencia_hasta),
    reserva_hasta: toInputFechaCalendario(row.reserva_hasta) || null,
    aplicable_a: row.aplicable_a,
    monto_descuento: Number(row.monto_descuento),
    activo: row.activo,
  }
  dialogOpen.value = true
}

function openDeleteConfirm(row: TpMnpDescuentoMatriculaAnticipadaRow) {
  pendingDelete.value = row
  deleteOpen.value = true
}

async function saveForm() {
  const payload = { ...form.value }
  const result = editingId.value
    ? await store.update(editingId.value, payload)
    : await store.create(payload)

  if (!result.ok) {
    toast.error(result.error ?? 'No se pudo guardar')
    return
  }
  toast.success(editingId.value ? 'Descuento actualizado' : 'Descuento creado')
  dialogOpen.value = false
}

async function confirmDelete() {
  const row = pendingDelete.value
  if (!row) return
  const result = await store.remove(row.id)
  if (!result.ok) {
    toast.error(result.error ?? 'No se pudo eliminar')
    return
  }
  toast.success('Descuento eliminado')
  deleteOpen.value = false
  pendingDelete.value = null
}

async function recargar() {
  await store.fetchAll()
}

onMounted(() => {
  void store.ensureLoaded()
})
</script>

<template>
  <div class="mx-auto max-w-[1200px] space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Descuento de matrícula</CardTitle>
          <CardDescription class="text-zinc-600">
            Catálogo de descuentos por periodo y vigencia (Matrícula / Arancel). Acceso DVU y TI.
            Las fechas de vigencia son <span class="font-medium text-zinc-800">inclusive</span>
            (desde y hasta cuentan dentro del rango).
            Registros:
            <span class="font-semibold text-zinc-900">{{ total }}</span>
          </CardDescription>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            class="gap-1.5"
            :disabled="loading || saving"
            @click="recargar"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            Recargar
          </Button>
          <Button
            type="button"
            class="gap-1.5 bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="saving || loading"
            @click="openCreate"
          >
            <Plus class="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>

        <div class="flex flex-wrap items-end gap-3">
          <div class="relative min-w-[120px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input v-model="filtros.texto" class="pl-9" placeholder="Nombre o código beneficio" />
          </div>
          <div class="w-[120px]">
            <Input v-model="filtros.periodo" placeholder="Periodo (2027-1)" />
          </div>
          <div class="w-[140px]">
            <Select v-model="filtros.aplicable_a">
              <SelectTrigger>
                <SelectValue placeholder="Aplicable a" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="DESCUENTO_MATRICULA_APLICABLE_FILTRO_TODOS">
                  Todos
                </SelectItem>
                <SelectItem
                  v-for="a in DESCUENTO_MATRICULA_APLICABLE"
                  :key="a"
                  :value="a"
                >
                  {{ DESCUENTO_MATRICULA_APLICABLE_LABEL[a] }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex items-center gap-2 pb-2">
            <Checkbox
              id="solo-activos"
              :checked="filtros.soloActivos"
              @update:checked="(v: boolean) => (filtros.soloActivos = v)"
            />
            <Label for="solo-activos" class="cursor-pointer text-sm text-zinc-700">
              Solo activos
            </Label>
          </div>
        </div>

        <div class="overflow-x-auto rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="whitespace-nowrap">ID</TableHead>
                <TableHead class="whitespace-nowrap">Cod. beneficio</TableHead>
                <TableHead class="whitespace-nowrap">Nombre</TableHead>
                <TableHead class="whitespace-nowrap">Periodo</TableHead>
                <TableHead class="whitespace-nowrap">Vigencia desde (inc.)</TableHead>
                <TableHead class="whitespace-nowrap">Vigencia hasta (inc.)</TableHead>
                <TableHead class="whitespace-nowrap">Reservable hasta</TableHead>
                <TableHead class="whitespace-nowrap">Aplicable a</TableHead>
                <TableHead class="whitespace-nowrap text-right">Monto</TableHead>
                <TableHead class="whitespace-nowrap">Estado</TableHead>
                <TableHead class="w-[100px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading && total === 0">
                <TableCell colspan="11" class="text-center text-zinc-500">Cargando…</TableCell>
              </TableRow>
              <TableRow v-else-if="rowsFiltradas.length === 0">
                <TableCell colspan="11" class="text-center text-zinc-500">
                  Sin registros para mostrar.
                </TableCell>
              </TableRow>
              <TableRow v-for="row in rowsFiltradas" :key="row.id">
                <TableCell>{{ row.id }}</TableCell>
                <TableCell class="font-mono text-xs">{{ row.cod_beneficio }}</TableCell>
                <TableCell>{{ row.nombre }}</TableCell>
                <TableCell class="font-medium">{{ row.periodo }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">
                  {{ fmtFechaCalendario(row.vigencia_desde) }}
                </TableCell>
                <TableCell class="whitespace-nowrap text-xs">
                  {{ fmtFechaCalendario(row.vigencia_hasta) }}
                </TableCell>
                <TableCell class="whitespace-nowrap text-xs">
                  {{ fmtFechaCalendario(row.reserva_hasta) }}
                </TableCell>
                <TableCell>
                  {{ DESCUENTO_MATRICULA_APLICABLE_LABEL[row.aplicable_a] }}
                </TableCell>
                <TableCell class="text-right font-mono text-xs">
                  {{ fmtMontoDescuento(row.monto_descuento) }}
                </TableCell>
                <TableCell>
                  <Badge
                    :variant="row.activo ? 'default' : 'secondary'"
                    :class="row.activo ? 'bg-emerald-600 hover:bg-emerald-600' : ''"
                  >
                    {{ row.activo ? 'Activo' : 'Inactivo' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8"
                      :disabled="saving"
                      @click="openEdit(row)"
                    >
                      <Pencil class="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-red-600 hover:text-red-700"
                      :disabled="saving"
                      @click="openDeleteConfirm(row)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <p class="text-xs text-zinc-500">
          Mostrando {{ totalFiltrado }} de {{ total }} registros.
        </p>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ editingId ? 'Editar descuento' : 'Nuevo descuento de matrícula' }}
          </DialogTitle>
          <DialogDescription>
            Defina beneficio, periodo académico, vigencia (fechas inclusive) y el monto del descuento en pesos.
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-2">
          <div class="grid gap-2">
            <Label for="dm-cod-ben">Código beneficio</Label>
            <Input
              id="dm-cod-ben"
              v-model.number="form.cod_beneficio"
              type="number"
              min="1"
            />
          </div>
          <div class="grid gap-2">
            <Label for="dm-nombre">Nombre</Label>
            <Input id="dm-nombre" v-model="form.nombre" />
          </div>
          <div class="grid gap-2">
            <Label for="dm-periodo">Periodo (AAAA-S)</Label>
            <Input id="dm-periodo" v-model="form.periodo" list="dm-periodo-list" />
            <datalist id="dm-periodo-list">
              <option v-for="p in periodoOpciones" :key="p" :value="p" />
            </datalist>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-2">
              <Label for="dm-desde">Vigencia desde (inclusive)</Label>
              <Input id="dm-desde" v-model="form.vigencia_desde" type="date" />
            </div>
            <div class="grid gap-2">
              <Label for="dm-hasta">Vigencia hasta (inclusive)</Label>
              <Input id="dm-hasta" v-model="form.vigencia_hasta" type="date" />
            </div>
          </div>
          <div class="grid gap-2">
            <Label for="dm-reserva">Reservable hasta (opcional)</Label>
            <Input
              id="dm-reserva"
              :model-value="form.reserva_hasta ?? ''"
              type="date"
              @update:model-value="(v: string | number) => (form.reserva_hasta = String(v) || null)"
            />
            <p class="text-xs text-zinc-500">
              Si el alumno queda en espera de CAE o beca ministerial durante la vigencia, puede usar este monto hasta esta fecha.
            </p>
          </div>
          <div class="grid gap-2">
            <Label>Aplicable a</Label>
            <Select v-model="form.aplicable_a">
              <SelectTrigger>
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="a in DESCUENTO_MATRICULA_APLICABLE"
                  :key="a"
                  :value="a"
                >
                  {{ DESCUENTO_MATRICULA_APLICABLE_LABEL[a] }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label for="dm-monto">Monto descuento (pesos)</Label>
            <Input
              id="dm-monto"
              v-model.number="form.monto_descuento"
              type="number"
              min="0"
              step="1"
            />
          </div>
          <div class="flex items-center gap-2">
            <Checkbox
              id="dm-activo"
              :checked="form.activo"
              @update:checked="(v: boolean) => (form.activo = v)"
            />
            <Label for="dm-activo" class="cursor-pointer">Activo</Label>
          </div>
        </div>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" :disabled="saving" @click="dialogOpen = false">
            Cancelar
          </Button>
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

    <Dialog v-model:open="deleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar descuento</DialogTitle>
          <DialogDescription>
            ¿Eliminar el descuento
            <span v-if="pendingDelete" class="font-semibold text-zinc-900">
              «{{ pendingDelete.nombre }}» ({{ pendingDelete.periodo }})?
            </span>
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" :disabled="saving" @click="deleteOpen = false">
            Cancelar
          </Button>
          <Button type="button" variant="destructive" :disabled="saving" @click="confirmDelete">
            {{ saving ? 'Eliminando…' : 'Eliminar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
