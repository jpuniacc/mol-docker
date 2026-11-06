<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { FilaBandejaSeguimiento } from '@/services/seguimientoRematriculaApi'
import {
  colorEtapaChip,
  ETIQUETA_CHIP_BANDEJA,
  etiquetaSubetapaFormaPago,
} from '@/utils/seguimientoBandejaChip'

defineProps<{
  filas: FilaBandejaSeguimiento[]
  cargando: boolean
  total: number
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  abrir: [fila: FilaBandejaSeguimiento]
  'update:page': [page: number]
}>()

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function detalleEtapa(fila: FilaBandejaSeguimiento): string {
  const sub = etiquetaSubetapaFormaPago(fila.subetapa_forma_pago)
  return sub !== '—' ? sub : ''
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <div class="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b bg-slate-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th class="px-3 py-2.5 font-medium">Alumno</th>
            <th class="px-3 py-2.5 font-medium">Etapa</th>
            <th class="px-3 py-2.5 font-medium">Último contacto</th>
            <th class="px-3 py-2.5 font-medium">Próxima</th>
            <th class="px-3 py-2.5 font-medium">Ejecutivo</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="fila in filas"
            :key="fila.codcli"
            class="cursor-pointer border-b last:border-0 hover:bg-orange-50/50"
            @click="emit('abrir', fila)"
          >
            <td class="px-3 py-2.5">
              <div class="font-medium text-zinc-900">{{ fila.nombre_alumno ?? '—' }}</div>
              <div class="text-xs text-zinc-500">
                {{ fila.rut ?? fila.codcli }}
                <span v-if="fila.nombre_carrera"> · {{ fila.nombre_carrera }}</span>
              </div>
            </td>
            <td class="px-3 py-2.5">
              <span
                class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold"
                :class="[
                  colorEtapaChip(fila.chip).bg,
                  colorEtapaChip(fila.chip).text,
                  colorEtapaChip(fila.chip).border,
                ]"
              >
                {{ ETIQUETA_CHIP_BANDEJA[fila.chip] }}
              </span>
              <div v-if="detalleEtapa(fila)" class="mt-0.5 text-xs text-zinc-500">
                {{ detalleEtapa(fila) }}
              </div>
            </td>
            <td class="px-3 py-2.5 text-zinc-700">
              <template v-if="fila.ultimo_contacto">
                {{ fila.ultimo_contacto_canal }} · {{ fmtFecha(fila.ultimo_contacto) }}
              </template>
              <template v-else>—</template>
            </td>
            <td class="px-3 py-2.5 text-zinc-700">{{ fila.proxima_accion ?? '—' }}</td>
            <td class="px-3 py-2.5 text-xs text-zinc-600">{{ fila.email_ejecutivo ?? '—' }}</td>
          </tr>
          <tr v-if="!cargando && filas.length === 0">
            <td colspan="5" class="px-3 py-10 text-center text-zinc-500">Sin filas</td>
          </tr>
          <tr v-if="cargando && filas.length === 0">
            <td colspan="5" class="px-3 py-10 text-center text-zinc-500">Cargando…</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-3 flex items-center justify-between gap-2 text-sm">
      <span class="text-zinc-500">{{ total }} resultados</span>
      <div class="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="cursor-pointer rounded-full"
          :disabled="page === 0"
          @click="emit('update:page', page - 1)"
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="cursor-pointer rounded-full"
          :disabled="(page + 1) * pageSize >= total"
          @click="emit('update:page', page + 1)"
        >
          Siguiente
        </Button>
      </div>
    </div>
  </div>
</template>
