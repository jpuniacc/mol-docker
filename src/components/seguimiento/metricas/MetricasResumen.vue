<script setup lang="ts">
import type {ResumenMetricas} from '@/services/seguimientoMetricasApi'
defineProps<{data:ResumenMetricas}>()
</script>
<template>
 <section aria-label="Resumen de métricas" class="space-y-5">
  <p class="rounded-lg bg-blue-50 p-3 text-sm">Atribución: autor del contacto, no dueño vigente. Respuestas registradas manualmente; no se infieren desde pagos, lecturas ni envíos.</p>
  <h2 class="font-semibold">Flujos del rango seleccionado</h2>
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
   <article class="rounded-lg border p-4"><h3>Contactos manuales</h3><strong class="text-2xl">{{data.contactos}}</strong><p class="text-xs">{{data.casosContactados}} casos distintos</p></article>
   <article class="rounded-lg border p-4"><h3>Tasa de respuesta</h3><strong class="text-2xl">{{data.respuesta.tasa===null?'N/D':`${data.respuesta.tasa}%`}}</strong><p class="text-xs">{{data.respuesta.numerador}} / {{data.respuesta.denominador}} contactos salientes medidos · ventana 7 días locales</p><p v-if="data.respuesta.parcial" class="text-xs text-amber-700">Cohorte parcial: hay ventanas abiertas</p></article>
   <article class="rounded-lg border p-4"><h3>Completadas / canceladas</h3><strong class="text-2xl">{{data.completadas}} / {{data.canceladas}}</strong><p class="text-xs">Fecha de gestión, no creación</p></article>
   <article class="rounded-lg border p-4"><h3>Movidos a matriculado</h3><strong class="text-2xl">{{data.matriculadosDetectados??'N/D'}}</strong><p class="text-xs">Primer hito observado; no fecha ERP ni atribución causal. Autor del último contacto previo.</p></article>
  </div>
  <p class="text-xs text-zinc-600">Cobertura respuesta: {{data.respuesta.cobertura}}% · {{data.respuesta.historicos}} salientes históricos sin medición (N/D). Sin vínculo, una respuesta no afecta la tasa. Notas/presencial no son salientes medibles.</p>
  <h2 class="font-semibold">Stock actual (independiente del rango)</h2>
  <p class="text-sm">Casos actualmente matriculados con contactos de este autor: <strong>{{data.matriculadosActuales??0}}</strong> (casos únicos; no sumables entre autores).</p>
  <div class="grid grid-cols-3 gap-2"><article class="rounded-lg border p-3">Pendientes <strong class="block text-xl">{{data.pendientes}}</strong></article><article class="rounded-lg border p-3">Vencidas <strong class="block text-xl">{{data.vencidas}}</strong></article><article class="rounded-lg border p-3">Del día <strong class="block text-xl">{{data.hoy}}</strong></article></div>
 </section>
</template>
