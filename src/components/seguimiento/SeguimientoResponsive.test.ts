import {it,expect} from 'vitest'
import board from './SeguimientoBoard.vue?raw'
import drawer from './SeguimientoCasoDrawer.vue?raw'
import lista from './SeguimientoListaTabla.vue?raw'
it('board y lista tienen presentación móvil sin cambiar desktop',()=>{expect(board).toContain('snap-proximity');expect(board).toContain('snap-start');expect(lista).toContain('SeguimientoCasoCard')})
it('drawer usa capa accesible y pantalla completa sin Teleport manual',()=>{expect(drawer).toContain('DialogRoot');expect(drawer).toContain('100dvh');expect(drawer).not.toContain('<Teleport')})
