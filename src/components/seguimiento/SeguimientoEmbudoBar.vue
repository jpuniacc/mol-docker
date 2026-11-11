<script setup lang="ts">
import { computed } from 'vue'
import { Info, X } from 'lucide-vue-next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ORDEN_CHIPS_BANDEJA, ETIQUETA_CHIP_BANDEJA, numeroChipBandeja, type ChipBandeja } from '@/utils/seguimientoBandejaChip'
import type { FiltroAuxSeguimiento, KpiBandejaSeguimiento } from '@/services/seguimientoRematriculaApi'

const props = defineProps<{
  kpi: KpiBandejaSeguimiento | null
  chipActivo: ChipBandeja | null
  filtroAux: FiltroAuxSeguimiento | null
}>()

const emit = defineEmits<{
  seleccionarChip: [chip: ChipBandeja]
  seleccionarAlerta: [alerta: FiltroAuxSeguimiento]
  limpiar: []
}>()

/** Explicación por posición en el embudo (1..10). */
const AYUDA: string[] = [
  'No ha entrado al MOL en este periodo.',
  'Entró al MOL, pero no ha aceptado los términos y condiciones.',
  'Aceptó términos y condiciones; le faltan datos personales o de contacto.',
  'Completó sus datos, pero aún no elige forma de pago.',
  'Está eligiendo o pagando matrícula y arancel.',
  'Pagó, pero falta firmar el contrato en Tu Firma.',
  'Firmó el contrato; falta que quede matriculado en U+.',
  'Ya quedó matriculado en U+.',
  'Quedó matriculado por BackOffice, no por el MOL.',
  'Aparece matriculado en MOL y en BackOffice a la vez; hay que revisar el dato.',
]
const COLOR: string[] = [
  'bg-slate-400', 'bg-violet-400', 'bg-blue-400', 'bg-sky-400',
  'bg-amber-400', 'bg-orange-400', 'bg-emerald-400', 'bg-green-500',
  'bg-amber-500', 'bg-red-500',
]

function conteoChip(chip: ChipBandeja): number {
  if (!props.kpi) return 0
  if (chip === 'forma_pago') return props.kpi.forma_pago
  if (chip === 'contrato_pdte') return props.kpi.contrato_pdte
  if (chip === 'firmado_pdte_u') return props.kpi.firmado_pdte_u
  return Number(props.kpi[chip] ?? 0)
}

const total = computed(() => ORDEN_CHIPS_BANDEJA.reduce((a, c) => a + conteoChip(c), 0))

/** Escala raíz para que etapas pequeñas se vean junto a «Sin ingreso». */
function anchoBarra(chip: ChipBandeja): string {
  const n = conteoChip(chip)
  if (!n || !total.value) return '0%'
  return `${Math.max(4, Math.round(Math.sqrt(n / total.value) * 100))}%`
}

const alertas: Array<{ id: FiltroAuxSeguimiento; label: string; ayuda: string; conteo: () => number }> = [
  { id: 'sin_contactar_7d', label: 'Sin contactar +7d', ayuda: 'Casos sin ningún contacto registrado en los últimos 7 días.', conteo: () => props.kpi?.sin_contactar_7d ?? 0 },
  { id: 'mail_2h_pdte', label: 'Mail 2h pdte', ayuda: 'Pagaron matrícula por Webpay y el correo automático de 2 h aún no sale.', conteo: () => props.kpi?.mail_2h_pdte ?? 0 },
  { id: 'sms_24h_pdte', label: 'SMS 24h pdte', ayuda: 'Pagaron matrícula por Webpay y el SMS automático de 24 h aún no sale.', conteo: () => props.kpi?.sms_24h_pdte ?? 0 },
]

const fmt = (n: number) => n.toLocaleString('es-CL')
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <section class="mb-3">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-10">
        <button
          v-for="(chip, i) in ORDEN_CHIPS_BANDEJA"
          :key="chip"
          type="button"
          class="group relative cursor-pointer rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-[#FF5B00]/60"
          :class="chipActivo === chip ? 'border-2 border-[#FF5B00] ring-2 ring-orange-100' : 'border-zinc-200'"
          @click="emit('seleccionarChip', chip)"
        >
          <div class="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
            <span>{{ numeroChipBandeja(chip) }}</span>
            <Tooltip>
              <TooltipTrigger as-child>
                <span class="rounded-full p-0.5 hover:bg-zinc-100" @click.stop>
                  <Info class="size-3.5" aria-label="Qué significa esta etapa" />
                </span>
              </TooltipTrigger>
              <TooltipContent class="z-[62] max-w-60 text-xs">
                <p class="font-semibold">{{ ETIQUETA_CHIP_BANDEJA[chip] }}</p>
                <p>{{ AYUDA[i] }}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p class="mt-1 text-2xl font-bold tabular-nums text-[#1E3A5F]">{{ fmt(conteoChip(chip)) }}</p>
          <p class="truncate text-xs text-zinc-600" :title="ETIQUETA_CHIP_BANDEJA[chip]">
            {{ ETIQUETA_CHIP_BANDEJA[chip] }}
          </p>
          <div class="mt-2 h-1.5 rounded-full bg-zinc-100">
            <div class="h-1.5 rounded-full" :class="COLOR[i]" :style="{ width: anchoBarra(chip) }" />
          </div>
        </button>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold text-zinc-500">Alertas:</span>
        <Tooltip v-for="a in alertas" :key="a.id">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="cursor-pointer rounded-full border px-3 py-1 text-xs transition"
              :class="filtroAux === a.id ? 'border-[#FF5B00] bg-orange-50 font-semibold text-[#FF5B00]' : 'border-zinc-300 bg-white text-zinc-700 hover:border-[#FF5B00]/60'"
              @click="emit('seleccionarAlerta', a.id)"
            >
              {{ a.label }} · {{ fmt(a.conteo()) }}
            </button>
          </TooltipTrigger>
          <TooltipContent class="z-[62] max-w-64 text-xs">{{ a.ayuda }}</TooltipContent>
        </Tooltip>
        <button
          v-if="chipActivo || filtroAux"
          type="button"
          class="ml-auto inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#FF5B00] hover:underline"
          @click="emit('limpiar')"
        >
          Filtrando:
          {{ [chipActivo ? ETIQUETA_CHIP_BANDEJA[chipActivo] : null, filtroAux ? alertas.find((x) => x.id === filtroAux)?.label : null].filter(Boolean).join(' + ') }}
          <X class="size-3.5" /> limpiar
        </button>
      </div>
    </section>
  </TooltipProvider>
</template>
