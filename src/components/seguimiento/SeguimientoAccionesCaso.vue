<script setup lang="ts">
import {computed} from 'vue'
import type {ContactoSeguimiento} from '@/services/seguimientoRematriculaApi'
import SeguimientoProximaAccion from './SeguimientoProximaAccion.vue'
const props=defineProps<{acciones:ContactoSeguimiento[];ocupado?:string|null;error?:string|null}>()
const emit=defineEmits<{gestionar:[payload:{id:string;estado:'completada'|'cancelada'}]}>()
const ordenadas=computed(()=>props.acciones.filter(a=>a.proxima_accion_at||a.proxima_accion_en).slice().sort((a,b)=>String(a.proxima_accion_at||a.proxima_accion_en).localeCompare(String(b.proxima_accion_at||b.proxima_accion_en))))
</script>
<template>
 <section aria-label="Agenda del caso" class="space-y-2">
  <h3 class="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Próximas acciones del caso</h3>
  <p v-if="error" role="alert" class="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{{ error }}</p>
  <p v-if="!ordenadas.length" class="text-xs text-zinc-500">Sin acciones programadas.</p>
  <div v-for="a in ordenadas" :key="a.id" class="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
   <SeguimientoProximaAccion :at="a.proxima_accion_at||a.proxima_accion_en" :canales="a.proxima_accion_canales" :comentario="a.proxima_accion_comentario" :legacy="a.proxima_accion" :estado="a.proxima_accion_estado" />
   <div v-if="!a.proxima_accion_estado || a.proxima_accion_estado==='pendiente'" class="mt-2 flex flex-wrap gap-2">
    <button type="button" class="rounded border border-green-200 bg-white px-2 py-1 text-xs text-green-800 disabled:opacity-50" :disabled="Boolean(ocupado)" @click="emit('gestionar',{id:a.id,estado:'completada'})">Completar</button>
    <button type="button" class="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 disabled:opacity-50" :disabled="Boolean(ocupado)" @click="emit('gestionar',{id:a.id,estado:'cancelada'})">Cancelar acción</button>
   </div>
   <p v-else-if="a.proxima_accion_gestionada_por" class="mt-1 break-words text-[11px] text-zinc-500">Gestionada por {{ a.proxima_accion_gestionada_por }}</p>
  </div>
 </section>
</template>
