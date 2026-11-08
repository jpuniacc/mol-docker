<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {DialogRoot,DialogPortal,DialogOverlay,DialogContent,DialogTitle,DialogDescription} from 'radix-vue'
import SeguimientoAccionesCaso from './SeguimientoAccionesCaso.vue'
import SeguimientoRespuestaDialog from './SeguimientoRespuestaDialog.vue'
import { postSeguimientoRespuesta,type RespuestaSeguimientoPayload } from '@/services/seguimientoRematriculaApi'
import { patchEstadoAccion } from '@/services/seguimientoRematriculaApi'
import { ChevronDown, Mail, MessageSquare } from 'lucide-vue-next'
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
import SeguimientoTimelineEvento from './SeguimientoTimelineEvento.vue'
import SeguimientoComposerCorreo from '@/components/seguimiento/SeguimientoComposerCorreo.vue'
import SeguimientoComposerSms from '@/components/seguimiento/SeguimientoComposerSms.vue'
import type { CasoSeguimientoDetalle, ContactoSeguimiento } from '@/services/seguimientoRematriculaApi'
import {
  FILTROS_TIMELINE, formatearTelefono, paginaTimeline, agruparTimeline,
  leerFiltroTimeline, guardarFiltroTimeline,
} from '@/utils/seguimientoDrawer'
import {
  colorEtapaChip,
  ETIQUETA_CHIP_BANDEJA,
  etiquetaSubetapaFormaPago,
} from '@/utils/seguimientoBandejaChip'

const opener=typeof document!=='undefined'?document.activeElement as HTMLElement|null:null
function devolverFoco(e:Event){e.preventDefault();requestAnimationFrame(()=>{if(opener?.isConnected)opener.focus()})}
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

const gestionandoAccion=ref<string|null>(null),errorAccion=ref<string|null>(null)
async function gestionarAccion(input:{id:string;estado:'completada'|'cancelada'}){
 gestionandoAccion.value=input.id;errorAccion.value=null
 try{
  const r=await patchEstadoAccion(input.id,input.estado,props.anio,props.semestre)
  if(r.error){errorAccion.value=r.error;return}
  emit('enviado')
 }finally{gestionandoAccion.value=null}
}
const openRespuesta=ref(false),guardandoRespuesta=ref(false),errorRespuesta=ref<string|null>(null)
async function guardarRespuesta(payload:RespuestaSeguimientoPayload){guardandoRespuesta.value=true;errorRespuesta.value=null;try{const r=await postSeguimientoRespuesta(props.caso.codcli,props.anio,props.semestre,payload);if(r.error){errorRespuesta.value=r.error;return}openRespuesta.value=false;emit('enviado')}finally{guardandoRespuesta.value=false}}
const openCorreo = ref(false)
const openSms = ref(false)

const filtroTimeline = ref(leerFiltroTimeline())
const limiteTimeline = ref(10)
const timeline = computed(() => paginaTimeline(props.bitacora, filtroTimeline.value, limiteTimeline.value))
const gruposTimeline = computed(() => agruparTimeline(timeline.value.eventos))
watch(filtroTimeline, (filtro) => {
  limiteTimeline.value = 10
  guardarFiltroTimeline(filtro)
})
watch(() => [props.caso.codcli, props.anio, props.semestre], () => { limiteTimeline.value = 10 })
const etiquetasFirma = { firmado: 'firmado', pendiente: 'pendiente', no_aplica: 'no aplica', sin_informacion: 'sin información' }

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

</script>

<template>
  <DialogRoot :open="true" @update:open="v=>!v && emit('cerrar')"><DialogPortal>
    <DialogOverlay class="fixed inset-0 z-50 bg-black/40" />
    <DialogContent class="fixed inset-y-0 right-0 z-[51] flex h-[100dvh] w-full max-w-none flex-col overflow-y-auto border-l bg-white pb-[env(safe-area-inset-bottom)] shadow-xl md:max-w-[480px]" aria-label="Detalle del caso" @close-auto-focus="devolverFoco" @escape-key-down="e=>{if(openCorreo || openSms || openRespuesta)e.preventDefault()}">
      <DialogDescription class="sr-only">Información e historial del caso de rematrícula</DialogDescription>
      <div class="sticky top-0 z-10 border-b border-zinc-100 bg-white p-4 md:p-5">
        <div class="mb-3 flex items-start justify-between gap-2">
          <div class="min-w-0">
            <DialogTitle as-child><h2 class="pr-2 text-lg font-bold text-[#1E3A5F] [overflow-wrap:anywhere]">
              {{ caso.nombre_alumno ?? 'Sin nombre' }}
            </h2></DialogTitle>
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
        <Button type="button" variant="outline" class="min-h-11 w-full" @click="errorRespuesta=null;openRespuesta=true">Alumno respondió</Button>
        <SeguimientoAccionesCaso :acciones="bitacora" :ocupado="gestionandoAccion" :error="errorAccion" @gestionar="gestionarAccion" />
        <section>
          <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Propiedades
          </h3>
          <dl class="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-y-2">
            <dt class="text-zinc-500">Email</dt>
            <dd class="min-w-0 break-words font-medium text-zinc-900 [overflow-wrap:anywhere] mb-1 sm:mb-0">{{ valorProp(caso.email_alumno) }}</dd>
            <dt class="text-zinc-500">Teléfono</dt>
            <dd class="min-w-0 break-words font-medium text-zinc-900 [overflow-wrap:anywhere] mb-1 sm:mb-0">{{ formatearTelefono(caso.telefono) }}</dd>
            <dt class="text-zinc-500">Firmantes</dt>
            <dd class="min-w-0 break-words font-medium text-zinc-900 [overflow-wrap:anywhere] mb-1 sm:mb-0"><template v-if="caso.firmantes_detalle">
                <div>Alumno · {{ etiquetasFirma[caso.firmantes_detalle.alumno] }}</div>
                <div class="text-xs font-normal text-zinc-500">Sostenedor: {{ etiquetasFirma[caso.firmantes_detalle.sostenedor] }}</div>
              </template>
              <template v-else>{{ valorProp(caso.firmantes_resumen) }}</template></dd>
            <dt class="text-zinc-500">Medios pago</dt>
            <dd class="min-w-0 break-words font-medium text-zinc-900 [overflow-wrap:anywhere] mb-1 sm:mb-0"><template v-if="caso.medios_pago_detalle">
                <div>Matrícula: {{ caso.medios_pago_detalle.matricula }}</div>
                <div class="text-xs font-normal text-zinc-500">Arancel: {{ caso.medios_pago_detalle.arancel }}</div>
              </template>
              <template v-else>{{ valorProp(caso.medios_pago_resumen) }}</template></dd>
            <dt class="text-zinc-500">Ejecutivo</dt>
            <dd class="min-w-0 break-words font-medium text-zinc-900 [overflow-wrap:anywhere] mb-1 sm:mb-0"><div>{{ caso.ejecutivo_nombre || (caso.email_ejecutivo ? 'Nombre no registrado' : 'Sin asignar') }}</div>
              <div v-if="caso.email_ejecutivo" class="text-xs font-normal text-zinc-500">{{ caso.email_ejecutivo }}</div></dd>
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
                class="rounded-md border border-zinc-200 px-3 py-2"
              >
                <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span class="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                    <component :is="it.tipo === 'mail_2h' ? Mail : MessageSquare" class="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
                    {{ it.tipo === 'mail_2h' ? 'Correo 2 h' : 'SMS 24 h' }}
                  </span>
                  <span :class="['inline-flex flex-wrap items-center gap-1 rounded-full px-2 py-0.5 text-[11px]', pillRecordatorio[it.estado].cls]">
                    {{ pillRecordatorio[it.estado].label }}
                    <template v-if="it.estado === 'enviado' && it.enviado_at"> · {{ fechaCl(it.enviado_at) }} (Chile)</template>
                    <template v-else-if="it.programado_para"> · {{ fechaCl(it.programado_para) }} (Chile)</template>
                  </span>
                </div>
                <p v-if="it.destino && it.estado !== 'no_aplica'" class="mt-1 break-words text-xs text-zinc-500 [overflow-wrap:anywhere]">{{ it.destino }}</p>
                <p v-if="it.motivo" class="mt-0.5 break-words text-xs text-zinc-500">{{ it.motivo }}</p>
              </li>
            </ul>
          </template>
          <p v-else class="text-zinc-500">Sin información de recordatorios.</p>
        </section>

        <section>
          <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Timeline
          </h3>
          <div class="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar timeline por tipo de contacto">
            <button
              v-for="f in FILTROS_TIMELINE"
              :key="f.tipo"
              type="button"
              :aria-pressed="filtroTimeline === f.tipo"
              :class="['cursor-pointer rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600', filtroTimeline === f.tipo ? 'bg-[#FF5B00] text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200']"
              @click="filtroTimeline = f.tipo"
            >
              {{ f.label }} {{ timeline.conteos[f.tipo] }}
            </button>
          </div>
          <div aria-live="polite">
            <p v-if="timeline.total === 0" class="text-zinc-500">{{ bitacora.length === 0 ? 'Sin eventos aún' : 'Sin eventos de este tipo' }}</p>
            <div v-for="grupo in gruposTimeline" :key="grupo.key" class="mb-4">
              <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{{ grupo.label }}</h4>
              <ul class="space-y-2">
                <li v-for="ev in grupo.eventos" :key="`${filtroTimeline}-${limiteTimeline}-${ev.id}`" class="min-w-0">
                  <SeguimientoTimelineEvento :evento="ev" />
                </li>
              </ul>
            </div>
          </div>
          <Button v-if="timeline.restantes > 0" type="button" variant="outline" class="mt-2 w-full cursor-pointer" @click="limiteTimeline += 10">
            Ver {{ timeline.restantes }} anteriores
          </Button>
          <p v-if="timeline.total > 0" class="mt-2 text-center text-xs text-zinc-500">{{ timeline.eventos.length }} de {{ timeline.total }} eventos</p>
        </section>
      </div>
      <div v-if="!esMatriculado" class="sticky bottom-0 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"><Button type="button" class="min-h-11 w-full bg-[#FF5B00] text-white" @click="emit('agregarNota')">Agregar nota</Button></div>
    </DialogContent></DialogPortal>

    <SeguimientoRespuestaDialog v-model:open="openRespuesta" :bitacora="bitacora" :guardando="guardandoRespuesta" :error="errorRespuesta" @guardar="guardarRespuesta" />
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
  </DialogRoot>
</template>
