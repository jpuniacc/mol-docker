import { describe, expect, it } from 'vitest'

import { clasificarBeneficioExcel } from './beneficioPeriodo'

describe('clasificarBeneficioExcel', () => {
  it('marca estatal como otro flujo y aplica', () => {
    expect(clasificarBeneficioExcel({ renovable: 'BECA ESTATAL', convenio: null })).toEqual({
      flujo: 'ESTATAL',
      aplica: true,
      requiereCertificado: false,
      tipoCertificado: null,
    })
  })

  it('DVU y renovable por notas van al mismo flujo MOL', () => {
    expect(clasificarBeneficioExcel({ renovable: 'BECA DVU', convenio: null }).flujo).toBe('MOL_DVU')
    expect(
      clasificarBeneficioExcel({
        renovable: 'RENOVACION  / PROMEDIO GENERAL 5,5 O SUPERIOR',
        convenio: null,
      }),
    ).toMatchObject({ flujo: 'MOL_DVU', aplica: true })
    expect(
      clasificarBeneficioExcel({ renovable: 'SIN REQUISITO DE NOTAS', convenio: null }),
    ).toMatchObject({ flujo: 'MOL_DVU', aplica: true })
  })

  it('convenio vigente pide certificado y aplica', () => {
    expect(
      clasificarBeneficioExcel({
        renovable: null,
        convenio: 'SI (CERTIFICADO AFILIACION ACTUALIZADO)',
      }),
    ).toEqual({
      flujo: 'CONVENIO',
      aplica: true,
      requiereCertificado: true,
      tipoCertificado: 'AFILIACION',
    })
    expect(
      clasificarBeneficioExcel({
        renovable: null,
        convenio: 'SI (CERTIFICADO ANTIGÜEDAD LABORAL ACTUALIZADO)',
      }),
    ).toMatchObject({
      flujo: 'CONVENIO',
      requiereCertificado: true,
      tipoCertificado: 'ANTIGUEDAD_LABORAL',
    })
  })

  it('convenio no vigente y código en revisión no aplican', () => {
    expect(
      clasificarBeneficioExcel({ renovable: null, convenio: 'NO VIGENTE' }),
    ).toMatchObject({ flujo: 'NO_VIGENTE', aplica: false })
    expect(
      clasificarBeneficioExcel({ renovable: 'EN REVISION', convenio: null }),
    ).toMatchObject({ flujo: 'EN_REVISION', aplica: false })
  })

  it('no renovable y forma de pago', () => {
    expect(
      clasificarBeneficioExcel({ renovable: 'BENEFICIO NO RENOVABLE', convenio: null }),
    ).toMatchObject({ flujo: 'NO_RENOVABLE', aplica: false })
    expect(
      clasificarBeneficioExcel({ renovable: 'NO ES BECA/NO RENOVABLE', convenio: null }),
    ).toMatchObject({ flujo: 'NO_RENOVABLE', aplica: false })
    expect(
      clasificarBeneficioExcel({ renovable: 'DESCUENTO POR FORMA DE PAGO', convenio: null }),
    ).toMatchObject({ flujo: 'FORMA_PAGO', aplica: true })
  })
})
