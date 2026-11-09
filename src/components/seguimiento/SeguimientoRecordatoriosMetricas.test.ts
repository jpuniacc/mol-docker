import {test,expect} from 'vitest'
import {mount} from '@vue/test-utils'
const mods=import.meta.glob('./SeguimientoRecordatoriosMetricas.vue')
test('automatic panel separates actual stock/range; unknown legacy is not historical zero or causal attribution',async()=>{
 expect(mods['./SeguimientoRecordatoriosMetricas.vue']).toBeTypeOf('function');const c:any=(await mods['./SeguimientoRecordatoriosMetricas.vue']!() as any).default
 const w=mount(c,{props:{data:{disponible:false,filas:null}}});expect(w.text()).toContain('No disponible')
 await w.setProps({data:{disponible:true,instrumentacionDesde:null,calculadoEn:'2026-11-09T01:00:00Z',desde:'2026-11-01',hasta:'2026-11-08',filas:[{etapa:'datos',canal:null,origen:'legacy',enviados:1,alumnos_con_envio:1,medibles:0,avanzaron_despues:null,sin_medicion:1,pendientes:0,procesando:0,errores:0,cancelados:0,inciertos:0,diferidos:0}]}})
 expect(w.text()).toContain('sin medición histórica');expect(w.text()).toContain('Stock actual');expect(w.text()).toContain('no demuestra causalidad');expect(w.text()).toContain('Todos los canales');expect(w.text()).not.toContain('0%')
 const data:any=(w.props() as any).data;await w.setProps({data:{...data,filas:[...data.filas,{...data.filas[0],origen:'todos'}]}});expect(w.text()).toContain('Total por etapa')
})
