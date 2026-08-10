<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { CheckCircle2, RefreshCw } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { pingErpSpAmbienteApi } from '@/services/erpSpAmbienteApi'
import type { ErpSpAmbiente } from '@/services/erpSpAmbiente'
import { useErpSpAmbienteStore } from '@/stores/erpSpAmbiente'
import type { TpMnpErpSpAmbienteRow } from '@/types/supabase'

const store = useErpSpAmbienteStore()
const { rows, loading, error, vigente } = storeToRefs(store)

const confirmOpen = ref(false)
const pendingRow = ref<TpMnpErpSpAmbienteRow | null>(null)
const activating = ref(false)
const pinging = ref<ErpSpAmbiente | null>(null)
const lastPing = ref<string | null>(null)

const ambienteVigenteLabel = computed(() => vigente.value?.label ?? store.label)

function fmtFecha(iso: string | null | undefined): string {
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
  await store.fetchAll()
}

function openConfirm(row: TpMnpErpSpAmbienteRow) {
  if (row.estado) return
  pendingRow.value = row
  confirmOpen.value = true
}

async function confirmarActivacion() {
  const row = pendingRow.value
  if (!row) return
  activating.value = true
  try {
    const ok = await store.activar(row.ambiente as ErpSpAmbiente)
    if (ok) {
      toast.success(`Ambiente ERP SP activo: ${row.label}`)
      confirmOpen.value = false
      pendingRow.value = null
    } else {
      toast.error(store.error ?? 'No se pudo activar el ambiente')
    }
  } finally {
    activating.value = false
  }
}

async function ping(ambiente: ErpSpAmbiente) {
  pinging.value = ambiente
  lastPing.value = null
  try {
    const res = await pingErpSpAmbienteApi(ambiente)
    if (res.ok) {
      lastPing.value = `${ambiente.toUpperCase()}: OK (${res.host ?? '—'}, ${res.duracionMs ?? '?'} ms)`
      toast.success(lastPing.value)
    } else {
      lastPing.value = `${ambiente.toUpperCase()}: falló — ${res.error ?? res.message}`
      toast.error(lastPing.value)
    }
  } finally {
    pinging.value = null
  }
}

onMounted(() => {
  void recargar()
})
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Ambiente ERP SP (on-demand)</CardTitle>
          <CardDescription class="text-zinc-600">
            Elige si los SP on-demand de uniacc-api van a SQL Server producción o test espejado.
            Ambiente vigente:
            <span class="font-semibold text-zinc-900">{{ ambienteVigenteLabel }}</span>
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          class="gap-1.5"
          :disabled="loading"
          @click="recargar"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Solo afecta llamadas SP on-demand (p. ej.
          <code class="rounded bg-amber-100 px-1">pa08_MT_ARANCEL_sel_MATRICULA_NET</code>).
          El ETL / integración UMAS y los syncs “Actualizar desde ERP” siguen siempre en
          <strong>producción</strong>. Las credenciales viven solo en el servidor (.env).
        </p>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <p v-if="lastPing" class="text-sm text-zinc-600">{{ lastPing }}</p>

        <div class="rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ambiente</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Actualizado</TableHead>
                <TableHead class="w-[220px] text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading && rows.length === 0">
                <TableCell colspan="5" class="text-center text-zinc-500">Cargando…</TableCell>
              </TableRow>
              <TableRow v-else-if="rows.length === 0">
                <TableCell colspan="5" class="text-center text-zinc-500">
                  No hay ambientes registrados. Aplique la migración.
                </TableCell>
              </TableRow>
              <TableRow v-for="row in rows" :key="row.id">
                <TableCell class="font-mono text-sm uppercase">{{ row.ambiente }}</TableCell>
                <TableCell class="font-medium">{{ row.label }}</TableCell>
                <TableCell>
                  <Badge
                    v-if="row.estado"
                    variant="default"
                    class="gap-1 bg-emerald-600 hover:bg-emerald-600"
                  >
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    Activo
                  </Badge>
                  <Badge v-else variant="secondary">Inactivo</Badge>
                </TableCell>
                <TableCell class="text-zinc-600">{{ fmtFecha(row.updated_at) }}</TableCell>
                <TableCell class="space-x-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    :disabled="pinging !== null || loading"
                    @click="ping(row.ambiente as ErpSpAmbiente)"
                  >
                    {{ pinging === row.ambiente ? 'Ping…' : 'Ping' }}
                  </Button>
                  <Button
                    v-if="!row.estado"
                    type="button"
                    size="sm"
                    class="bg-uniacc-orange hover:bg-uniacc-orange/90"
                    :disabled="loading || activating"
                    @click="openConfirm(row)"
                  >
                    Activar
                  </Button>
                  <span v-else class="text-xs text-zinc-500">—</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="confirmOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activar ambiente ERP SP</DialogTitle>
          <DialogDescription>
            ¿Confirmas activar
            <span v-if="pendingRow" class="font-semibold text-zinc-900">
              {{ pendingRow.label }} ({{ pendingRow.ambiente }})
            </span>
            ?
            <template v-if="pendingRow?.ambiente === 'test'">
              Las consultas SP on-demand usarán el SQL Server de test. El ETL de integración
              permanece en producción.
            </template>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" :disabled="activating" @click="confirmOpen = false">
            Cancelar
          </Button>
          <Button
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="activating"
            @click="confirmarActivacion"
          >
            {{ activating ? 'Activando…' : 'Confirmar' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
