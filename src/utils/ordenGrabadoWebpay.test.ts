import { describe, expect, it } from 'vitest'
import { ordenGrabadoWebpay } from '@/utils/ordenGrabadoWebpay'

describe('ordenGrabadoWebpay', () => {
  it('graba aunque el número de operación ya esté reservado', () => {
    expect(ordenGrabadoWebpay({ ambosWebpay: true, cuentaGrabada: false, firmasListas: false }))
      .toEqual({ tipo: 'grabar', cerrarFicha: false })
  })

  it('manda a firmar solo cuando la cuenta ya quedó grabada', () => {
    expect(ordenGrabadoWebpay({ ambosWebpay: true, cuentaGrabada: true, firmasListas: false }))
      .toEqual({ tipo: 'firmar' })
  })

  it('cierra la ficha cuando la cuenta está grabada y las firmas están listas', () => {
    expect(ordenGrabadoWebpay({ ambosWebpay: true, cuentaGrabada: true, firmasListas: true }))
      .toEqual({ tipo: 'cerrar-ficha' })
  })

  it('espera cuando no son los dos Webpay', () => {
    expect(ordenGrabadoWebpay({ ambosWebpay: false, cuentaGrabada: false, firmasListas: true }))
      .toEqual({ tipo: 'esperar' })
  })
})
