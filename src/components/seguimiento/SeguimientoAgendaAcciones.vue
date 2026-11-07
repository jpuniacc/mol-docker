<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {useAuthStore} from '@/stores/auth'
import {useSeguimientoAvisosStore} from '@/stores/seguimientoAvisos'
import {fetchListaAcciones,type ScopeAcciones,type AccionAgenda} from '@/services/seguimientoRematriculaApi'
import {etiquetaFechaChile} from '@/utils/seguimientoNota'
const props=defineProps<{scope:ScopeAcciones}>()
const emit=defineEmits<{abrir:[caso:{codcli:string}]}>()
const store=useSeguimientoAvisosStore(),auth=useAuthStore()
const entry=computed(()=>store.resultado(props.scope))
const grupo=ref<'vencidas'|'hoy'|'todas'|null>(null),page=ref(0),rows=ref<AccionAgenda[]>([]),total=ref(0),error=ref<string|null>(null),loading=ref(false)
let sequence=0
async function cargar(){
 const seq=++sequence
 await store.cargar(props.scope)
 if(!grupo.value){rows.value=[];return}
 loading.value=true;error.value=null
 const r=await fetchListaAcciones(props.scope,grupo.value,page.value*20)
 if(seq!==sequence)return
 error.value=r.error;rows.value=r.data;total.value=r.total;loading.value=false
}
function seleccionar(value:'vencidas'|'hoy'|'todas'){page.value=0;grupo.value=grupo.value===value?null:value}
watch(()=>[props.scope.anio,props.scope.semestre,props.scope.emailEjecutivoOverride,auth.email,auth.perfil?.codigo_perfil_usuario,store.revision],()=>{page.value=0;void cargar()},{immediate:true})
watch(()=>[grupo.value,page.value],()=>{void cargar()})
let timer:ReturnType<typeof setInterval>|undefined
onMounted(()=>{timer=setInterval(()=>{void cargar()},60_000)})
onUnmounted(()=>{sequence++;if(timer)clearInterval(timer)})
</script>
<template>
 <section aria-label="Agenda de próximas acciones" class="mb-4 rounded-xl border border-zinc-200 bg-white p-3">
  <div class="flex flex-wrap items-center gap-2">
   <h2 class="mr-2 text-sm font-semibold text-[#1E3A5F]">Próximas acciones</h2>
   <button type="button" class="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800" :aria-pressed="grupo==='vencidas'" @click="seleccionar('vencidas')">Vencidas {{ entry?.data?.vencidas ?? '—' }}</button>
   <button type="button" class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800" :aria-pressed="grupo==='hoy'" @click="seleccionar('hoy')">Hoy {{ entry?.data?.hoy ?? '—' }}</button>
   <button type="button" class="rounded-full border px-3 py-1 text-xs" :aria-pressed="grupo==='todas'" @click="seleccionar('todas')">Todas las pendientes {{ entry?.data?.pendientes ?? '—' }}</button>
  </div>
  <p class="mt-1 text-[11px] text-zinc-500">Vencen al terminar su día en America/Santiago. Incluye pendientes históricas.</p>
  <p v-if="entry?.error" role="status" class="mt-1 text-xs text-red-700">Agenda no disponible: {{ entry.error }}</p>
  <div v-if="grupo" class="mt-3 space-y-2">
   <p v-if="error" role="alert" class="text-xs text-red-700">{{ error }}</p>
   <p v-if="loading" class="text-xs text-zinc-500">Cargando acciones…</p>
   <p v-else-if="!rows.length&&!error" class="text-xs text-zinc-500">No hay acciones en este filtro.</p>
   <button v-for="a in rows" :key="a.id" type="button" class="block w-full rounded-lg border border-zinc-200 p-2 text-left text-xs hover:bg-zinc-50" @click="emit('abrir',{codcli:a.codcli})">
    <span class="font-semibold">{{ a.nombre_alumno || a.codcli }}</span> · {{ etiquetaFechaChile(a.at) }} (Chile)
    <span class="mt-1 block text-zinc-500">{{ a.canales.join(' + ') }} <span v-if="a.comentario">· {{ a.comentario }}</span></span>
   </button>
   <div class="flex items-center justify-end gap-2 text-xs">
    <span>{{ total }} acciones · página {{ page+1 }}</span>
    <button type="button" class="rounded border px-2 py-1 disabled:opacity-40" :disabled="!page||loading" @click="page--">Anterior</button>
    <button type="button" class="rounded border px-2 py-1 disabled:opacity-40" :disabled="(page+1)*20>=total||loading" @click="page++">Siguiente</button>
   </div>
  </div>
 </section>
</template>
