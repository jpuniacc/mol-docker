import {test,expect} from 'vitest'
const mods=import.meta.glob('./seguimientoRecordatorios.ts')
test('timeline has one event per outbox id and removes correlated log; no Date roundtrip of stage identity',async()=>{
 expect(mods['./seguimientoRecordatorios.ts']).toBeTypeOf('function');const api:any=await mods['./seguimientoRecordatorios.ts']!()
 const r:any={id:'one',etapa:'datos',canal:'correo',estado:'enviado',etapa_desde:'2026-11-01 00:00:00.123456+00',programado_para:'2026-11-02T12:00:00Z',enviado_at:'2026-11-03T12:00:00Z'}
 const events=api.timelineRecordatorios([{id:'log',outbox_id:'one'},{id:'manual',canal:'nota'}],[r,r]);expect(events).toHaveLength(2);expect(events.some((x:any)=>x.id==='log')).toBe(false);expect(events.find((x:any)=>x.outbox_id==='one').recordatorio_etapa.etapa_desde).toBe(r.etapa_desde)
})
test('cancelled uncertain remains visibly cancelled and grey, never implies failed/no send',async()=>{
 const a:any=await mods['./seguimientoRecordatorios.ts']!();const s=a.estadoRecordatorio({estado:'cancelado',resultado_incierto:true});expect(s.label).toContain('Cancelado');expect(s.label).toContain('incierto');expect(s.clase).toContain('bg-zinc')
})
