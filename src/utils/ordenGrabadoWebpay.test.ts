import { describe, expect, it } from 'vitest'
import { ordenGrabadoWebpay } from '@/utils/ordenGrabadoWebpay'

describe('ordenGrabadoWebpay', () => {
  it('graba sin cerrar la ficha cuando todavía no hay número de operación', () => {
    expect(ordenGrabadoWebpay({ ambosWebpay: true, numOperacion: null, firmasListas: false }))
      .toEqual({ tipo: 'grabar', cerrarFicha: false })
  })

  it('manda a firmar cuando ya hay número y faltan firmas', () => {
    expect(ordenGrabadoWebpay({ ambosWebpay: true, numOperacion: '940682', firmasListas: false }))
      .toEqual({ tipo: 'firmar' })
  })

  it('cierra la ficha cuando hay número y las firmas están listas', () => {
    expect(ordenGrabadoWebpay({ ambosWebpay: true, numOperacion: '940682', firmasListas: true }))
      .toEqual({ tipo: 'cerrar-ficha' })
  })

  it('espera cuando no son los dos Webpay', () => {
    expect(ordenGrabadoWebpay({ ambosWebpay: false, numOperacion: null, firmasListas: true }))
      .toEqual({ tipo: 'esperar' })
  })
})
