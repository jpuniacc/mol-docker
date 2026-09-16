import { describe, expect, it } from 'vitest'
import { esSinBeca, matchCodBeneficio, normalizarNombreBeca } from './becaNombreMatch'

const CAT = [
  { codigo_beneficio: '1756', beneficio: 'Beneficio Apoyo UNIACC Renovable' },
  { codigo_beneficio: '1791', beneficio: 'DESCUENTO ANTICIPACION MATRICULA NUEVO' },
]

describe('becaNombreMatch', () => {
  it('normaliza espacios dobles', () => {
    expect(normalizarNombreBeca('Beneficio  Apoyo UNIACC Renovable')).toBe(
      'beneficio apoyo uniacc renovable',
    )
  })

  it('Sin beca → true', () => {
    expect(esSinBeca('Sin beca')).toBe(true)
    expect(esSinBeca(null)).toBe(true)
  })

  it('Apoyo UNIACC → 1756 aunque Excel tenga doble espacio', () => {
    expect(matchCodBeneficio('Beneficio  Apoyo UNIACC Renovable', CAT)).toBe('1756')
  })

  it('nombre desconocido → null', () => {
    expect(matchCodBeneficio('Beca inventada XYZ', CAT)).toBe(null)
  })
})
