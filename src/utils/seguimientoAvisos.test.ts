import {describe,it,expect} from 'vitest'
import {esAccionVencida} from './seguimientoNota'
describe('vencimiento aprobado por día de Santiago',()=>{
 it('no vence durante el mismo día aunque haya pasado la hora',()=>expect(esAccionVencida('2026-11-07T08:00:00-03:00',new Date('2026-11-07T23:59:00-03:00'))).toBe(false))
 it('vence al cambiar el día local',()=>expect(esAccionVencida('2026-11-07T08:00:00-03:00',new Date('2026-11-08T00:00:00-03:00'))).toBe(true))
})
