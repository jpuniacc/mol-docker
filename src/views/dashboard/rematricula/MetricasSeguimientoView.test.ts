import {it,expect,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
vi.mock('@/stores/auth',()=>({useAuthStore:()=>({email:'propio@uniacc.cl',perfil:{codigo_perfil_usuario:3}})}))
vi.mock('@/stores/periodoActivo',()=>({usePeriodoActivoStore:()=>({anio:2027,semestre:1})}))
const {get}=vi.hoisted(()=>({get:vi.fn().mockResolvedValue({data:null,error:'Acceso denegado de prueba'})}))
vi.mock('@/services/seguimientoMetricasApi',()=>({getMetricas:get,csvMetricas:()=>''}))
import View from './MetricasSeguimientoView.vue'
it('consejero solo propio y error visible, no dashboard de ceros',async()=>{
 const w=mount(View,{global:{stubs:{RouterLink:{template:'<a><slot /></a>'},SeguimientoCasoDrawer:true,SeguimientoNotaDialog:true}}});await flushPromises()
 expect(get).toHaveBeenCalledWith('resumen',expect.objectContaining({autor:'propio@uniacc.cl',anio:2027,semestre:1}));expect(w.get('[role="alert"]').text()).toContain('Acceso denegado');expect(w.text()).not.toContain('Todos los autores');expect(w.find('[aria-label="Resumen de métricas"]').exists()).toBe(false)
})
