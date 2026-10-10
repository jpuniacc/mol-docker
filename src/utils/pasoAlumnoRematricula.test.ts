import { describe, expect, it } from 'vitest'
import {
  pasoBloqueadoTrasEnvio,
  rutaSiEnvioFirmaBloquea,
} from '@/utils/pasoAlumnoRematricula'

describe('rutaSiEnvioFirmaBloquea', () => {
  it('no redirige antes de enviar', () => {
    expect(rutaSiEnvioFirmaBloquea(false, 'matricula-alumno-forma-pago')).toBeNull()
    expect(rutaSiEnvioFirmaBloquea(false, 'matricula-alumno-datos')).toBeNull()
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
