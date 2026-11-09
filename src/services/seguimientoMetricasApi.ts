export type {MetricasRecordatorios} from '@/types/recordatoriosEtapa'
import {admisionApiBaseUrl} from '@/constants/admisionApi'
import {headersSesion} from './seguimientoRematriculaApi'
export type CanalMetrica='correo'|'sms'|'whatsapp'|'llamada'|'nota'|'otros'
export type RespuestaMetrica={tasa:number|null;numerador:number;denominador:number;historicos:number;cobertura:number;parcial:boolean}
export type FilaMetrica={autor:string;contactos:number;casosContactados:number;canales:Record<CanalMetrica,number>;pendientes:number;vencidas:number;hoy:number;completadas:number;canceladas:number;matriculadosActuales:number;matriculadosDetectados:number|null;respuesta:RespuestaMetrica}
export type ResumenMetricas=Omit<FilaMetrica,'autor'>&{autor:string|null;anio:number;semestre:number;desde:string;hasta:string;calculadoEn:string;instrumentacionDesde:string;progresoActualizadoEn:string|null;atribucion:'autor_contacto';zona:'America/Santiago';serie:{dia:string;contactos:number}[];consejeros:FilaMetrica[]}
export type ScopeMetricas={anio:number;semestre:number;desde:string;hasta:string;autor?:string}
export async function getMetricas<T>(endpoint:string,scope:ScopeMetricas,extra:Record<string,string>={}):Promise<{data:T|null;error:string|null}>{
 const params=new URLSearchParams({anio:String(scope.anio),semestre:String(scope.semestre),desde:scope.desde,hasta:scope.hasta,...(scope.autor?{autor:scope.autor}:{}),...extra}),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000)
 // Autor explícito: NO usar urlConCarteraEjecutivo (es filtro de dueño vigente).
 try{const response=await fetch(`${admisionApiBaseUrl()}/api/rematricula/seguimiento/metricas/${endpoint}?${params}`,{headers:headersSesion(),signal:controller.signal});const body=await response.json();if(!response.ok||body.ok!==true)return {data:null,error:body.message||`Error HTTP ${response.status}`};return {data:body as T,error:null}}catch(e){return {data:null,error:e instanceof Error?e.message:'Error de red'}}finally{clearTimeout(timer)}
}
export function csvMetricas(data:ResumenMetricas){
 const cell=(v:unknown)=>'"'+String(v??'N/D').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"'
 const lines:any[][]=[['Métricas por autor del contacto','America/Santiago',data.anio,data.semestre,data.desde,data.hasta,'Corte stock',data.calculadoEn],['Autor','Contactos','Casos distintos (no sumables entre autores)','Correo','SMS','WhatsApp','Llamada','Nota','Otros','Respuesta % (manual 7 días)','Respuestas','Salientes medidos','Históricos N/D','Stock pendientes','Stock vencidas','Completadas en rango','Canceladas en rango','Hitos observados en rango']]
 for(const r of data.consejeros)lines.push([r.autor,r.contactos,r.casosContactados,...(['correo','sms','whatsapp','llamada','nota','otros'] as CanalMetrica[]).map(c=>r.canales[c]),r.respuesta.tasa,r.respuesta.numerador,r.respuesta.denominador,r.respuesta.historicos,r.pendientes,r.vencidas,r.completadas,r.canceladas,r.matriculadosDetectados])
 return '\uFEFF'+lines.map(row=>row.map(cell).join(';')).join('\r\n')
}
