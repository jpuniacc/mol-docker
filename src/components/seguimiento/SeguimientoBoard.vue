<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { ColumnaBoardSeguimiento, FilaBandejaSeguimiento } from '@/services/seguimientoRematriculaApi'
import {
  colorEtapaChip,
  ETIQUETA_CHIP_BANDEJA,
  etiquetaSubetapaFormaPago,
  type ChipBandeja,
} from '@/utils/seguimientoBandejaChip'

const props = defineProps<{
  columnas: ColumnaBoardSeguimiento[]
  chipEnfasis: ChipBandeja | null
  cargando: boolean
}>()

const emit = defineEmits<{
  abrir: [fila: FilaBandejaSeguimiento]
}>()

const colRefs = ref<Record<string, HTMLElement | null>>({})

function setColRef(chip: string, el: unknown): void {
  colRefs.value[chip] = (el as HTMLElement | null) ?? null
}

watch(
  () => props.chipEnfasis,
  async (chip) => {
    if (!chip) return
    await nextTick()
    colRefs.value[chip]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  },
)

function detalle(fila: FilaBandejaSeguimiento): string {
  const sub = etiquetaSubetapaFormaPago(fila.subetapa_forma_pago)
  return sub !== '—' ? sub : ETIQUETA_CHIP_BANDEJA[fila.chip]
}
</script>

<template>
  <div class="relative">
    <p v-if="cargando" class="mb-2 text-xs text-zinc-500">Cargando board…</p>
    <div class="flex gap-3 overflow-x-auto pb-3">
      <section
        v-for="col in columnas"
        :key="col.chip"
        :ref="(el) => setColRef(col.chip, el)"
        class="w-64 shrink-0 rounded-lg border bg-white"
        :class="
          chipEnfasis === col.chip
            ? 'border-[#FF5B00] ring-2 ring-[#FF5B00]/30'
            : 'border-zinc-200'
        "
      >
        <header class="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
          <h3 class="truncate text-xs font-semibold text-[#1E3A5F]">{{ col.label }}</h3>
          <span class="tabular-nums text-xs text-zinc-500">{{ col.total }}</span>
        </header>
        <ul class="max-h-[calc(100vh-16rem)] space-y-2 overflow-y-auto p-2">
          <li
            v-for="fila in col.filas"
            :key="fila.codcli"
            class="cursor-pointer rounded-md border border-zinc-100 bg-slate-50 p-2 transition hover:border-[#FF5B00]/40 hover:bg-orange-50/60"
            @click="emit('abrir', fila)"
          >
            <p class="truncate text-sm font-medium text-zinc-900">
              {{ fila.nombre_alumno ?? '—' }}
            </p>
            <p class="truncate text-xs text-zinc-500">{{ detalle(fila) }}</p>
            <p class="mt-1 truncate text-[11px] text-zinc-400">
              {{ fila.email_ejecutivo ?? '—' }}
            </p>
            <span
              class="mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
              :class="[
                colorEtapaChip(fila.chip).bg,
                colorEtapaChip(fila.chip).text,
                colorEtapaChip(fila.chip).border,
              ]"
            >
              {{ ETIQUETA_CHIP_BANDEJA[fila.chip] }}
            </span>
          </li>
          <li v-if="col.filas.length === 0" class="px-1 py-4 text-center text-xs text-zinc-400">
            Vacío
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
