<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import type { ContactoSeguimiento } from '@/services/seguimientoRematriculaApi'
import { FILTROS_TIMELINE, tipoEvento } from '@/utils/seguimientoDrawer'
import { etiquetaFechaChile, CANALES_ACCION } from '@/utils/seguimientoNota'
import SeguimientoProximaAccion from './SeguimientoProximaAccion.vue'
const props = defineProps<{ evento: ContactoSeguimiento }>()
const tipo = computed(() => FILTROS_TIMELINE.find(f => f.tipo === tipoEvento(props.evento))?.label || 'Nota')
const autor = computed(() => props.evento.origen === 'sistema' ? 'Sistema' : props.evento.autor_email || 'Sin autor')
const canal = computed(() => CANALES_ACCION.find(c => c.value === props.evento.canal)?.label || props.evento.canal)
const detalle = computed(() => {
  const nota = props.evento.nota?.trim() || ''
  // Formato existente de bitácora de correo: no interpretar HTML ni inventar contenido.
  const mail = /^\[plantilla:([^\]]+)\]\s*asunto=([\s\S]*?)\s\|\spreview=([\s\S]*)$/.exec(nota)
  if (mail) return { titulo: mail[2] || 'Correo enviado', plantilla: mail[1], preview: mail[3], comentario: '' }
  if (/^\[sms\]\s*texto=/.test(nota)) return { titulo: 'SMS enviado', plantilla: '', preview: '', comentario: nota.replace(/^\[sms\]\s*texto=/, '') }
  const comentario = nota.replace(/^\[hito:[^\]]+\]\s*/, '')
  const primeraLinea = comentario.split(/\r?\n/).find(l => l.trim()) || `${tipo.value} registrado`
  return { titulo: primeraLinea.length > 110 ? `${primeraLinea.slice(0,110)}…` : primeraLinea, plantilla: '', preview: '', comentario }
})
</script>
<template>
  <details :data-evento-id="evento.id" class="group min-w-0 rounded-lg border border-zinc-200 bg-white">
    <summary class="cursor-pointer list-none rounded-lg px-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600 [&::-webkit-details-marker]:hidden">
      <div class="flex min-w-0 items-start gap-2">
        <ChevronRight class="mt-0.5 size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">{{ tipo }}</span>
            <span class="min-w-0 break-words text-sm font-semibold text-zinc-800 [overflow-wrap:anywhere]">{{ detalle.titulo }}</span>
          </div>
          <p class="mt-1 break-words text-xs text-zinc-500 [overflow-wrap:anywhere]">{{ autor }} · {{ etiquetaFechaChile(evento.fecha_contacto || evento.created_at) }} (Chile)</p>
        </div>
      </div>
    </summary>
    <div class="space-y-3 border-t border-zinc-100 px-3 py-3 text-xs text-zinc-700">
      <p><span class="font-medium">Canal:</span> {{ canal }} <span v-if="evento.origen === 'auto'">· Automático</span></p>
      <div v-if="detalle.comentario">
        <p class="mb-1 font-semibold text-zinc-600">Comentario</p>
        <p class="whitespace-pre-line break-words [overflow-wrap:anywhere]">{{ detalle.comentario }}</p>
      </div>
      <details v-if="detalle.plantilla" class="rounded-md border border-zinc-200">
        <summary class="cursor-pointer px-3 py-2 font-medium">Plantilla</summary>
        <p class="break-words border-t border-zinc-100 px-3 py-2 [overflow-wrap:anywhere]">{{ detalle.plantilla }}</p>
      </details>
      <details v-if="detalle.preview" class="rounded-md border border-zinc-200">
        <summary class="cursor-pointer px-3 py-2 font-medium">Vista previa</summary>
        <p class="whitespace-pre-line break-words border-t border-zinc-100 px-3 py-2 [overflow-wrap:anywhere]">{{ detalle.preview }}</p>
      </details>
      <p v-if="evento.resultado" class="whitespace-pre-line break-words"><span class="font-medium">Resultado:</span> {{ evento.resultado }}</p>
      <div v-if="evento.proxima_accion_at || evento.proxima_accion_en || evento.proxima_accion" class="rounded-md border border-zinc-200 bg-zinc-50 p-2">
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Próxima acción</p>
        <SeguimientoProximaAccion :at="evento.proxima_accion_at || evento.proxima_accion_en" :canales="evento.proxima_accion_canales" :comentario="evento.proxima_accion_comentario" :legacy="evento.proxima_accion" :estado="evento.proxima_accion_estado" />
      </div>
    </div>
  </details>
</template>
