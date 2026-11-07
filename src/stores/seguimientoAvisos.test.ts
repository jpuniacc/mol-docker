import {it,expect,vi,beforeEach} from 'vitest'
import {setActivePinia,createPinia} from 'pinia'
const {fetchResumen,auth}=vi.hoisted(()=>({fetchResumen:vi.fn(),auth:{email:'a@uniacc.cl',perfil:{codigo_perfil_usuario:3}}}))
vi.mock('@/services/seguimientoRematriculaApi',()=>({fetchResumenAcciones:fetchResumen}))
vi.mock('@/stores/auth',()=>({useAuthStore:()=>auth}))
beforeEach(()=>{setActivePinia(createPinia());fetchResumen.mockReset();auth.email='a@uniacc.cl'})
it('TTL y single-flight no mezclan carteras ni sesión',async()=>{
 const mod=await import('./seguimientoAvisos').catch(()=>null)
 expect(mod,'Falta estado compartido de badge').not.toBeNull();if(!mod)return
 fetchResumen.mockResolvedValue({data:{vencidas:1,hoy:2,total:3,pendientes:3},error:null})
 const store=mod.useSeguimientoAvisosStore(),scope={anio:2027,semestre:1}
 await Promise.all([store.cargar(scope),store.cargar(scope)])
 await store.cargar(scope);expect(fetchResumen).toHaveBeenCalledTimes(1)
 await store.cargar({...scope,emailEjecutivoOverride:'b@uniacc.cl'});expect(fetchResumen).toHaveBeenCalledTimes(2)
 auth.email='b@uniacc.cl';await store.cargar(scope);expect(fetchResumen).toHaveBeenCalledTimes(3)
 store.invalidar();await store.cargar(scope);expect(fetchResumen).toHaveBeenCalledTimes(4)
})
it('un fallo queda no disponible, no cero falso',async()=>{
 const mod=await import('./seguimientoAvisos').catch(()=>null);expect(mod).not.toBeNull();if(!mod)return
 fetchResumen.mockResolvedValue({data:null,error:'sin conexión'})
 const store=mod.useSeguimientoAvisosStore(),scope={anio:2027,semestre:1}
 await store.cargar(scope)
 expect(store.resultado(scope)?.data).toBeNull();expect(store.resultado(scope)?.error).toBe('sin conexión')
})
