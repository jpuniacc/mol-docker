import {it,expect} from 'vitest'
import {mount} from '@vue/test-utils'
it('N/D histórico no se muestra como cero por ciento y atribuye al autor',async()=>{
 const load=import.meta.glob('./MetricasResumen.vue')['./MetricasResumen.vue'];expect(load).toBeTypeOf('function');if(!load)return;const m=await load() as any
 const w=mount(m.default,{props:{data:{contactos:3,casosContactados:2,canales:{correo:2,sms:1,whatsapp:0,llamada:0,nota:0,otros:0},pendientes:1,vencidas:0,completadas:0,canceladas:0,matriculadosDetectados:null,respuesta:{tasa:null,historicos:3,cobertura:0,numerador:0,denominador:0,parcial:false},instrumentacionDesde:'2026-11-07T23:00:00Z'}}})
 expect(w.text()).toContain('N/D');expect(w.text()).toContain('autor del contacto');expect(w.text()).toContain('Stock actual');expect(w.text()).not.toContain('0% de respuesta')
})
