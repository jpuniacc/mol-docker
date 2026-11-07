import { describe,it,expect } from 'vitest'
import { fechaHoraChileInput, fechaHoraChileIso, prepararNotaFormulario, esAccionVencida } from './seguimientoNota'
describe('nota y agenda Chile',()=>{
 it('muestra y convierte verano e invierno independiente de la zona del navegador',()=>{
  expect(fechaHoraChileInput('2026-11-07T17:15:00Z')).toBe('2026-11-07T14:15')
  expect(fechaHoraChileIso('2026-11-07T14:15')).toBe('2026-11-07T17:15:00.000Z')
  expect(fechaHoraChileIso('2026-07-07T14:15')).toBe('2026-07-07T18:15:00.000Z')
 })
 it('rechaza fecha imposible y hora inexistente en cambio horario',()=>{
  expect(fechaHoraChileIso('2026-02-30T12:00')).toBeNull()
  expect(fechaHoraChileIso('2026-09-06T00:30')).toBeNull()
  expect(fechaHoraChileIso('bad')).toBeNull()
 })
 it('exige comentario y agenda completa solo si se inicia la tarjeta opcional',()=>{
  const base={fecha_contacto:'2026-11-07T14:15',canal:'llamada',nota:'Contesto',proxima_fecha:'',proxima_canales:[] as string[],proxima_comentario:''}
  expect(prepararNotaFormulario(base).error).toBeNull()
  expect(prepararNotaFormulario({...base,nota:'  '}).error).toMatch(/comentario/i)
  expect(prepararNotaFormulario({...base,proxima_comentario:'Confirmar'}).error).toMatch(/fecha/i)
  expect(prepararNotaFormulario({...base,proxima_fecha:'2026-11-10T10:00'}).error).toMatch(/canal/i)
  const listo=prepararNotaFormulario({...base,proxima_fecha:'2026-11-10T10:00',proxima_canales:['llamada','sms']})
  expect(listo.error).toBeNull();expect(listo.data?.proxima_accion_at).toBe('2026-11-10T13:00:00.000Z')
 })
 it('marca vencida sin depender de la zona local',()=>{
  const now=new Date('2026-11-07T17:00:00Z')
  expect(esAccionVencida('2026-11-07T16:00:00Z',now)).toBe(false)
  expect(esAccionVencida('2026-11-06T16:00:00Z',now)).toBe(true)
  expect(esAccionVencida('2026-11-07T18:00:00Z',now)).toBe(false)
  expect(esAccionVencida(null,now)).toBe(false)
 })
})
