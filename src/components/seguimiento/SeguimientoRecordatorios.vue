<script setup lang="ts">
import {computed,ref} from 'vue'
import type {RecordatorioEtapa} from '@/types/recordatoriosEtapa'
import {etapaRecordatorio,estadoRecordatorio,fechaRecordatorio,motivoCancelacionRecordatorio} from '@/utils/seguimientoRecordatorios'
const props=withDefaults(defineProps<{items?:RecordatorioEtapa[];disponible?:boolean;detalles?:boolean}>(),{items:()=>[],disponible:false,detalles:false})
const todos=ref(false),unicos=computed(()=>[...new Map(props.items.map(r=>[r.id,r])).values()]),visibles=computed(()=>props.detalles||todos.value?unicos.value:unicos.value.slice(0,2))
</script>
<template>
 <section class="min-w-0 space-y-2 break-words [overflow-wrap:anywhere]" aria-label="Recordatorios por etapa" @click.stop>
  <p v-if="!disponible" class="text-xs text-zinc-600">Histórico no disponible · no implica ausencia de envíos.</p>
  <p v-else-if="!unicos.length" class="text-xs text-zinc-500">Sin recordatorios</p>
  <template v-else>
   <template v-for="r in visibles" :key="r.id">
    <details v-if="detalles" :data-recordatorio-id="r.id" class="min-w-0 rounded-lg border bg-white">
     <summary class="min-h-11 cursor-pointer rounded-lg p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600"><span :class="['rounded-full border px-2 py-1 text-xs',estadoRecordatorio(r).clase]">{{etapaRecordatorio(r.etapa)}} · {{r.canal==='correo'?'Correo':'SMS'}} · {{estadoRecordatorio(r).label}}</span></summary>
     <div class="space-y-2 border-t p-3 text-xs">
      <p>Etapa: {{etapaRecordatorio(r.etapa)}} · Canal: {{r.canal}} · Origen: {{r.origen}} · Variante: {{r.variante}}</p>
      <p>Entrada: {{fechaRecordatorio(r.etapa_desde)}} · Programado: {{fechaRecordatorio(r.programado_para)}} (America/Santiago)</p>
      <p>Enviado: {{fechaRecordatorio(r.enviado_at)}} (America/Santiago)</p>
      <p v-if="r.reintento_at">Reintento: {{fechaRecordatorio(r.reintento_at)}} (America/Santiago)</p>
      <p v-if="r.resultado_incierto" class="font-semibold text-red-700">Resultado incierto: verificar evidencia del proveedor; no reenviar a ciegas.</p>
      <p v-if="r.error_codigo">Diagnóstico: {{r.error_codigo}}</p><p v-if="r.cancelacion_motivo">Cancelación: {{motivoCancelacionRecordatorio(r.cancelacion_motivo)}}</p>
      <p>Asunto: {{r.asunto??'No registrado'}}</p><p>Destinatario preparado: {{r.destinatario??'No registrado; no reconstruido desde el contacto actual'}}</p><p>CC: {{r.cc??'No registrado'}}</p><p>Consejero: {{r.consejero??'No registrado'}}</p>
      <p>Preparado: {{fechaRecordatorio(r.preparado_en)}} (America/Santiago). Estos datos preparados no prueban entrega; solo «Enviado» confirma aceptación real.</p>
     </div>
    </details>
    <span v-else :data-recordatorio-id="r.id" tabindex="0" :class="['mr-1 inline-flex max-w-full rounded-full border px-2 py-1 text-xs',estadoRecordatorio(r).clase]" :title="`${fechaRecordatorio(r.enviado_at||r.programado_para)} America/Santiago · ${r.variante} · ${[r.error_codigo,r.cancelacion_motivo?motivoCancelacionRecordatorio(r.cancelacion_motivo):null].filter(Boolean).join(' · ')||'Sin diagnóstico'}`">{{etapaRecordatorio(r.etapa)}} · {{r.canal==='correo'?'Correo':'SMS'}} · {{estadoRecordatorio(r).label}}</span>
   </template>
   <button v-if="!detalles&&unicos.length>2" type="button" class="min-h-11 rounded border px-3 text-xs underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600" :aria-expanded="todos" @click.stop="todos=!todos">{{todos?'Mostrar menos':`Ver todos (${unicos.length})`}}</button>
  </template>
 </section>
</template>
