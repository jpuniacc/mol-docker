import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'

const memoria = new Map<string, string>()

beforeEach(() => {
  memoria.clear()
  setActivePinia(createPinia())
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (clave: string) => memoria.get(clave) ?? null,
      setItem: (clave: string, valor: string) => {
        memoria.set(clave, valor)
      },
      removeItem: (clave: string) => {
        memoria.delete(clave)
      },
    },
  })
})

describe('envioFirmaIniciado', () => {
  it('guarda la bandera y la recupera en otra carga de la sesión', () => {
    const store = useMatriculaAlumnoContextStore()
    expect(store.envioFirmaIniciado).toBe(false)

    store.marcarEnvioFirmaIniciado()
    expect(store.envioFirmaIniciado).toBe(true)

    setActivePinia(createPinia())
    const restaurado = useMatriculaAlumnoContextStore()
    restaurado.hydrateFromSessionStorage()
    expect(restaurado.envioFirmaIniciado).toBe(true)
  })

  it('resetFlujo apaga la bandera', () => {
    const store = useMatriculaAlumnoContextStore()
    store.marcarEnvioFirmaIniciado()
    store.resetFlujo()
    expect(store.envioFirmaIniciado).toBe(false)
    expect(memoria.size).toBe(0)
  })
})

describe('cuenta Webpay', () => {
  it('recuerda que la cuenta ya se grabó y el plan con el beneficio', () => {
    const store = useMatriculaAlumnoContextStore()
    store.guardarPlanCuentaWebpay({
      contrato: '20271CDAD1DR1',
      fechaInicio: '2026-10-22',
      caja: 997,
      montoMatricula: 250000,
      montoArancel: 3665600,
      descuentos: [
        {
          codben: '1756',
          documento: '90121412974',
          monto: 974400,
          porc: 21,
          montoSolicitado: 974400,
          concepto: 'arancel',
        },
      ],
    })
    store.marcarCuentaWebpayGrabada()

    setActivePinia(createPinia())
    const restaurado = useMatriculaAlumnoContextStore()
    restaurado.hydrateFromSessionStorage()
    expect(restaurado.cuentaWebpayGrabada).toBe(true)
    expect(restaurado.planCuentaWebpay?.descuentos[0]?.codben).toBe('1756')
  })

  it('olvida el plan si una tarjeta deja de estar autorizada', () => {
    const store = useMatriculaAlumnoContextStore()
    store.guardarPlanCuentaWebpay({
      contrato: '20271CDAD1DR1',
      fechaInicio: '2026-10-22',
      caja: 997,
      montoMatricula: 250000,
      montoArancel: 3665600,
      descuentos: [],
    })
    store.marcarCuentaWebpayGrabada()
    store.setWebpayArancelEstado('rechazada')
    expect(store.cuentaWebpayGrabada).toBe(false)
    expect(store.planCuentaWebpay).toBeNull()
  })
})
