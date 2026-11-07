/** Borradores efímeros de esta pestaña; nunca credenciales/archivos ni localStorage. */
export function claveBorrador(actor:string|null|undefined,codcli:string,anio:number,semestre:number,canal:string):string|null {
 return actor?.trim()?`mol.seguimiento.borrador.v1:${encodeURIComponent(actor.trim().toLowerCase())}:${encodeURIComponent(codcli)}:${anio}:${semestre}:${canal}`:null
}
export function guardarBorrador(key:string|null,data:Record<string,unknown>,storage:Storage=sessionStorage,ahora=Date.now()):void {
 if(!key)return;try{const value=JSON.stringify({at:ahora,data});if(value.length<=100_000)storage.setItem(key,value)}catch{/* Cuota/privacidad: formulario en memoria. */}
}
export function leerBorrador(key:string|null,storage:Storage=sessionStorage,ahora=Date.now()):Record<string,unknown>|null {
 if(!key)return null;try{const raw=storage.getItem(key);if(!raw)return null;const v=JSON.parse(raw);if(!Number.isFinite(v.at)||ahora-v.at>86_400_000||v.at>ahora||!v.data||typeof v.data!=='object'){storage.removeItem(key);return null}return v.data}catch{return null}
}
export function borrarBorrador(key:string|null,storage:Storage=sessionStorage):void{if(key)try{storage.removeItem(key)}catch{/* Sin persistencia disponible. */}}
