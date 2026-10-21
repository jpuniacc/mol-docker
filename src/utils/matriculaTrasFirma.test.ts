import { describe, expect, it } from 'vitest'

import { decisionMatriculaFirma } from '@/utils/matriculaTrasFirma'

describe('decisionMatriculaFirma', () => {
  it('espera mientras falten firmas', () => {
    expect(decisionMatriculaFirma({ ready: false })).toBe('esperar')
  })

  it('avanza cuando la API confirma la matrícula', () => {
    expect(decisionMatriculaFirma({ ready: true, matriculaActualizada: true })).toBe('avanzar')
  })

  it('muestra el motivo si la firma está lista y la matrícula no quedó', () => {
    expect(
      decisionMatriculaFirma({
        ready: true,
        matriculaActualizada: false,
        errorMatricula: 'U+ rechazó',
      }),
    ).toBe('mostrar-error')
  })
})
