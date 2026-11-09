<script setup lang="ts">
import SeguimientoFiltrosRecordatorios from './SeguimientoFiltrosRecordatorios.vue'
import type {FiltrosRecordatorios} from '@/types/recordatoriosEtapa'
import { ORDEN_CHIPS_BANDEJA, ETIQUETA_CHIP_BANDEJA, numeroChipBandeja, type ChipBandeja } from '@/utils/seguimientoBandejaChip'
import type { FiltroAuxSeguimiento, KpiBandejaSeguimiento } from '@/services/seguimientoRematriculaApi'

const props = defineProps<{
  kpi: KpiBandejaSeguimiento | null
  chipActivo: ChipBandeja | null
  recordatorios?:FiltrosRecordatorios
  filtroAux: FiltroAuxSeguimiento | null
  esSupervisor: boolean
  carteraLabel: string
}>()

const emit = defineEmits<{
  recordatorios: [v:FiltrosRecordatorios]
  seleccionarChip: [chip: ChipBandeja]
  seleccionarAlerta: [alerta: FiltroAuxSeguimiento]
}>()

function conteoChip(chip: ChipBandeja): number {
  if (!props.kpi) return 0
  if (chip === 'forma_pago') return props.kpi.forma_pago
  if (chip === 'contrato_pdte') return props.kpi.contrato_pdte
  if (chip === 'firmado_pdte_u') return props.kpi.firmado_pdte_u
  return Number(props.kpi[chip] ?? 0)
}

const alertas: Array<{ id: FiltroAuxSeguimiento; label: string; conteo: () => number }> = [
  {
    id: 'sin_contactar_7d',
    label: 'Sin contactar +7d',
    conteo: () => props.kpi?.sin_contactar_7d ?? 0,
  },
  {
    id: 'mail_2h_pdte',
    label: 'Mail 2h pdte',
    conteo: () => props.kpi?.mail_2h_pdte ?? 0,
  },
  {
    id: 'sms_24h_pdte',
    label: 'SMS 24h pdte',
    conteo: () => props.kpi?.sms_24h_pdte ?? 0,
  },
]
</script>

<template>
  <aside class="w-[220px] shrink-0 space-y-5 border-r border-zinc-200 bg-white p-4">
    <section>
      <h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Cartera
      </h2>
      <p class="text-sm font-medium text-[#1E3A5F]">{{ carteraLabel }}</p>
      <p v-if="esSupervisor" class="mt-1 text-xs text-zinc-500">
        Usa el selector del header para filtrar ejecutivo.
      </p>
    </section>

    <section>
      <h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Etapa embudo
      </h2>
      <ul class="space-y-0.5">
        <li v-for="chip in ORDEN_CHIPS_BANDEJA" :key="chip">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-orange-50"
            :class="
              chipActivo === chip
                ? 'bg-orange-50 font-semibold text-[#FF5B00]'
                : 'text-zinc-700'
            "
            @click="emit('seleccionarChip', chip)"
          >
            <span class="truncate">
              {{ numeroChipBandeja(chip) }}. {{ ETIQUETA_CHIP_BANDEJA[chip] }}
            </span>
            <span class="tabular-nums text-xs text-zinc-500">{{ conteoChip(chip) }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section>
      <h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Alertas
      </h2>
      <ul class="space-y-0.5">
        <li v-for="a in alertas" :key="a.id">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-orange-50"
            :class="
              filtroAux === a.id
                ? 'bg-orange-50 font-semibold text-[#FF5B00]'
                : 'text-zinc-700'
            "
            @click="emit('seleccionarAlerta', a.id)"
          >
            <span class="truncate">{{ a.label }}</span>
            <span class="tabular-nums text-xs text-zinc-500">{{ a.conteo() }}</span>
          </button>
        </li>
      </ul>
    </section>
  <SeguimientoFiltrosRecordatorios :model-value="recordatorios??{}" @update:model-value="emit('recordatorios',$event)" />
  </aside>
</template>
