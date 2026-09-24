<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Copy, RefreshCw, Search } from 'lucide-vue-next'

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  actualizarAplicaBeneficioPeriodo,
  copiarBeneficioPeriodo,
  fetchBeneficioPeriodo,
  fetchPeriodosBeneficio,
} from '@/services/fetchBeneficioPeriodo'
import type { MnpMvBeneficioPeriodoRow } from '@/types/supabase'
import { etiquetaQueEs } from '@/utils/beneficioPeriodo'

const PERIODO_DEFECTO = '2027-01'

const periodo = ref(PERIODO_DEFECTO)
const periodos = ref<string[]>([])
const rows = ref<MnpMvBeneficioPeriodoRow[]>([])
const busqueda = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const savingId = ref<string | null>(null)
const copyOpen = ref(false)
const destino = ref('')
const copying = ref(false)

const opcionesPeriodo = computed(() => {
  const set = new Set(periodos.value)
  set.add(PERIODO_DEFECTO)
  return [...set].sort().reverse()
})

const filas = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((row) => {
    const texto = `${row.codigo_beneficio} ${row.beneficio} ${etiquetaQueEs(row.flujo)}`.toLowerCase()
    return texto.includes(q)
  })
})

async function cargarPeriodos(): Promise<void> {
  const res = await fetchPeriodosBeneficio()
  if (res.error) {
    error.value = res.error
    return
  }
  periodos.value = res.data
}

async function cargarFilas(): Promise<void> {
  loading.value = true
  error.value = null
  const res = await fetchBeneficioPeriodo(periodo.value)
  loading.value = false
  if (res.error) {
    error.value = res.error
    rows.value = []
    return
  }
  rows.value = res.data
}

async function recargar(): Promise<void> {
  await cargarPeriodos()
  await cargarFilas()
}

async function onVigente(row: MnpMvBeneficioPeriodoRow, aplica: boolean): Promise<void> {
  if (aplica === row.aplica || savingId.value) return
  savingId.value = row.id
  const res = await actualizarAplicaBeneficioPeriodo(row.id, aplica)
  savingId.value = null
  if (res.error) {
    toast.error(res.error)
    return
  }
  row.aplica = aplica
  toast.success(aplica ? 'Marcado vigente' : 'Marcado no vigente')
}

function abrirCopia(): void {
  destino.value = ''
  copyOpen.value = true
}

async function confirmarCopia(): Promise<void> {
  copying.value = true
  const res = await copiarBeneficioPeriodo(periodo.value, destino.value)
  copying.value = false
  if (res.error) {
    toast.error(res.error)
    return
  }
  const nuevo = destino.value.trim()
  if (!periodos.value.includes(nuevo)) periodos.value = [nuevo, ...periodos.value]
  toast.success(`Periodo ${nuevo} creado con ${res.copiadas} códigos`)
  copyOpen.value = false
  periodo.value = nuevo
}

watch(periodo, () => {
  void cargarFilas()
})

onMounted(() => {
  void recargar()
})
</script>

<template>
  <div class="mx-auto max-w-[1100px] space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Convenios Excel</CardTitle>
          <CardDescription class="text-zinc-600">
            Catálogo del Excel por periodo. La columna vigente es la que usa la forma de pago.
            Copiar un periodo deja el anterior intacto.
            <span class="font-semibold text-zinc-900">{{ rows.length }}</span>
            códigos en {{ periodo }}.
          </CardDescription>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            class="cursor-pointer gap-1.5"
            :disabled="loading || copying"
            @click="recargar"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            Recargar
          </Button>
          <Button
            type="button"
            class="cursor-pointer gap-1.5 bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="loading || rows.length === 0"
            @click="abrirCopia"
          >
            <Copy class="h-4 w-4" />
            Copiar periodo
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <div class="flex flex-wrap items-end gap-3">
          <div class="w-[160px] space-y-1">
            <Label for="periodo-catalogo">Periodo</Label>
            <Select v-model="periodo">
              <SelectTrigger id="periodo-catalogo" class="cursor-pointer">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in opcionesPeriodo" :key="p" :value="p">
                  {{ p }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="relative min-w-[200px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input v-model="busqueda" class="pl-9" placeholder="Código, nombre o tipo" />
          </div>
        </div>

        <div class="overflow-x-auto rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="whitespace-nowrap">Periodo</TableHead>
                <TableHead class="whitespace-nowrap">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead class="whitespace-nowrap">Qué es</TableHead>
                <TableHead class="whitespace-nowrap">Vigente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading && rows.length === 0">
                <TableCell colspan="5" class="text-center text-zinc-500">Cargando…</TableCell>
              </TableRow>
              <TableRow v-else-if="filas.length === 0">
                <TableCell colspan="5" class="text-center text-zinc-500">
                  Sin códigos para este periodo.
                </TableCell>
              </TableRow>
              <TableRow v-for="row in filas" :key="row.id">
                <TableCell class="font-medium">{{ row.periodo }}</TableCell>
                <TableCell class="font-mono text-xs">{{ row.codigo_beneficio }}</TableCell>
                <TableCell>{{ row.beneficio }}</TableCell>
                <TableCell class="whitespace-nowrap">{{ etiquetaQueEs(row.flujo) }}</TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <Switch
                      :checked="row.aplica"
                      :disabled="savingId === row.id"
                      :aria-label="`Vigente ${row.beneficio}`"
                      @update:checked="(v: boolean) => onVigente(row, v)"
                    />
                    <span class="text-sm text-zinc-700">{{ row.aplica ? 'Sí' : 'No' }}</span>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="copyOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar periodo</DialogTitle>
          <DialogDescription>
            Copia los {{ rows.length }} códigos de {{ periodo }} a un periodo nuevo.
            El formato es 2027-01 o 2027-02. Si el destino ya tiene filas, no se copia.
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-2 py-2">
          <Label for="periodo-destino">Periodo destino</Label>
          <Input id="periodo-destino" v-model="destino" placeholder="2028-01" autocomplete="off" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" class="cursor-pointer" @click="copyOpen = false">
            Cancelar
          </Button>
          <Button
            type="button"
            class="cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="copying || destino.trim() === ''"
            @click="confirmarCopia"
          >
            Copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
