import type {RecordatorioEtapa} from '@/types/recordatoriosEtapa'
export function etapaRecordatorio(e:string){return ({ingreso:'Ingreso',tyc:'TyC',datos:'Datos',forma_pago:'Forma de pago',firma:'Firma',matriculado:'Matriculado'} as Record<string,string>)[e]??e}
export function fechaRecordatorio(s:string|null|undefined){if(!s)return 'No registrado';const d=new Date(s);return Number.isNaN(d.getTime())?'Fecha no disponible':d.toLocaleString('es-CL',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
export function estadoRecordatorio(r:RecordatorioEtapa){
 if(r.resultado_incierto&&r.estado==='cancelado')return {label:'Cancelado · Resultado incierto · no reenviar',clase:'border-zinc-300 bg-zinc-100 text-red-800'}
 if(r.resultado_incierto)return {label:'Resultado incierto · no reenviar',clase:'border-red-300 bg-red-50 text-red-800'}
 const estados:Record<string,{label:string;clase:string}>={enviado:{label:'Enviado',clase:'border-green-300 bg-green-50 text-green-800'},pendiente:{label:'Pendiente',clase:'border-amber-300 bg-amber-50 text-amber-900'},procesando:{label:'En proceso',clase:'border-blue-300 bg-blue-50 text-blue-800'},cancelado:{label:'Cancelado',clase:'border-zinc-300 bg-zinc-100 text-zinc-600'},error:{label:r.reintento_at?'Diferido · reintento pendiente':'Error',clase:'border-red-300 bg-red-50 text-red-800'}}
 return estados[r.estado]??{label:'Estado no disponible',clase:'border-zinc-300 text-zinc-600'}
}
/** Preserve raw identity strings. A correlated contact log and its outbox are one timeline event. */
export function timelineRecordatorios<T extends {id:string;outbox_id?:string|null}>(bitacora:T[],records:RecordatorioEtapa[]){
 const unicos=[...new Map(records.map(r=>[r.id,r])).values()],ids=new Set(unicos.map(r=>r.id))
 return [...bitacora.filter(e=>!e.outbox_id||!ids.has(e.outbox_id)),...unicos.map(r=>({id:`recordatorio:${r.id}`,outbox_id:r.id,recordatorio_etapa:r,canal:r.canal,origen:'auto',autor_email:r.consejero??'Sistema',nota:null,resultado:null,proxima_accion:null,proxima_accion_en:null,created_at:r.enviado_at??r.programado_para}))]
}

/** Same safe historical codes as the API allowlist; never display unknown provider/contact text. */
export function motivoCancelacionRecordatorio(code:string|null|undefined){
 const labels:Record<string,string>={etapa_o_elegibilidad_cambio:'La etapa o elegibilidad cambió',firma_completa:'Firma completa',espera_cae_o_ministerial:'En espera de CAE o beca ministerial',matriculado_bo:'Matriculado por BackOffice',conflicto_mol_bo:'Matriculado en MOL y BackOffice'}
 return code&&Object.prototype.hasOwnProperty.call(labels,code)?labels[code]:'Motivo no disponible'
}
