<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileDown, FileUp, RefreshCw, Search, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  bloquearTomaRamos,
  buscarDesbloqueoTomaRamos,
  desbloquearTomaRamos,
  importarDesbloqueoTomaRamos,
  listarDesbloqueoTomaRamos,
  quitarDesbloqueoTomaRamos,
  type CarreraDesbloqueo,
  type DesbloqueoTomaRamosFila,
} from '@/services/desbloqueoTomaRamosApi'
import {
  descargarPlantillaDesbloqueo,
  filasDesdeExcel,
} from '@/services/parseDesbloqueoTomaRamosExcel'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const filas = ref<DesbloqueoTomaRamosFila[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const filtro = ref('')
const archivo = ref<File | null>(null)
const archivoKey = ref(0)
const importando = ref(false)
const rutBusqueda = ref('')
const buscando = ref(false)
const busqueda = ref<{
  rutCuerpo: string
  dv: string
  filas: DesbloqueoTomaRamosFila[]
  carreras: CarreraDesbloqueo[]
} | null>(null)

const carrerasPendientes = computed(() => {
  const actual = busqueda.value
  if (!actual) return []
  const ya = new Set(actual.filas.map((fila) => fila.codcli.toUpperCase()))
  return actual.carreras.filter((carrera) => !ya.has(carrera.codcli.toUpperCase()))
})

function etiquetaCarrera(codcli: string): string {
  const nombre = busqueda.value?.carreras.find(
    (carrera) => carrera.codcli.toUpperCase() === codcli.toUpperCase(),
  )?.nombreCarrera
  return nombre ? `${codcli} (${nombre})` : codcli
}

const actor = computed(() => auth.username?.trim() || 'dvu')

const visibles = computed(() => {
  const q = filtro.value.trim().toUpperCase().replace(/[^0-9K A-Z-]/g, '')
  if (!q) return filas.value
  return filas.value.filter((fila) =>
    `${fila.rut} ${fila.codcli}`.toUpperCase().includes(q.replace(/\s/g, '')),
  )
})

function fmtFecha(iso: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

async function recargar() {
  loading.value = true
  error.value = null
  const result = await listarDesbloqueoTomaRamos()
  loading.value = false
  if (!result.ok) {
    error.value = result.message
    return
  }
  filas.value = result.filas
}

function onArchivo(ev: Event) {
  const input = ev.target as HTMLInputElement
  archivo.value = input.files?.[0] ?? null
}

async function subirExcel() {
  if (!archivo.value) {
    mostrarErrorRematricula('Selecciona un archivo Excel')
    return
  }
  importando.value = true
  try {
    const parsed = filasDesdeExcel(await archivo.value.arrayBuffer())
    if (parsed.error) {
      mostrarErrorRematricula(parsed.error)
      return
    }
    const result = await importarDesbloqueoTomaRamos(parsed.filas, actor.value)
    if (result.insertadas === 0) {
      mostrarErrorRematricula(result.errores[0] ?? result.message ?? 'No se cargó ninguna fila')
      return
    }
    toast.success(`Desbloqueados: ${result.insertadas}`)
    if (result.errores.length > 0) {
      toast.warning(`${result.errores.length} fila(s) no entraron. ${result.errores[0]}`)
    }
    archivo.value = null
    archivoKey.value += 1
    await recargar()
  } finally {
    importando.value = false
  }
}

async function buscar() {
  buscando.value = true
  try {
    const result = await buscarDesbloqueoTomaRamos(rutBusqueda.value)
    if (!result.ok) {
      mostrarErrorRematricula(result.message)
      return
    }
    busqueda.value = {
      rutCuerpo: result.rutCuerpo,
      dv: result.dv,
      filas: result.filas,
      carreras: result.carreras,
    }
  } finally {
    buscando.value = false
  }
}

async function desbloquearFila(fila: { rutCuerpo: string; dv: string; codcli: string }) {
  const result = await desbloquearTomaRamos({
    rut: fila.rutCuerpo,
    dv: fila.dv,
    codcli: fila.codcli,
    actualizadoPor: actor.value,
  })
  if (!result.ok) {
    mostrarErrorRematricula(result.message)
    return
  }
  toast.success('Alumno desbloqueado en MOL')
  await recargar()
  if (busqueda.value?.rutCuerpo === fila.rutCuerpo) await buscar()
}

async function desbloquear(codcli: string) {
  if (!busqueda.value) return
  await desbloquearFila({
    rutCuerpo: busqueda.value.rutCuerpo,
    dv: busqueda.value.dv,
    codcli,
  })
}

async function bloquear(fila: DesbloqueoTomaRamosFila) {
  const result = await bloquearTomaRamos({
    rut: fila.rutCuerpo,
    dv: fila.dv,
    codcli: fila.codcli,
    actualizadoPor: actor.value,
  })
  if (!result.ok) {
    mostrarErrorRematricula(result.message)
    return
  }
  toast.success('El pago vuelve a exigir la regularización de deuda')
  await recargar()
  if (busqueda.value?.rutCuerpo === fila.rutCuerpo) await buscar()
}

async function quitar(fila: DesbloqueoTomaRamosFila) {
  const result = await quitarDesbloqueoTomaRamos(fila.id)
  if (!result.ok) {
    mostrarErrorRematricula(result.message)
    return
  }
  toast.success('Fila quitada')
  await recargar()
  if (busqueda.value?.rutCuerpo === fila.rutCuerpo) await buscar()
}

onMounted(() => {
  void recargar()
})
</script>

<template>
  <div class="mx-auto max-w-[1100px] space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="space-y-2">
        <CardTitle class="text-xl text-zinc-900">Desbloqueo alumno deuda</CardTitle>
        <CardDescription class="max-w-[65ch] text-base leading-relaxed text-zinc-600">
          Quien queda desbloqueado puede pagar la matrícula aunque U+ informe deuda. No se modifica
          el cliente en U+. El pago se habilita si el RUT tiene al menos una fila desbloqueada.
        </CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4 lg:grid-cols-2">
        <section class="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4">
          <div class="space-y-1">
            <h2 class="text-base font-semibold text-zinc-900">Cargar Excel</h2>
            <p class="text-sm leading-relaxed text-zinc-600">
              Descarga la plantilla, completa RUT, DV y CODCLI, y súbela.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            class="w-fit cursor-pointer"
            @click="descargarPlantillaDesbloqueo"
          >
            <FileDown class="mr-1.5 h-4 w-4" aria-hidden="true" />
            Descargar plantilla
          </Button>
          <div class="space-y-1.5">
            <Label for="archivo-desbloqueo">Archivo completado</Label>
            <Input
              id="archivo-desbloqueo"
              :key="archivoKey"
              type="file"
              accept=".xlsx,.xls,.csv"
              class="cursor-pointer"
              @change="onArchivo"
            />
            <p class="text-sm text-zinc-600">
              {{ archivo ? archivo.name : 'Ningún archivo seleccionado' }}
            </p>
          </div>
          <Button
            type="button"
            class="mt-auto w-fit cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="importando || !archivo"
            @click="subirExcel"
          >
            <FileUp class="mr-1.5 h-4 w-4" aria-hidden="true" />
            {{ importando ? 'Cargando…' : 'Subir y desbloquear' }}
          </Button>
        </section>
        <form class="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4" @submit.prevent="buscar">
          <div class="space-y-1">
            <h2 class="text-base font-semibold text-zinc-900">Buscar un alumno</h2>
            <p class="text-sm leading-relaxed text-zinc-600">
              Escribe el RUT con guión y dígito verificador para ver sus carreras.
            </p>
          </div>
          <div class="space-y-1.5">
            <Label for="rut-busqueda">RUT</Label>
            <Input
              id="rut-busqueda"
              v-model="rutBusqueda"
              placeholder="12.345.678-5"
              autocomplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            class="mt-auto w-fit cursor-pointer"
            :disabled="buscando"
          >
            <Search class="mr-1.5 h-4 w-4" aria-hidden="true" />
            {{ buscando ? 'Buscando…' : 'Buscar' }}
          </Button>
        </form>
      </CardContent>
    </Card>

    <Card v-if="busqueda" class="border-zinc-200 shadow-sm">
      <CardHeader>
        <CardTitle class="text-base text-zinc-900">
          {{ busqueda.rutCuerpo }}-{{ busqueda.dv }}
        </CardTitle>
        <CardDescription>
          {{
            busqueda.filas.length
              ? 'Este RUT ya está en la lista.'
              : 'No está en la lista. Elige la carrera para desbloquearla.'
          }}
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <ul v-if="carrerasPendientes.length" class="space-y-2">
          <li v-for="carrera in carrerasPendientes" :key="carrera.codcli">
            <button
              type="button"
              class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              @click="desbloquear(carrera.codcli)"
            >
              <span class="min-w-0">
                <span class="block font-medium text-zinc-900">
                  {{ carrera.nombreCarrera || 'Sin nombre de carrera' }}
                </span>
                <span class="block text-sm text-zinc-600">{{ carrera.codcli }}</span>
              </span>
              <span class="shrink-0 text-sm font-medium text-[#E8621A]">Desbloquear</span>
            </button>
          </li>
        </ul>
        <p v-else-if="busqueda.filas.length === 0" class="text-sm text-zinc-600">
          No hay carreras de este RUT en la ficha de alumnos.
        </p>
        <div v-if="busqueda.filas.length" class="flex flex-wrap gap-2">
          <Button
            v-for="fila in busqueda.filas"
            :key="fila.id"
            type="button"
            class="h-auto cursor-pointer whitespace-normal"
            :variant="fila.desbloqueado ? 'outline' : 'default'"
            @click="fila.desbloqueado ? bloquear(fila) : desbloquear(fila.codcli)"
          >
            {{ etiquetaCarrera(fila.codcli) }} ·
            {{ fila.desbloqueado ? 'Volver a bloquear' : 'Desbloquear' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-end justify-between gap-3 space-y-0">
        <div>
          <CardTitle class="text-base text-zinc-900">Lista</CardTitle>
          <CardDescription>{{ filas.length }} registro(s)</CardDescription>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <div class="space-y-1.5">
            <Label for="filtro-desbloqueo" class="sr-only">Filtrar por RUT o CODCLI</Label>
            <Input
              id="filtro-desbloqueo"
              v-model="filtro"
              class="w-56"
              placeholder="Filtrar RUT o CODCLI"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            class="cursor-pointer"
            aria-label="Actualizar lista"
            :disabled="loading"
            @click="recargar"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'motion-safe:animate-spin': loading }" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p v-if="error" class="mb-3 text-sm text-red-700">{{ error }}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RUT</TableHead>
              <TableHead>CODCLI</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Actualizado</TableHead>
              <TableHead class="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="visibles.length === 0">
              <TableCell colspan="5" class="text-zinc-500">No hay alumnos en la lista.</TableCell>
            </TableRow>
            <TableRow v-for="fila in visibles" :key="fila.id">
              <TableCell class="font-medium">{{ fila.rut }}</TableCell>
              <TableCell>{{ fila.codcli }}</TableCell>
              <TableCell>
                <Badge :variant="fila.desbloqueado ? 'default' : 'secondary'">
                  {{ fila.desbloqueado ? 'Desbloqueado' : 'Bloqueado' }}
                </Badge>
              </TableCell>
              <TableCell class="text-sm text-zinc-600">
                {{ fmtFecha(fila.updatedAt) }}
                <span v-if="fila.actualizadoPor" class="block text-xs">{{ fila.actualizadoPor }}</span>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="cursor-pointer"
                    @click="fila.desbloqueado ? bloquear(fila) : desbloquearFila(fila)"
                  >
                    {{ fila.desbloqueado ? 'Bloquear' : 'Desbloquear' }}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="cursor-pointer"
                    aria-label="Quitar de la lista"
                    @click="quitar(fila)"
                  >
                    <Trash2 class="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>
