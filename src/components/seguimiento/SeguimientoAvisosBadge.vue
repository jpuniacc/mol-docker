<script setup lang="ts">
import {computed,onMounted,onUnmounted,watch} from 'vue'
import {useAuthStore} from '@/stores/auth'
import {usePeriodoActivoStore} from '@/stores/periodoActivo'
import {useSeguimientoAvisosStore} from '@/stores/seguimientoAvisos'
const periodo=usePeriodoActivoStore(),auth=useAuthStore(),store=useSeguimientoAvisosStore()
const scope=computed(()=>({anio:periodo.anio??0,semestre:periodo.semestre??0}))
const entry=computed(()=>store.resultado(scope.value))
const title=computed(()=>entry.value?.data?`${entry.value.data.pendientes} pendientes: ${entry.value.data.vencidas} vencidas y ${entry.value.data.hoy} para hoy (America/Santiago)`:'Agenda no disponible')
async function cargar(){if(periodo.anio&&periodo.semestre&&auth.email)await store.cargar(scope.value)}
watch(()=>[periodo.anio,periodo.semestre,auth.email,auth.perfil?.codigo_perfil_usuario,store.revision],()=>{void cargar()},{immediate:true})
let timer:ReturnType<typeof setInterval>|undefined
onMounted(()=>{void periodo.ensureLoaded();timer=setInterval(()=>{void cargar()},60_000)})
onUnmounted(()=>{if(timer)clearInterval(timer)})
</script>
<template>
 <span v-if="!entry?.data || entry.data.pendientes>0" :title="title" :aria-label="title" class="ml-auto inline-flex min-w-5 shrink-0 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold" :class="!entry?.data ? 'bg-zinc-100 text-zinc-600' : entry.data.vencidas>0 ? 'bg-red-100 text-red-800' : entry.data.hoy>0 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'">{{ entry?.data ? (entry.data.pendientes>99?'99+':entry.data.pendientes) : '—' }}</span>
</template>
