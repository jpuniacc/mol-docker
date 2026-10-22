import { describe, expect, it } from 'vitest'

import { interpretarSolicitudSms } from '@/services/rematriculaOtpApi'

describe('interpretarSolicitudSms', () => {
  it('devuelve la expiración cuando el SMS salió', () => {
    expect(interpretarSolicitudSms(true, { ok: true, expiresAt: '2026-10-22T12:00:00Z' })).toEqual({
      ok: true,
      expiresAt: '2026-10-22T12:00:00Z',
    })
  })

  it('valida sin SMS solo cuando la API lo autoriza', () => {
    expect(interpretarSolicitudSms(true, { ok: true, validadoSinSms: true })).toEqual({
      ok: true,
      validadoSinSms: true,
    })
  })

  it('mantiene el error de saldo si la API no autoriza el bypass', () => {
    expect(interpretarSolicitudSms(false, { message: 'No hay saldo para enviar SMS.' })).toEqual({
      ok: false,
      message: 'No hay saldo para enviar SMS.',
    })
  })
})
