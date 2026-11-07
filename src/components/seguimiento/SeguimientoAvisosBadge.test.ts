import {it,expect,vi} from 'vitest'
import {mount} from '@vue/test-utils'
import SeguimientoAvisosBadge from './SeguimientoAvisosBadge.vue'
vi.mock('@/stores/auth',()=>({useAuthStore:()=>({email:'prueba@uniacc.cl',perfil:{codigo_perfil_usuario:3}})}))
vi.mock('@/stores/periodoActivo',()=>({usePeriodoActivoStore:()=>({anio:2027,semestre:1,ensureLoaded:vi.fn()})}))
vi.mock('@/stores/seguimientoAvisos',()=>({useSeguimientoAvisosStore:()=>({revision:0,cargar:vi.fn(),resultado:()=>({data:{vencidas:0,hoy:0,total:0,pendientes:1},error:null})})}))
it('el menú cuenta también una pendiente histórica futura',()=>{
 const wrapper=mount(SeguimientoAvisosBadge)
 expect(wrapper.text()).toBe('1')
})
