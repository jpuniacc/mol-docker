import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import SeguimientoComposerSms from './SeguimientoComposerSms.vue'

const { enviarSms } = vi.hoisted(() => ({ enviarSms: vi.fn().mockResolvedValue({ error: null }) }))
vi.mock('@/services/seguimientoRematriculaApi', () => ({ postSeguimientoEnviarSms: enviarSms }))
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
const slots = { template: '<div><slot /></div>' }
function montar(telefono: string | null) {
  return mount(SeguimientoComposerSms, {
    props: { open: true, anio: 2027, semestre: 1, caso: { codcli: 'CASO-PRUEBA', nombre_alumno: 'Ejemplo', telefono } as any },
    global: { stubs: { Dialog: slots, DialogContent: slots, DialogHeader: slots, DialogTitle: slots, DialogFooter: slots } },
  })
}
beforeEach(() => vi.clearAllMocks())
describe('SMS: destinatario visible normalizado como la API', () => {
  it.each(['912345678', '0912345678', '56912345678', '+56912345678', '+56 9 1234 5678', '(09)1234-5678', ' 9123 45678 '])('muestra +56 9 XXXX XXXX para %s', (telefono) => {
    const w = montar(telefono)
    expect(w.get('p.rounded-md').text()).toBe('+56 9 1234 5678')
    w.unmount()
  })
  it.each([null, ''])('muestra ausencia y no permite enviar sin teléfono (%s)', async (telefono) => {
    const w = montar(telefono)
    await w.get('textarea').setValue('Prueba local sin envío real')
    expect(w.get('p.rounded-md').text()).toBe('—')
    expect(w.findAll('button').find(b => b.text() === 'Enviar SMS')?.attributes('disabled')).toBeDefined()
    expect(enviarSms).not.toHaveBeenCalled()
    w.unmount()
  })
  it('conserva destinatario autoritativo del servidor: el cliente no sobrescribe la ficha', async () => {
    const w = montar('0912345678')
    await w.get('textarea').setValue('Prueba unitaria: transporte simulado')
    const button = w.findAll('button').find(b => b.text() === 'Enviar SMS')!
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()
    expect(enviarSms).toHaveBeenCalledTimes(1)
    expect(enviarSms).toHaveBeenCalledWith('CASO-PRUEBA', { anio: 2027, semestre: 1, texto: 'Prueba unitaria: transporte simulado' })
    expect(w.emitted('enviado')).toHaveLength(1)
    w.unmount()
  })
})
