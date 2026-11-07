<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { ChevronDown, Mail, MessageCircle, MessageSquare, Pencil, Phone } from 'lucide-vue-next'
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

const pillRecordatorio: Record<string, { label: string; cls: string }> = {
  programado: { label: 'Programado', cls: 'bg-blue-100 text-blue-700' },
  simulado: { label: 'Simulado', cls: 'bg-purple-100 text-purple-700' },
  enviado: { label: 'Enviado', cls: 'bg-green-100 text-green-700' },
  omitido: { label: 'Omitido', cls: 'bg-slate-100 text-slate-600' },
  fallo: { label: 'Falló', cls: 'bg-red-100 text-red-700' },
  no_aplica: { label: 'No aplica', cls: 'bg-slate-100 text-slate-600' },
}

function fechaCl(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}


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
            <DropdownMenuContent align="start" class="z-[60]">
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
                  <TooltipContent class="z-[62]">Próximamente</TooltipContent>
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
          <dl class="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-y-2">
            <dt class="text-zinc-500">Email</dt>
            <dd class="min-w-0 break-words font-medium text-zinc-900 [overflow-wrap:anywhere] mb-1 sm:mb-0">{{ valorProp(caso.email_alumno) }}</dd>
            <dt class="text-zinc-500">Teléfono</dt>
            <dd class="min-w-0 break-words font-medium text-zinc-900 [overflow-wrap:anywhere] mb-1 sm:mb-0">{{ valorProp(caso.telefono) }}</dd>
            <dt class="text-zinc-500">Firmantes</dt>
            <dd class="min-w-0 break-words font-medium text-zinc-900 [overflow-wrap:anywhere] mb-1 sm:mb-0">{{ valorProp(caso.firmantes_resumen) }}</dd>
            <dt class="text-zinc-500">Medios pago</dt>
            <dd class="min-w-0 break-words font-medium text-zinc-900 [overflow-wrap:anywhere] mb-1 sm:mb-0">{{ valorProp(caso.medios_pago_resumen) }}</dd>
            <dt class="text-zinc-500">Ejecutivo</dt>
            <dd class="min-w-0 break-words font-medium text-zinc-900 [overflow-wrap:anywhere] mb-1 sm:mb-0">{{ valorProp(caso.email_ejecutivo) }}</dd>
          </dl>
        </section>

        <section>
          <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Recordatorios automáticos
          </h3>
          <template v-if="caso.recordatorios">
            <div class="mb-2 space-y-0.5 text-[13px] text-zinc-700">
              <p>
                <template v-if="caso.recordatorios.pago_matricula_at">
                  Matrícula pagada por Webpay · {{ fechaCl(caso.recordatorios.pago_matricula_at) }}
                </template>
                <template v-else>Sin matrícula pagada por Webpay</template>
              </p>
              <p>
                Firma de contrato:
                {{ caso.recordatorios.firma_completa ? 'completa ✓' : 'pendiente' }}
              </p>
            </div>
            <p
              v-if="!caso.recordatorios.habilitado"
              class="mb-2 rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-600"
            >
              Envío automático desactivado en este ambiente.
            </p>
            <p
              v-else-if="caso.recordatorios.dry_run"
              class="mb-2 rounded-md bg-purple-50 px-3 py-2 text-xs text-purple-700"
            >
              Modo simulación: los recordatorios no se envían de verdad.
            </p>
            <ul class="space-y-2">
              <li
                v-for="it in caso.recordatorios.items"
                :key="it.tipo"
                class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="flex items-center gap-2 font-medium text-zinc-900">
                    <component :is="it.tipo === 'mail_2h' ? Mail : MessageSquare" class="size-4 text-zinc-500" aria-hidden="true" />
                    {{ it.tipo === 'mail_2h' ? 'Correo' : 'SMS' }}
                  </span>
                  <span :class="['rounded-full px-2 py-0.5 text-[11px] font-semibold', pillRecordatorio[it.estado].cls]">
                    {{ pillRecordatorio[it.estado].label }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-zinc-500">
                  <template v-if="it.estado === 'enviado' && it.enviado_at">Enviado {{ fechaCl(it.enviado_at) }} (Chile)</template>
                  <template v-else-if="it.programado_para">
                    {{ it.estado === 'omitido' ? 'Correspondería' : (it.tipo === 'mail_2h' ? '2 h después del pago ·' : '24 h después del pago ·') }}
                    {{ fechaCl(it.programado_para) }} (Chile)
                  </template>
                  <template v-else>—</template>
                </p>
                <p v-if="it.destino && it.estado !== 'no_aplica'" class="text-xs text-zinc-500">{{ it.destino }}</p>
                <p v-if="it.motivo" class="text-xs text-zinc-500">{{ it.motivo }}</p>
              </li>
            </ul>
          </template>
          <p v-else class="text-zinc-500">Sin información de recordatorios.</p>
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
