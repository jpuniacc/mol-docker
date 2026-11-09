<script setup lang="ts">
import type {MetricasRecordatorios} from '@/types/recordatoriosEtapa'
import {etapaRecordatorio,fechaRecordatorio} from '@/utils/seguimientoRecordatorios'
defineProps<{data:MetricasRecordatorios|null;error?:string|null;cargando?:boolean}>()
</script>
<template>
 <section class="min-w-0 space-y-3 rounded-lg border border-blue-200 p-3 md:p-5" aria-label="Recordatorios automáticos">
  <h2 class="font-semibold">Recordatorios automáticos</h2>
  <p v-if="cargando" role="status">Cargando recordatorios…</p><p v-else-if="error" role="alert">{{error}}</p>
  <p v-else-if="!data?.disponible">No disponible · no se infieren ceros históricos.</p>
  <template v-else>
   <p class="text-xs">Envíos aceptados en rango {{data.desde}} a {{data.hasta}} (America/Santiago), por cartera vigente. Avances detectados hasta {{fechaRecordatorio(data.corteAvances)}}. Esto no demuestra causalidad.</p>
   <p class="text-xs">Stock actual al corte {{fechaRecordatorio(data.calculadoEn)}} (America/Santiago): pendientes, en proceso, diferidos, errores, inciertos y cancelados; no reconstruye stock histórico. Diferidos están incluidos en errores; inciertos pueden superponerse.</p>
   <p class="text-xs">Instrumentación desde {{fechaRecordatorio(data.instrumentacionDesde)}} (America/Santiago). Alumnos únicos por etapa; subtotales por origen y canal se superponen y no deben sumarse.</p>
   <p v-if="data.operacion" class="text-xs">Modo persistido: {{data.operacion.modo}} · Snapshot confirmado: {{fechaRecordatorio(data.operacion.snapshot_en)}} · {{data.operacion.bloqueo_global?'Bloqueo global legacy: requiere evidencia':'Sin bloqueo global legacy registrado'}} · Casos bloqueados en cartera: {{data.operacion.casos_bloqueados}}.</p>
   <p v-if="!data.filas?.length">Sin recordatorios registrados para este período/cartera. Sin medición de avance si no hubo instrumentación.</p>
   <div class="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
    <article v-for="r in data.filas??[]" :key="`${r.etapa}-${r.canal}-${r.origen}`" class="min-w-0 space-y-1 rounded border p-3 text-sm [overflow-wrap:anywhere]">
     <h3 class="font-semibold">{{etapaRecordatorio(r.etapa)}} · {{r.canal??'Todos los canales'}} · {{r.origen==='todos'?'Total por etapa':r.origen==='legacy'?'Legado conciliado':'Motor por etapa'}}</h3>
     <p>Enviados (rango): {{r.enviados}} · Alumnos únicos: {{r.alumnos_con_envio}}</p>
     <p>Stock: {{r.pendientes}} pendientes · {{r.procesando}} en proceso · {{r.diferidos}} diferidos · {{r.errores}} errores · {{r.cancelados}} cancelados · {{r.inciertos}} inciertos</p>
     <p v-if="r.avanzaron_despues===null">Avanzaron después: sin medición histórica</p>
     <p v-else>Avanzaron después (detectado, no atribución): {{r.avanzaron_despues}} de {{r.alumnos_con_envio}} alumnos con envío; {{r.medibles}} medibles <span v-if="r.sin_medicion">· {{r.sin_medicion}} sin medición histórica, cobertura parcial (sin tasa)</span>.</p>
    </article>
   </div>
  </template>
 </section>
</template>
