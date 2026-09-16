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
import { periodoActivoLabel } from '@/services/periodoActivo'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type { TpPeriodoActivoRow } from '@/types/supabase'

const store = usePeriodoActivoStore()
const { rows, loading, error, vigente } = storeToRefs(store)

const confirmOpen = ref(false)
const pendingRow = ref<TpPeriodoActivoRow | null>(null)
const activating = ref(false)

const periodoVigenteLabel = computed(() => {
  if (vigente.value) {
    return periodoActivoLabel(vigente.value.anio_periodo, vigente.value.semestre_periodo)
  }
  return store.label ?? '—'
})

function fmtFecha(iso: string): string {
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

async function alternarPromediosCerrados() {
  const actual = vigente.value?.promedios_cerrados === true
  const ok = await store.setPromediosCerrados(!actual)
  if (ok) {
    toast.success(!actual ? 'Promedios marcados como cerrados.' : 'Promedios marcados como abiertos.')
  } else {
    toast.error(store.error ?? 'No se pudo actualizar el cierre de promedios.')
  }
}

function openConfirm(row: TpPeriodoActivoRow) {
  if (row.estado) return
  pendingRow.value = row
  confirmOpen.value = true
}

async function confirmarActivacion() {
  const row = pendingRow.value
  if (!row) return
  activating.value = true
  try {
    const ok = await store.activar(row.id)
    if (ok) {
      toast.success(
        `Periodo activo: ${periodoActivoLabel(row.anio_periodo, row.semestre_periodo)}`,
      )
      confirmOpen.value = false
      pendingRow.value = null
    } else {
      toast.error(store.error ?? 'No se pudo activar el periodo')
    }
  } finally {
    activating.value = false
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
          <CardTitle class="text-xl text-zinc-900">Mantenedor de periodo activo</CardTitle>
          <CardDescription class="text-zinc-600">
            Define el ciclo académico visible en cabecera y el filtro de Alumnos a matricular.
            Periodo vigente:
            <span class="font-semibold text-zinc-900">{{ periodoVigenteLabel }}</span>
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
          El cambio aplica de inmediato en cabecera y en Alumnos a matricular. Use
          <strong>Sincronizar desde ERP</strong> en ese mantenedor para cargar datos del periodo activo.
        </p>
        <div
          v-if="vigente"
          class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
        >
          <p class="text-zinc-700">
            Promedios del periodo vigente:
            <span class="font-semibold text-zinc-900">
              {{ vigente.promedios_cerrados ? 'cerrados (promedio final / anual)' : 'abiertos (promedio a la fecha)' }}
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="loading"
            @click="alternarPromediosCerrados"
          >
            {{ vigente.promedios_cerrados ? 'Marcar abiertos' : 'Marcar cerrados' }}
          </Button>
        </div>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

        <div class="rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Año</TableHead>
                <TableHead>Semestre</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead class="w-[120px] text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading && rows.length === 0">
                <TableCell colspan="6" class="text-center text-zinc-500">Cargando…</TableCell>
              </TableRow>
              <TableRow v-else-if="rows.length === 0">
                <TableCell colspan="6" class="text-center text-zinc-500">
                  No hay periodos registrados.
                </TableCell>
              </TableRow>
              <TableRow v-for="row in rows" :key="row.id">
                <TableCell>{{ row.anio_periodo }}</TableCell>
                <TableCell>{{ row.semestre_periodo }}</TableCell>
                <TableCell class="font-medium">
                  {{ periodoActivoLabel(row.anio_periodo, row.semestre_periodo) }}
                </TableCell>
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
                <TableCell class="text-zinc-600">{{ fmtFecha(row.created_at) }}</TableCell>
                <TableCell class="text-right">
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
          <DialogTitle>Activar periodo académico</DialogTitle>
          <DialogDescription>
            ¿Confirmas activar el periodo
            <span
              v-if="pendingRow"
              class="font-semibold text-zinc-900"
            >
              {{ periodoActivoLabel(pendingRow.anio_periodo, pendingRow.semestre_periodo) }}
            </span>
            ? El periodo actual quedará inactivo.
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
