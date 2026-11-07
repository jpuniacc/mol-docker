<script setup lang="ts">
import type { FilaBandejaSeguimiento } from '@/services/seguimientoRematriculaApi'
import { ETIQUETA_CHIP_BANDEJA } from '@/utils/seguimientoBandejaChip'
import SeguimientoProximaAccion from './SeguimientoProximaAccion.vue'
defineProps<{fila:FilaBandejaSeguimiento}>()
const emit=defineEmits<{abrir:[fila:FilaBandejaSeguimiento]}>()
</script>
<template><article class="min-w-0 space-y-3 rounded-lg border bg-white p-4 [overflow-wrap:anywhere]">
 <h3 class="font-semibold text-[#1E3A5F]">{{fila.nombre_alumno || 'Sin nombre'}}</h3>
 <p class="text-sm text-zinc-600">{{fila.nombre_carrera || 'Sin carrera informada'}}</p>
 <span class="inline-block rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">{{ETIQUETA_CHIP_BANDEJA[fila.chip]}}</span>
 <p class="text-xs text-zinc-500">Último contacto: {{fila.ultimo_contacto ? new Date(fila.ultimo_contacto).toLocaleString('es-CL',{timeZone:'America/Santiago'}) : 'Sin contacto'}} <span v-if="fila.ultimo_contacto">· {{fila.ultimo_contacto_canal}}</span></p>
 <SeguimientoProximaAccion :at="fila.proxima_accion_at" :canales="fila.proxima_accion_canales" :comentario="fila.proxima_accion_comentario" :legacy="fila.proxima_accion" />
 <button type="button" class="min-h-11 w-full rounded-md border px-4 text-sm font-semibold text-[#1E3A5F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600" :aria-label="`Abrir caso de ${fila.nombre_alumno || fila.codcli}`" @click="emit('abrir',fila)">Abrir caso</button>
</article></template>
