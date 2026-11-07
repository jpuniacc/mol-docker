import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchResumenAcciones,type ScopeAcciones,type ResumenAcciones } from '@/services/seguimientoRematriculaApi'
type Entrada={data:ResumenAcciones|null;error:string|null;at:number}
export const useSeguimientoAvisosStore=defineStore('seguimientoAvisos',()=>{
 const entradas=ref<Record<string,Entrada>>({}),revision=ref(0)
 const pendientes=new Map<string,Promise<void>>()
 function clave(scope:ScopeAcciones){const auth=useAuthStore();return [auth.email,auth.perfil?.codigo_perfil_usuario,scope.anio,scope.semestre,scope.emailEjecutivoOverride?.trim().toLowerCase()??''].join('|')}
 function resultado(scope:ScopeAcciones):Entrada|undefined{return entradas.value[clave(scope)]}
 async function cargar(scope:ScopeAcciones,force=false):Promise<void>{
  const key=clave(scope),prev=entradas.value[key]
  if(pendientes.has(key))return pendientes.get(key)
  if(!force&&prev&&Date.now()-prev.at<60_000)return
  const epoch=revision.value
  const job=fetchResumenAcciones(scope).then(r=>{if(revision.value===epoch)entradas.value[key]={...r,at:Date.now()}})
   .catch(()=>{if(revision.value===epoch)entradas.value[key]={data:null,error:'Agenda no disponible',at:Date.now()}})
   .finally(()=>{if(pendientes.get(key)===job)pendientes.delete(key)})
  pendientes.set(key,job);return job
 }
 function invalidar(){revision.value++;entradas.value={};pendientes.clear()}
 return {revision,cargar,resultado,invalidar}
})
