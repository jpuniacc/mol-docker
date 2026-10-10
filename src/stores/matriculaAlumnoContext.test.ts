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
