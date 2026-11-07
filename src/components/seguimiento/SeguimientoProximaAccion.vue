<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { CANALES_ACCION, esAccionVencida, etiquetaFechaChile } from '@/utils/seguimientoNota'
const props = defineProps<{ at?: string | null; canales?: string[]; comentario?: string | null; legacy?: string | null; estado?: 'pendiente' | 'completada' | 'cancelada' }>()
const ahora = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { ahora.value = new Date() }, 60000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
const vencida = computed(() => (!props.estado || props.estado==='pendiente') && esAccionVencida(props.at, ahora.value))
</script>
<template>
  <div v-if="at" class="min-w-0 space-y-1 break-words text-xs [overflow-wrap:anywhere]" :class="vencida ? 'text-red-700' : 'text-zinc-700'">
    <p v-if="estado && estado!=='pendiente'" class="font-semibold text-zinc-600">{{ estado==='completada' ? 'Completada' : 'Cancelada' }}</p>
    <p class="font-medium">{{ etiquetaFechaChile(at) }} (Chile) <span v-if="vencida" class="font-semibold">· Vencida</span></p>
    <div v-if="canales?.length" class="flex flex-wrap gap-1">
      <span v-for="canal in canales" :key="canal" class="rounded-full border px-2 py-0.5" :class="vencida ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-zinc-50'">{{ CANALES_ACCION.find(c => c.value === canal)?.label || canal }}</span>
    </div>
    <p v-if="comentario" class="whitespace-pre-line">{{ comentario }}</p>
    <p v-else-if="!canales?.length && legacy" class="whitespace-pre-line">{{ legacy }}</p>
  </div>
  <p v-else class="break-words text-xs text-zinc-600 [overflow-wrap:anywhere]">{{ legacy || '—' }}</p>
</template>
