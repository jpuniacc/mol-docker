// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import SeguimientoCasoDrawer from './SeguimientoCasoDrawer.vue'
import type { CasoSeguimientoDetalle, ContactoSeguimiento } from '@/services/seguimientoRematriculaApi'
vi.mock('@/components/seguimiento/SeguimientoComposerCorreo.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/seguimiento/SeguimientoComposerSms.vue', () => ({ default: { template: '<div />' } }))
const caso: CasoSeguimientoDetalle = {
 codcli:'A1', rut:'11111111-1', rut_norm:'111111111', nombre_alumno:'Alumno ejemplo', nombre_carrera:'Carrera',
 chip:'contrato_pdte', subetapa_forma_pago:null, mat_webpay_fecha:null, mail_2h:'n/a', sms_24h:'n/a',
 mail_2h_sent_at:null, sms_24h_sent_at:null, ultimo_contacto:null, ultimo_contacto_canal:null, proxima_accion:null,
 email_ejecutivo:'consejero@uniacc.cl', ejecutivo_nombre:'Nombre Consejero', email_alumno:'alumno@example.test', telefono:'964255300',
 firma_completa:false, firmantes_resumen:null, medios_pago_resumen:null,
 firmantes_detalle:{alumno:'pendiente',sostenedor:'no_aplica'}, medios_pago_detalle:{matricula:'Webpay (pagado)',arancel:'Pendiente'},
}
const bitacora: ContactoSeguimiento[] = Array.from({length:35},(_,i)=>({
 id:String(i),canal:i<12?'sms':'correo',origen:'manual',autor_email:'consejero@uniacc.cl',nota:`Evento ${i}`,
 resultado:null,proxima_accion:null,proxima_accion_en:null,created_at:new Date(Date.now()-i*1000).toISOString(),
}))
function montar() {
 return shallowMount(SeguimientoCasoDrawer, {props:{caso:{...caso},bitacora,anio:2027,semestre:1},
 global:{renderStubDefaultSlot:true,stubs:{Teleport:true,Button:{template:'<button><slot /></button>'}}}})
}
describe('drawer timeline integrado',()=>{
 beforeEach(()=>localStorage.clear())
 it('renderiza propiedades estructuradas y solo diez eventos de todo el historial',()=>{
  const w=montar()
  expect(w.text()).toContain('+56 9 6425 5300')
  expect(w.text()).toContain('Alumno · pendiente')
  expect(w.text()).toContain('Sostenedor: no aplica')
  expect(w.text()).toContain('Matrícula: Webpay (pagado)')
  expect(w.text()).toContain('Arancel: Pendiente')
  expect(w.text()).toContain('Nombre Consejero')
  expect(w.text()).toContain('consejero@uniacc.cl')
  expect(w.text()).toContain('10 de 35 eventos')
  expect(w.findAll('p').filter(p=>/^Evento \d+$/.test(p.text()))).toHaveLength(10)
  expect(w.get('[role="group"]').classes()).toContain('flex-wrap')
  w.unmount()
 })
 it('pagina, reinicia al filtrar y recuerda el filtro al reabrir',async()=>{
  let w=montar()
  await w.findAll('button').find(b=>b.text()==='Ver 25 anteriores')!.trigger('click')
  expect(w.text()).toContain('20 de 35 eventos')
  await w.findAll('button').find(b=>b.text()==='SMS 12')!.trigger('click')
  expect(w.text()).toContain('10 de 12 eventos')
  expect(w.findAll('button').find(b=>b.text()==='SMS 12')!.attributes('aria-pressed')).toBe('true')
  w.unmount()
  w=montar()
  expect(w.text()).toContain('10 de 12 eventos')
  await w.findAll('button').find(b=>b.text()==='Ver 2 anteriores')!.trigger('click')
  expect(w.text()).toContain('12 de 12 eventos')
  await w.setProps({caso:{...caso,codcli:'A2'}})
  expect(w.text()).toContain('10 de 12 eventos')
  await w.findAll('button').find(b=>b.text()==='WhatsApp 0')!.trigger('click')
  expect(w.text()).toContain('Sin eventos de este tipo')
  w.unmount()
 })
})
