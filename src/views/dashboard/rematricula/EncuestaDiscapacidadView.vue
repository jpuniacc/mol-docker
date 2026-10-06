<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RefreshCw, Search } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  listarEncuestaDiscapacidad,
  type EncuestaDiscapacidadFila,
} from '@/services/encuestaDiscapacidadApi'

type Filtro = 'todas' | 'contesta' | 'omite' | 'distinto'

const filas = ref<EncuestaDiscapacidadFila[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const erpOk = ref(true)
const erpError = ref<string | null>(null)
const ambiente = ref<'test' | 'prod' | null>(null)
const busqueda = ref('')
const filtro = ref<Filtro>('todas')

const filtros: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'contesta', label: 'Contestó' },
  { id: 'omite', label: 'No informó' },
  { id: 'distinto', label: 'Distinto en U+' },
]

function formatearFecha(fecha: string): string {
  const date = new Date(fecha)
  if (Number.isNaN(date.getTime())) return fecha
  return date.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const visibles = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return filas.value.filter((fila) => {
    if (filtro.value === 'contesta' && !fila.contesta) return false
    if (filtro.value === 'omite' && fila.contesta) return false
    if (filtro.value === 'distinto' && fila.coincide !== false) return false
    if (!q) return true
    const texto = [fila.nombre, fila.rut, fila.codcli, fila.tipoSupabase, fila.discapacidadErp]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return texto.includes(q)
  })
})

const resumen = computed(() => {
  const total = filas.value.length
  const contestaron = filas.value.filter((fila) => fila.contesta).length
  const distintos = filas.value.filter((fila) => fila.coincide === false).length
  return { total, contestaron, distintos }
})

async function cargar() {
  loading.value = true
  error.value = null
  const res = await listarEncuestaDiscapacidad()
  loading.value = false
  if (!res.ok) {
    error.value = res.error
    return
  }
  filas.value = res.filas
  ambiente.value = res.ambiente
  erpOk.value = res.erpOk
  erpError.value = res.erpError
}

onMounted(() => {
  void cargar()
})
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div class="space-y-1">
          <CardTitle class="text-xl text-zinc-900">Encuesta discapacidad</CardTitle>
          <CardDescription class="max-w-3xl text-zinc-600">
            Cada fila es una respuesta guardada en Base de datos. Al lado está el código que
            hoy tiene el alumno en U+. Van de la más reciente a la más antigua.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" class="gap-1.5" :disabled="loading" @click="cargar">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          Recargar
        </Button>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Respuestas</p>
            <p class="mt-1 text-2xl font-semibold text-zinc-900">{{ resumen.total }}</p>
          </div>
          <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Contestaron</p>
            <p class="mt-1 text-2xl font-semibold text-zinc-900">{{ resumen.contestaron }}</p>
          </div>
          <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Distinto en U+</p>
            <p class="mt-1 text-2xl font-semibold text-zinc-900">{{ resumen.distintos }}</p>
          </div>
        </div>

        <p
          v-if="!erpOk"
          class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        >
          No se pudo leer U+. Las respuestas de Base de datos MOL sí están.
          <span v-if="erpError"> {{ erpError }}</span>
        </p>
        <p v-if="error" class="text-sm text-red-700">{{ error }}</p>

        <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div class="relative min-w-0 flex-1">
            <Search class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" aria-hidden="true" />
            <Input
              v-model="busqueda"
              class="pl-9"
              placeholder="Buscar por nombre, RUT o código"
              aria-label="Buscar respuestas"
            />
          </div>
          <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar respuestas">
            <Button
              v-for="item in filtros"
              :key="item.id"
              type="button"
              size="sm"
              class="cursor-pointer"
              :variant="filtro === item.id ? 'default' : 'outline'"
              :aria-pressed="filtro === item.id"
              @click="filtro = item.id"
            >
              {{ item.label }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card class="border-zinc-200 shadow-sm">
      <CardContent class="pt-6">
        <p v-if="loading" class="py-8 text-center text-sm text-zinc-500">Cargando encuesta…</p>
        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuándo</TableHead>
                <TableHead>Alumno</TableHead>
                <TableHead>Base de datos MOL</TableHead>
                <TableHead>U+</TableHead>
                <TableHead>Cruce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="fila in visibles" :key="fila.id">
                <TableCell class="whitespace-nowrap align-top text-sm text-zinc-700">
                  {{ formatearFecha(fila.creadoEn) }}
                  <div class="mt-1 text-xs text-zinc-500">{{ fila.periodoLabel ?? '—' }}</div>
                </TableCell>
                <TableCell class="align-top">
                  <div class="font-medium text-zinc-900">{{ fila.nombre ?? 'Sin nombre' }}</div>
                  <div class="mt-1 font-mono text-xs text-zinc-600">{{ fila.rut ?? '—' }}</div>
                  <div class="font-mono text-xs text-zinc-500">{{ fila.codcli ?? '—' }}</div>
                </TableCell>
                <TableCell class="align-top">
                  <Badge v-if="fila.contesta" variant="outline">{{ fila.tipoSupabase }}</Badge>
                  <Badge v-else variant="secondary">No informó</Badge>
                  <ul v-if="fila.afirmaciones.length" class="mt-2 list-disc space-y-1 pl-4 text-sm text-zinc-700">
                    <li v-for="texto in fila.afirmaciones" :key="texto">{{ texto }}</li>
                  </ul>
                  <p v-else-if="fila.contesta" class="mt-2 text-xs text-zinc-500">Sin afirmaciones</p>
                </TableCell>
                <TableCell class="align-top">
                  <Badge v-if="fila.discapacidadErp" variant="outline">{{ fila.discapacidadErp }}</Badge>
                  <span v-else class="text-sm text-zinc-500">Sin código</span>
                </TableCell>
                <TableCell class="align-top">
                  <Badge v-if="fila.coincide === true" class="bg-emerald-700 text-white hover:bg-emerald-700">Igual</Badge>
                  <Badge v-else-if="fila.coincide === false" class="bg-uniacc-orange text-white hover:bg-uniacc-orange">Distinto</Badge>
                  <span v-else class="text-sm text-zinc-500">No viajó</span>
                  <Badge v-if="fila.esMock" variant="secondary" class="ml-2">Prueba</Badge>
                </TableCell>
              </TableRow>
              <TableRow v-if="visibles.length === 0">
                <TableCell colspan="5" class="py-8 text-center text-sm text-zinc-500">
                  No hay respuestas con ese criterio.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
