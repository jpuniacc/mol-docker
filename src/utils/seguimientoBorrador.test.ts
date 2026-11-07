import {it,expect} from 'vitest'
it('borrador sessionStorage separado por usuario/caso/período/canal y expira',async()=>{
 const load=import.meta.glob('./seguimientoBorrador.ts')['./seguimientoBorrador.ts'];expect(load).toBeTypeOf('function');if(!load)return;const m=await load() as any
 const s=sessionStorage;s.clear();const k=m.claveBorrador('a@uniacc.cl','C1',2027,1,'sms')!
 m.guardarBorrador(k,{texto:'Borrador'},s,1000);expect(m.leerBorrador(k,s,2000)).toEqual({texto:'Borrador'})
 expect(m.leerBorrador(m.claveBorrador('b@uniacc.cl','C1',2027,1,'sms')!,s,2000)).toBeNull();expect(m.claveBorrador(null,'C1',2027,1,'sms')).toBeNull()
 expect(m.leerBorrador(k,s,86402000)).toBeNull();m.guardarBorrador(k,{texto:'Otro'},s);m.borrarBorrador(k,s);expect(m.leerBorrador(k,s)).toBeNull()
})
