import { describe, expect, it } from 'vitest'
import {
  accionAlPulsarPaso,
  NOMBRES_PASO_ALUMNO,
  pasoBloqueadoTrasEnvio,
  rutaSiEnvioFirmaBloquea,
  textoAvisoPasoCerrado,
} from '@/utils/pasoAlumnoRematricula'

describe('rutaSiEnvioFirmaBloquea', () => {
  it('no redirige antes de enviar', () => {
    expect(rutaSiEnvioFirmaBloquea(false, 'matricula-alumno-forma-pago')).toBeNull()
    expect(rutaSiEnvioFirmaBloquea(false, 'matricula-alumno-datos')).toBeNull()
  })

  it('no redirige si la ruta no es un texto', () => {
    expect(rutaSiEnvioFirmaBloquea(true, undefined)).toBeNull()
  })

  it('manda a la firma si el destino es un paso anterior', () => {
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-datos')).toBe(
      'matricula-alumno-firma',
    )
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-forma-pago')).toBe(
      'matricula-alumno-firma',
    )
  })

  it('deja pasar la firma, el resumen y el retorno de Webpay', () => {
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-firma')).toBeNull()
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-resumen')).toBeNull()
    expect(rutaSiEnvioFirmaBloquea(true, 'matricula-alumno-webpay-retorno')).toBeNull()
  })
})

describe('pasoBloqueadoTrasEnvio', () => {
  it('antes de enviar solo bloquea pasos todavía no alcanzados', () => {
    const base = { envioFirmaIniciado: false, firmaCompletada: false, pasoMaximo: 3 }
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 1 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 2 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 3 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 4 })).toBe(true)
  })

  it('después de enviar bloquea datos y forma de pago, y deja la firma', () => {
    const base = { envioFirmaIniciado: true, firmaCompletada: false, pasoMaximo: 3 }
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 1 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 2 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 3 })).toBe(false)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 4 })).toBe(true)
  })

  it('con la firma completa solo deja el resumen', () => {
    const base = { envioFirmaIniciado: true, firmaCompletada: true, pasoMaximo: 4 }
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 1 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 2 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 3 })).toBe(true)
    expect(pasoBloqueadoTrasEnvio({ ...base, step: 4 })).toBe(false)
  })
})

describe('accionAlPulsarPaso', () => {
  it('no hace nada si el paso no viene o si ya es el actual', () => {
    expect(accionAlPulsarPaso({ step: undefined, pasoActual: 2, cerrado: false })).toBe('nada')
    expect(accionAlPulsarPaso({ step: 2, pasoActual: 2, cerrado: false })).toBe('nada')
  })

  it('avisa si el paso está cerrado, aunque coincida con el actual', () => {
    expect(accionAlPulsarPaso({ step: 4, pasoActual: 2, cerrado: true })).toBe('aviso')
    expect(accionAlPulsarPaso({ step: 2, pasoActual: 2, cerrado: true })).toBe('aviso')
  })

  it('navega si el paso está abierto y es otro', () => {
    expect(accionAlPulsarPaso({ step: 1, pasoActual: 2, cerrado: false })).toBe('navegar')
  })
})

describe('textoAvisoPasoCerrado', () => {
  it('nombra el paso actual y el pulsado, sin decir todavía', () => {
    expect(NOMBRES_PASO_ALUMNO).toEqual([
      'Datos personales',
      'Forma de pago',
      'Firma de contrato',
      'Resumen final',
    ])
    expect(textoAvisoPasoCerrado('Forma de pago', 'Resumen final')).toBe(
      'Estás en Forma de pago. Resumen final no está abierto.',
    )
    expect(textoAvisoPasoCerrado('Forma de pago', 'Resumen final')).not.toContain('todavía')
  })
})
