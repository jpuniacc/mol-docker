<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  CheckCircle2,
  Download,
  Mail,
  RefreshCw,
  TriangleAlert,
  Users,
} from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  listarAlumniMailing,
  type AlumniMailingFila,
  type AlumniMailingResumen,
  type AlumniMailingStatus,
} from '@/services/alumniMailingAdminApi'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'

const loading = ref(false)
const filas = ref<AlumniMailingFila[]>([])
const lotes = ref<string[]>([])
const total = ref(0)
const resumen = ref<AlumniMailingResumen>({
  pending: 0,
  sent: 0,
  error: 0,
  downloaded: 0,
})
const lote = ref<string>('todos')
const status = ref<string>('todos')
const q = ref('')
const actualizado = ref<Date | null>(null)

const STATUS_LABEL: Record<AlumniMailingStatus, string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  error: 'Error',
}

const STATUS_BADGE: Record<AlumniMailingStatus, string> = {
  pending: 'border-slate-200 bg-slate-50 text-slate-700',
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', { timeZone: 'America/Santiago' })
}

async function cargar(): Promise<void> {
  loading.value = true
  try {
    const list = await listarAlumniMailing({
      lote: lote.value === 'todos' ? null : lote.value,
      status:
        status.value === 'pending' || status.value === 'sent' || status.value === 'error'
          ? status.value
          : null,
      q: q.value.trim() || null,
      limit: 2000,
      offset: 0,
    })
    if (!list.ok) {
      mostrarErrorRematricula(`Error al cargar mailing: ${list.error}`)
      return
    }
    filas.value = list.filas
    total.value = list.total
    resumen.value = list.resumen
    if (list.lotes.length) lotes.value = list.lotes
    actualizado.value = new Date()
  } finally {
    loading.value = false
  }
}

const kpis = computed(() => [
  { label: 'Total', value: total.value, icon: Users },
  { label: 'Enviados', value: resumen.value.sent, icon: Mail },
  { label: 'Descargados', value: resumen.value.downloaded, icon: Download },
  { label: 'Pendientes', value: resumen.value.pending, icon: CheckCircle2 },
  { label: 'Errores', value: resumen.value.error, icon: TriangleAlert },
])

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch([lote, status], () => {
  void cargar()
})
watch(q, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void cargar()
  }, 350)
})

onMounted(() => {
  void cargar()
})
</script>

<template>
  <div class="space-y-6 p-4 md:p-6">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-[var(--color-navy,#1E3A5F)]">
          Alumni · Mailing
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Seguimiento de envío y descarga de fotografías profesionales.
          <span v-if="actualizado" class="ml-1">
            Actualizado {{ fmtFecha(actualizado.toISOString()) }}
          </span>
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        class="cursor-pointer"
        :disabled="loading"
        @click="cargar"
      >
        <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
        Actualizar
      </Button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Card v-for="k in kpis" :key="k.label">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">{{ k.label }}</CardTitle>
          <component :is="k.icon" class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ k.value }}</div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
        <CardDescription>Lote, estado y búsqueda por nombre o correo.</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 md:flex-row md:items-center">
        <Select v-model="lote">
          <SelectTrigger class="w-full md:w-48">
            <SelectValue placeholder="Lote" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los lotes</SelectItem>
            <SelectItem v-for="l in lotes" :key="l" :value="l">{{ l }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="status">
          <SelectTrigger class="w-full md:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Input
          v-model="q"
          type="search"
          placeholder="Buscar nombre o email…"
          class="w-full md:max-w-sm"
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Envíos</CardTitle>
        <CardDescription>{{ total }} registro(s)</CardDescription>
      </CardHeader>
      <CardContent class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead>Descargado</TableHead>
              <TableHead class="text-right"># DL</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading && filas.length === 0">
              <TableCell colspan="8" class="text-center text-muted-foreground">
                Cargando…
              </TableCell>
            </TableRow>
            <TableRow v-else-if="filas.length === 0">
              <TableCell colspan="8" class="text-center text-muted-foreground">
                Sin resultados
              </TableCell>
            </TableRow>
            <TableRow v-for="fila in filas" :key="fila.token">
              <TableCell class="max-w-[220px] truncate font-medium" :title="fila.nombre">
                {{ fila.nombre }}
              </TableCell>
              <TableCell class="max-w-[220px] truncate" :title="fila.email">
                {{ fila.email }}
              </TableCell>
              <TableCell>{{ fila.lote }}</TableCell>
              <TableCell>
                <Badge variant="outline" :class="STATUS_BADGE[fila.status]">
                  {{ STATUS_LABEL[fila.status] }}
                </Badge>
              </TableCell>
              <TableCell class="whitespace-nowrap text-sm">
                {{ fmtFecha(fila.sent_at) }}
              </TableCell>
              <TableCell class="whitespace-nowrap text-sm">
                {{ fmtFecha(fila.downloaded_at) }}
              </TableCell>
              <TableCell class="text-right">{{ fila.download_count }}</TableCell>
              <TableCell class="max-w-[180px] truncate text-sm text-rose-700" :title="fila.error_message || ''">
                {{ fila.error_message || '—' }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>
