import {it,expect,vi,afterEach} from 'vitest'
vi.mock('./seguimientoRematriculaApi',()=>({headersSesion:()=>({'X-Mol-Email':'autor@uniacc.cl','X-Mol-Codigo-Perfil':'3'})}))
import {getMetricas,csvMetricas} from './seguimientoMetricasApi'
afterEach(()=>vi.unstubAllGlobals())
it('filtra autor explícito y conserva 403 como error, no como ceros',async()=>{
 const request=vi.fn().mockResolvedValue({ok:false,status:403,json:async()=>({ok:false,message:'Denegado'})});vi.stubGlobal('fetch',request)
 const r=await getMetricas('resumen',{anio:2027,semestre:1,desde:'2026-11-01',hasta:'2026-11-07',autor:'autor@uniacc.cl'})
 expect(r.data).toBeNull();expect(r.error).toBe('Denegado');expect(String(request.mock.calls[0][0])).toContain('autor=autor%40uniacc.cl');expect(String(request.mock.calls[0][0])).not.toContain('emailEjecutivo');expect(request.mock.calls[0][1].headers['X-Mol-Email']).toBe('autor@uniacc.cl')
})
it('CSV agrega sin cuerpos ni datos de alumnos y neutraliza fórmulas',()=>{
 const c:any={autor:'+formula@uniacc.cl',contactos:1,casosContactados:1,canales:{correo:1},respuesta:{tasa:null,numerador:0,denominador:0,historicos:1},pendientes:0,vencidas:0,completadas:0,canceladas:0,matriculadosDetectados:null}
 const text=csvMetricas({anio:2027,semestre:1,desde:'2026-11-01',hasta:'2026-11-07',calculadoEn:'2026-11-07',consejeros:[c]} as any)
 expect(text).toContain("'+formula@uniacc.cl");expect(text).toContain('N/D');expect(text).not.toContain('codcli');expect(text).not.toContain('comentario')
})
