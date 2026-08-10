<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useCarrerasUniacc, type CarreraOperativaInput } from '@/composables/useCarrerasUniacc'
import type { CarreraUniacc } from '@/types/carrera'

const { loading, fetchCarreras, createCarrera, updateCarrera, deleteCarrera } = useCarrerasUniacc()

const rows = ref<CarreraUniacc[]>([])
const loadError = ref<string | null>(null)
const saving = ref(false)
const dialogOpen = ref(false)
const editing = ref<CarreraUniacc | null>(null)
const busqueda = ref('')
const filtroFacultad = ref('')
const filtroNivel = ref('')
const filtroModalidad = ref('')

const facultadesDisponibles = computed(() =>
  [...new Set(rows.value.map((r) => r.facultad?.trim()).filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b),
  ),
)

const nivelesDisponibles = computed(() =>
  [...new Set(rows.value.map((r) => r.nivel_academico?.trim()).filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b),
  ),
)

const modalidadesDisponibles = computed(() =>
  [...new Set(rows.value.map((r) => r.modalidad_programa?.trim()).filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b),
  ),
)

const form = ref<CarreraOperativaInput>({
  anio: new Date().getFullYear(),
  codigo_carrera: '',
  nombre_programa: '',
  nivel_academico: '',
  modalidad_programa: '',
  duracion_programa: '',
  facultad: '',
  matricula: 0,
  arancel: 0,
  arancel_referencia: 0,
  anio_arancel_referencia: new Date().getFullYear(),
  version_simulador: 1,
})

const rowsFiltradas = computed(() => {
  const q = busqueda.value.trim().toLowerCase()

  return rows.value.filter((r) => {
    const coincideBusqueda =
      q.length === 0 ||
      r.nombre_programa.toLowerCase().includes(q) ||
      (r.codigo_carrera ?? '').toLowerCase().includes(q) ||
      r.facultad.toLowerCase().includes(q) ||
      String(r.anio).includes(q)

    const coincideFacultad =
      !filtroFacultad.value || (r.facultad ?? '').trim().toLowerCase() === filtroFacultad.value.toLowerCase()
    const coincideNivel =
      !filtroNivel.value || (r.nivel_academico ?? '').trim().toLowerCase() === filtroNivel.value.toLowerCase()
    const coincideModalidad =
      !filtroModalidad.value || (r.modalidad_programa ?? '').trim().toLowerCase() === filtroModalidad.value.toLowerCase()

    return coincideBusqueda && coincideFacultad && coincideNivel && coincideModalidad
  })
})

function resetForm() {
  editing.value = null
  form.value = {
    anio: new Date().getFullYear(),
    codigo_carrera: '',
    nombre_programa: '',
    nivel_academico: '',
    modalidad_programa: '',
    duracion_programa: '',
    facultad: '',
    matricula: 0,
    arancel: 0,
    arancel_referencia: 0,
    anio_arancel_referencia: new Date().getFullYear(),
    version_simulador: 1,
  }
}

function openCreate() {
  resetForm()
  dialogOpen.value = true
}

function openEdit(row: CarreraUniacc) {
  editing.value = row
  form.value = {
    anio: row.anio,
    codigo_carrera: row.codigo_carrera ?? '',
    nombre_programa: row.nombre_programa,
    nivel_academico: row.nivel_academico ?? '',
    modalidad_programa: row.modalidad_programa ?? '',
    duracion_programa: row.duracion_programa,
    facultad: row.facultad,
    matricula: row.matricula,
    arancel: row.arancel,
    arancel_referencia: row.arancel_referencia,
    anio_arancel_referencia: row.anio_arancel_referencia,
    version_simulador: row.version_simulador,
  }
  dialogOpen.value = true
}

watch(dialogOpen, (open) => {
  if (!open) resetForm()
})

async function load() {
  loadError.value = null
  const response = await fetchCarreras()
  if (response.error) {
    loadError.value = response.error.message
    rows.value = []
    return
  }
  rows.value = response.data
}

function validarFormulario(): boolean {
  if (!form.value.nombre_programa.trim()) {
    toast.error('El nombre del programa es obligatorio.')
    return false
  }
  if (!form.value.duracion_programa.trim()) {
    toast.error('La duración es obligatoria.')
    return false
  }
  if (!form.value.facultad.trim()) {
    toast.error('La facultad es obligatoria.')
    return false
  }
  return true
}

async function onSubmit() {
  if (!validarFormulario()) return
  saving.value = true
  try {
    if (editing.value) {
      const result = await updateCarrera(editing.value.id, form.value)
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success('Carrera actualizada.')
    } else {
      const result = await createCarrera(form.value)
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success('Carrera creada.')
    }
    dialogOpen.value = false
    await load()
  } finally {
    saving.value = false
  }
}

async function onDelete(row: CarreraUniacc) {
  if (!window.confirm(`¿Eliminar la carrera "${row.nombre_programa}"?`)) return
  saving.value = true
  try {
    const result = await deleteCarrera(row.id)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success('Carrera eliminada.')
    await load()
  } finally {
    saving.value = false
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(
    value || 0,
  )
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Mantenedor de carreras del simulador</CardTitle>
          <CardDescription class="text-zinc-600">
            Acá puedes modificar los campos operativos de las carreras del simulador.
          </CardDescription>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button type="button" class="gap-1.5 bg-uniacc-orange hover:bg-uniacc-orange/90" @click="openCreate">
            <Plus class="h-4 w-4" />
            Nueva carrera
          </Button>
          <Button type="button" variant="outline" class="gap-1.5" :disabled="loading" @click="load()">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label for="buscar-carrera" class="mb-2 block">Buscar</Label>
            <Input
              id="buscar-carrera"
              v-model="busqueda"
              placeholder="Nombre, código, facultad o año"
              autocomplete="off"
            />
          </div>
          <div>
            <Label for="filtro-facultad" class="mb-2 block">Facultad</Label>
            <select
              id="filtro-facultad"
              v-model="filtroFacultad"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todas</option>
              <option v-for="facultad in facultadesDisponibles" :key="facultad" :value="facultad">
                {{ facultad }}
              </option>
            </select>
          </div>
          <div>
            <Label for="filtro-nivel" class="mb-2 block">Nivel</Label>
            <select
              id="filtro-nivel"
              v-model="filtroNivel"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              <option v-for="nivel in nivelesDisponibles" :key="nivel" :value="nivel">
                {{ nivel }}
              </option>
            </select>
          </div>
          <div>
            <Label for="filtro-modalidad" class="mb-2 block">Modalidad</Label>
            <select
              id="filtro-modalidad"
              v-model="filtroModalidad"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todas</option>
              <option v-for="modalidad in modalidadesDisponibles" :key="modalidad" :value="modalidad">
                {{ modalidad }}
              </option>
            </select>
          </div>
        </div>

        <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>
        <div v-else class="rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Año</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Programa</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Facultad</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Arancel</TableHead>
                <TableHead>Versión</TableHead>
                <TableHead class="w-[110px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in rowsFiltradas" :key="row.id">
                <TableCell>{{ row.anio }}</TableCell>
                <TableCell class="font-mono text-xs">{{ row.codigo_carrera || '—' }}</TableCell>
                <TableCell class="font-medium">{{ row.nombre_programa }}</TableCell>
                <TableCell>{{ row.nivel_academico || '—' }}</TableCell>
                <TableCell>{{ row.modalidad_programa || '—' }}</TableCell>
                <TableCell>{{ row.facultad }}</TableCell>
                <TableCell>{{ formatCurrency(row.matricula) }}</TableCell>
                <TableCell>{{ formatCurrency(row.arancel) }}</TableCell>
                <TableCell>{{ row.version_simulador }}</TableCell>
                <TableCell class="text-right">
                  <Button variant="ghost" size="icon" class="h-8 w-8" title="Editar" @click="openEdit(row)">
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8 text-red-600"
                    title="Eliminar"
                    :disabled="saving"
                    @click="onDelete(row)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow v-if="!loading && rowsFiltradas.length === 0">
                <TableCell colspan="10" class="py-8 text-center text-sm text-zinc-500">
                  No se encontraron carreras.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{{ editing ? 'Editar carrera' : 'Nueva carrera' }}</DialogTitle>
          <DialogDescription>
            Gestión de campos operativos del simulador. Los textos extensos no se editan en esta pantalla.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-2 md:grid-cols-2">
          <div class="grid gap-2">
            <Label for="c-anio">Año</Label>
            <Input id="c-anio" v-model.number="form.anio" type="number" min="2000" max="2100" />
          </div>
          <div class="grid gap-2">
            <Label for="c-codigo">Código carrera</Label>
            <Input id="c-codigo" v-model="form.codigo_carrera" autocomplete="off" />
          </div>
          <div class="grid gap-2 md:col-span-2">
            <Label for="c-nombre">Nombre programa</Label>
            <Input id="c-nombre" v-model="form.nombre_programa" autocomplete="off" />
          </div>
          <div class="grid gap-2">
            <Label for="c-nivel">Nivel académico</Label>
            <Input id="c-nivel" v-model="form.nivel_academico" autocomplete="off" />
          </div>
          <div class="grid gap-2">
            <Label for="c-modalidad">Modalidad</Label>
            <Input id="c-modalidad" v-model="form.modalidad_programa" autocomplete="off" />
          </div>
          <div class="grid gap-2">
            <Label for="c-duracion">Duración</Label>
            <Input id="c-duracion" v-model="form.duracion_programa" autocomplete="off" />
          </div>
          <div class="grid gap-2">
            <Label for="c-facultad">Facultad</Label>
            <Input id="c-facultad" v-model="form.facultad" autocomplete="off" />
          </div>
          <div class="grid gap-2">
            <Label for="c-matricula">Matrícula</Label>
            <Input id="c-matricula" v-model.number="form.matricula" type="number" min="0" />
          </div>
          <div class="grid gap-2">
            <Label for="c-arancel">Arancel</Label>
            <Input id="c-arancel" v-model.number="form.arancel" type="number" min="0" />
          </div>
          <div class="grid gap-2">
            <Label for="c-arancel-ref">Arancel referencia</Label>
            <Input id="c-arancel-ref" v-model.number="form.arancel_referencia" type="number" min="0" />
          </div>
          <div class="grid gap-2">
            <Label for="c-anio-ref">Año arancel referencia</Label>
            <Input id="c-anio-ref" v-model.number="form.anio_arancel_referencia" type="number" min="2000" max="2100" />
          </div>
          <div class="grid gap-2">
            <Label for="c-version">Versión simulador</Label>
            <Input id="c-version" v-model.number="form.version_simulador" type="number" min="1" />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" @click="dialogOpen = false">Cancelar</Button>
          <Button type="button" class="bg-uniacc-orange hover:bg-uniacc-orange/90" :disabled="saving" @click="onSubmit">
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
