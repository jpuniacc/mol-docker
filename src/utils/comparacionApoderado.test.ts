import { describe, expect, it } from 'vitest'
import {
  antiguoDesdePayload,
  cierraCasoTrasConfirmar,
  datoVisible,
} from './comparacionApoderado'

describe('comparacionApoderado', () => {
  it('muestra un guion cuando el dato viene vacío', () => {
    expect(datoVisible('  ')).toBe('—')
    expect(datoVisible('María')).toBe('María')
  })

  it('toma los tres datos que vio el alumno', () => {
    expect(
      antiguoDesdePayload({
        apoderadoNombre: 'María Pérez',
        apoderadoTelefono: '91111',
        apoderadoEmail: 'maria@mail.cl',
      }),
    ).toEqual({
      nombre: 'María Pérez',
      telefono: '91111',
      email: 'maria@mail.cl',
    })
  })

  it('cierra el caso solo cuando el aviso quedó encolado', () => {
    expect(cierraCasoTrasConfirmar({ ok: true, avisoId: 'aviso-1' })).toBe(true)
    expect(cierraCasoTrasConfirmar({ ok: false, avisoId: null })).toBe(false)
    expect(cierraCasoTrasConfirmar({ ok: true, avisoId: null })).toBe(false)
  })
})
