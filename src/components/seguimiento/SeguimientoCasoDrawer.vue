<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { ChevronDown, MessageCircle, MessageSquare, Pencil, Phone } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import SeguimientoComposerCorreo from '@/components/seguimiento/SeguimientoComposerCorreo.vue'
import SeguimientoComposerSms from '@/components/seguimiento/SeguimientoComposerSms.vue'
import type { CasoSeguimientoDetalle, ContactoSeguimiento } from '@/services/seguimientoRematriculaApi'
import {
  colorEtapaChip,
  ETIQUETA_CHIP_BANDEJA,
  etiquetaSubetapaFormaPago,
} from '@/utils/seguimientoBandejaChip'
import { etiquetaOutboxUi } from '@/utils/seguimientoBandejaOutbox'

const props = defineProps<{
  caso: CasoSeguimientoDetalle
  bitacora: ContactoSeguimiento[]
  anio: number
  semestre: number
}>()

const emit = defineEmits<{
  cerrar: []
  agregarNota: []
  enviado: []
}>()

const openCorreo = ref(false)
const openSms = ref(false)

const esMatriculado = computed(() => props.caso.chip === 'matriculado')

const aplicaRecordatorios = computed(
  () => props.caso.mat_webpay_fecha != null && !props.caso.firma_completa,
)

function valorProp(v: string | null | undefined): string {
  if (v == null || !String(v).trim()) return '—'
  return String(v).trim()
}

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

function iconoCanal(canal: string, origen: string): Component {
  if (origen === 'sistema') return Pencil
  const c = canal.trim().toLowerCase()
  if (c === 'llamada' || c === 'telefono' || c === 'teléfono' || c === 'presencial') return Phone
  if (c === 'sms') return MessageSquare
  if (c === 'whatsapp') return MessageCircle
  return Pencil
}

function etiquetaOrigen(origen: string): string {
  if (origen === 'sistema') return 'Sistema'
  if (origen === 'auto') return 'Auto'
  return 'Nota'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 bg-black/40"
      aria-hidden="true"
      @click="emit('cerrar')"
    />
    <aside
      class="fixed inset-y-0 right-0 z-[51] flex w-full max-w-[480px] flex-col overflow-y-auto border-l bg-white shadow-xl"
      role="dialog"
      aria-label="Detalle del caso"
    >
      <div class="border-b border-zinc-100 p-5">
        <div class="mb-3 flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h2 class="truncate text-lg font-bold text-[#1E3A5F]">
              {{ caso.nombre_alumno ?? 'Sin nombre' }}
            </h2>
            <p class="text-sm text-zinc-500">
              {{ caso.rut ?? '—' }} · {{ caso.codcli }}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" class="cursor-pointer shrink-0" @click="emit('cerrar')">
            Cerrar
          </Button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <span
            class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold"
            :class="[
              colorEtapaChip(caso.chip).bg,
              colorEtapaChip(caso.chip).text,
              colorEtapaChip(caso.chip).border,
            ]"
          >
            {{ ETIQUETA_CHIP_BANDEJA[caso.chip] }}
          </span>
          <span
            v-if="caso.subetapa_forma_pago"
            class="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700"
          >
            {{ etiquetaSubetapaFormaPago(caso.subetapa_forma_pago) }}
          </span>
        </div>
        <p class="mt-2 text-sm text-zinc-600">{{ caso.nombre_carrera ?? '—' }}</p>

        <p
          v-if="esMatriculado"
          class="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
        >
          Caso cerrado en embudo · solo consulta
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <DropdownMenu v-if="!esMatriculado">
            <DropdownMenuTrigger as-child>
              <Button
                type="button"
                class="cursor-pointer rounded-full bg-[#FF5B00] hover:bg-[#FF5B00]/90"
              >
                Contactar
                <ChevronDown class="ml-1 size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem class="cursor-pointer" @click="openCorreo = true">
                Correo
              </DropdownMenuItem>
              <DropdownMenuItem class="cursor-pointer" @click="openSms = true">
                SMS
              </DropdownMenuItem>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <div>
                      <DropdownMenuItem disabled class="opacity-50">
                        WhatsApp
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Próximamente</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            class="cursor-pointer rounded-full bg-[#FF5B00] hover:bg-[#FF5B00]/90"
            @click="emit('agregarNota')"
          >
            Agregar nota
          </Button>
        </div>
      </div>

      <div class="space-y-5 p-5 text-sm">
        <section>
          <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Propiedades
          </h3>
          <dl class="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
            <dt class="text-zinc-500">Email</dt>
            <dd class="font-medium text-zinc-900">{{ valorProp(caso.email_alumno) }}</dd>
            <dt class="text-zinc-500">Teléfono</dt>
            <dd class="font-medium text-zinc-900">{{ valorProp(caso.telefono) }}</dd>
            <dt class="text-zinc-500">Firmantes</dt>
            <dd class="font-medium text-zinc-900">{{ valorProp(caso.firmantes_resumen) }}</dd>
            <dt class="text-zinc-500">Medios pago</dt>
            <dd class="font-medium text-zinc-900">{{ valorProp(caso.medios_pago_resumen) }}</dd>
            <dt class="text-zinc-500">Ejecutivo</dt>
            <dd class="font-medium text-zinc-900">{{ valorProp(caso.email_ejecutivo) }}</dd>
          </dl>
        </section>

        <section>
          <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Recordatorios automáticos
          </h3>
          <div
            v-if="aplicaRecordatorios"
            class="rounded-lg border border-orange-200 bg-orange-50 p-3"
          >
            <p>Correo 2h: {{ etiquetaOutboxUi(caso.mail_2h, caso.mail_2h_sent_at) }}</p>
            <p>SMS 24h: {{ etiquetaOutboxUi(caso.sms_24h, caso.sms_24h_sent_at) }}</p>
          </div>
          <p v-else class="text-zinc-500">
            No aplican: sin matrícula Webpay o firma ya completa.
          </p>
        </section>

        <section>
          <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Timeline
          </h3>
          <ul class="space-y-3">
            <li
              v-for="ev in bitacora"
              :key="ev.id"
              class="rounded-lg border border-zinc-100 bg-slate-50 px-3 py-2"
            >
              <div class="flex items-center gap-2 font-medium text-zinc-800">
                <component
                  :is="iconoCanal(ev.canal, ev.origen)"
                  class="size-4 shrink-0 text-zinc-500"
                  aria-hidden="true"
                />
                <span>
                  {{ etiquetaOrigen(ev.origen) }} · {{ ev.canal }}
                  <span v-if="ev.origen !== 'sistema'" class="text-zinc-500">
                    · {{ ev.autor_email }}
                  </span>
                </span>
              </div>
              <div class="text-xs text-zinc-500">{{ fmtFecha(ev.created_at) }}</div>
              <p v-if="ev.nota" class="mt-1 text-zinc-700">{{ ev.nota }}</p>
            </li>
            <li v-if="bitacora.length === 0" class="text-zinc-500">Sin eventos aún</li>
          </ul>
        </section>
      </div>
    </aside>

    <SeguimientoComposerCorreo
      v-if="!esMatriculado"
      :open="openCorreo"
      :caso="caso"
      :anio="anio"
      :semestre="semestre"
      @update:open="(v) => (openCorreo = v)"
      @enviado="emit('enviado')"
    />
    <SeguimientoComposerSms
      v-if="!esMatriculado"
      :open="openSms"
      :caso="caso"
      :anio="anio"
      :semestre="semestre"
      @update:open="(v) => (openSms = v)"
      @enviado="emit('enviado')"
    />
  </Teleport>
</template>
