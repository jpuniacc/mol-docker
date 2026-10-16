import { describe, expect, it } from 'vitest'
import { alcanceCartera } from './alcanceCarteraEjecutivo'

describe('alcanceCartera', () => {
  it('perfil 1 y 2 ven la cartera completa', () => {
    expect(alcanceCartera(1, 'a@uniacc.cl')).toEqual({ tipo: 'completo' })
    expect(alcanceCartera(2, null)).toEqual({ tipo: 'completo' })
  })

  it('perfil 3 usa el correo en minúsculas', () => {
    expect(alcanceCartera(3, ' Nicole.Eguren@uniacc.cl ')).toEqual({
      tipo: 'ejecutivo',
      email: 'nicole.eguren@uniacc.cl',
    })
  })

  it('perfil 3 sin correo no abre la cartera', () => {
    expect(alcanceCartera(3, '  ')).toEqual({ tipo: 'sin_correo' })
    expect(alcanceCartera(3, null)).toEqual({ tipo: 'sin_correo' })
  })
})
