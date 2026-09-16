import { describe, expect, it } from 'vitest'

import type { MnpMvBeneficioPeriodoRow, PlanPagosMvBeneficioDetalle } from '@/types/supabase'

import {
  disminuirArt13,
  elegirPromedio,
  exigeMedicionPromedio,
  resolverBecaPromedio,
  resolverBeneficiosDelPlan,
} from './resolucionBecaPromedio'

describe('exigeMedicionPromedio', () => {
  it('es true si el renovable pide promedio 5.5', () => {
    expect(exigeMedicionPromedio('RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR')).toBe(true)
    expect(exigeMedicionPromedio('RENOVACION  / PROMEDIO GENERAL 5,5 O SUPERIOR')).toBe(true)
  })

  it('es false sin requisito de notas, DVU o estatal', () => {
    expect(exigeMedicionPromedio('SIN REQUISITO DE NOTAS')).toBe(false)
    expect(exigeMedicionPromedio('BECA DVU')).toBe(false)
    expect(exigeMedicionPromedio('BECA ESTATAL')).toBe(false)
    expect(exigeMedicionPromedio(null)).toBe(false)
  })
})

describe('elegirPromedio', () => {
  it('con promedios abiertos usa el del último período, o el anual si no hay', () => {
    expect(
      elegirPromedio({ promAnio: 5.8, promUltimoPeriodo: 5.1, promediosCerrados: false }),
    ).toEqual({ promedio: 5.1, fuente: 'periodo' })
    expect(
      elegirPromedio({ promAnio: 5.8, promUltimoPeriodo: null, promediosCerrados: false }),
    ).toEqual({ promedio: 5.8, fuente: 'anio' })
  })

  it('con promedios cerrados usa el anual, o el del período si no hay', () => {
    expect(
      elegirPromedio({ promAnio: 5.8, promUltimoPeriodo: 5.1, promediosCerrados: true }),
    ).toEqual({ promedio: 5.8, fuente: 'anio' })
    expect(
      elegirPromedio({ promAnio: null, promUltimoPeriodo: 5.1, promediosCerrados: true }),
    ).toEqual({ promedio: 5.1, fuente: 'periodo' })
  })

  it('sin ningún promedio usable devuelve null', () => {
    expect(
      elegirPromedio({ promAnio: null, promUltimoPeriodo: null, promediosCerrados: false }),
    ).toBeNull()
  })

  it('trata 0 como ausencia de nota, no como promedio', () => {
    expect(
      elegirPromedio({ promAnio: 5.5, promUltimoPeriodo: 0, promediosCerrados: false }),
    ).toEqual({ promedio: 5.5, fuente: 'anio' })
    expect(
      elegirPromedio({ promAnio: 0, promUltimoPeriodo: 0, promediosCerrados: false }),
    ).toBeNull()
  })
})

describe('disminuirArt13', () => {
  it('mantiene si el promedio es 5.5 o más', () => {
    expect(disminuirArt13(5.5)).toEqual({ resultado: 'MANTIENE', disminucion: 0 })
    expect(disminuirArt13(6.2)).toEqual({ resultado: 'MANTIENE', disminucion: 0 })
  })

  it('baja según la tabla Art. 13 entre 4.0 y 5.4', () => {
    expect(disminuirArt13(5.4)).toEqual({ resultado: 'BAJA', disminucion: 0.15 })
    expect(disminuirArt13(5.3)).toEqual({ resultado: 'BAJA', disminucion: 0.15 })
    expect(disminuirArt13(5.0)).toEqual({ resultado: 'BAJA', disminucion: 0.3 })
    expect(disminuirArt13(4.0)).toEqual({ resultado: 'BAJA', disminucion: 0.8 })
  })

  it('redondea a 1 decimal antes de buscar el tramo', () => {
    expect(disminuirArt13(5.45)).toEqual({ resultado: 'MANTIENE', disminucion: 0 })
    expect(disminuirArt13(5.24)).toEqual({ resultado: 'BAJA', disminucion: 0.2 })
  })

  it('pierde si el promedio es 3.9 o menos', () => {
    expect(disminuirArt13(3.9)).toEqual({ resultado: 'PIERDE', disminucion: 1 })
    expect(disminuirArt13(1.0)).toEqual({ resultado: 'PIERDE', disminucion: 1 })
  })
})

describe('resolverBecaPromedio', () => {
  it('no aplica si la beca no exige promedio', () => {
    expect(
      resolverBecaPromedio({
        exigePromedio: false,
        porcApr: 40,
        monto: 800000,
        promedio: null,
        fuente: null,
      }),
    ).toMatchObject({
      resultado: 'NO_APLICA',
      porcFinal: 40,
      montoFinal: 800000,
      disminucion: 0,
    })
  })

  it('bloquea si exige promedio y no hay nota', () => {
    expect(
      resolverBecaPromedio({
        exigePromedio: true,
        porcApr: 40,
        monto: 800000,
        promedio: null,
        fuente: null,
      }).resultado,
    ).toBe('BLOQUEO_SIN_PROMEDIO')
  })

  it('mantiene % y monto si el promedio alcanza 5.5', () => {
    expect(
      resolverBecaPromedio({
        exigePromedio: true,
        porcApr: 40,
        monto: 800000,
        promedio: 5.6,
        fuente: 'anio',
      }),
    ).toMatchObject({
      resultado: 'MANTIENE',
      porcFinal: 40,
      montoFinal: 800000,
      disminucion: 0,
    })
  })

  it('baja % y monto: 40% con promedio 5.0 queda 28%', () => {
    expect(
      resolverBecaPromedio({
        exigePromedio: true,
        porcApr: 40,
        monto: 1000000,
        promedio: 5.0,
        fuente: 'periodo',
      }),
    ).toMatchObject({
      resultado: 'BAJA',
      porcFinal: 28,
      montoFinal: 700000,
      disminucion: 0.3,
    })
  })

  it('aplica el factor solo al monto si no hay porcentaje', () => {
    expect(
      resolverBecaPromedio({
        exigePromedio: true,
        porcApr: null,
        monto: 500000,
        promedio: 5.0,
        fuente: 'anio',
      }),
    ).toMatchObject({
      resultado: 'BAJA',
      porcFinal: null,
      montoFinal: 350000,
    })
  })

  it('pierde % y monto si el promedio es 3.9 o menos', () => {
    expect(
      resolverBecaPromedio({
        exigePromedio: true,
        porcApr: 40,
        monto: 800000,
        promedio: 3.9,
        fuente: 'anio',
      }),
    ).toMatchObject({
      resultado: 'PIERDE',
      porcFinal: 0,
      montoFinal: 0,
      disminucion: 1,
    })
  })
})

describe('resolverBeneficiosDelPlan', () => {
  const catalogo = [
    {
      codigo_beneficio: '1744',
      flujo: 'MOL_DVU',
      renovable: 'RENOVACION / PROMEDIO GENERAL 5.5 O SUPERIOR',
    },
    {
      codigo_beneficio: '1753',
      flujo: 'MOL_DVU',
      renovable: 'SIN REQUISITO DE NOTAS',
    },
    {
      codigo_beneficio: '9',
      flujo: 'ESTATAL',
      renovable: 'BECA ESTATAL',
    },
  ] as Pick<MnpMvBeneficioPeriodoRow, 'codigo_beneficio' | 'flujo' | 'renovable'>[]

  const beneficios: PlanPagosMvBeneficioDetalle[] = [
    { cod_beneficio: '1744', descripcion: 'Talento', monto: 1000000, porc_apr: 40, aplicable: 'A', estado: null },
    { cod_beneficio: '1753', descripcion: 'Docente', monto: 200000, porc_apr: 20, aplicable: 'A', estado: null },
    { cod_beneficio: '9', descripcion: 'JGM', monto: 500000, porc_apr: null, aplicable: 'A', estado: null },
  ]

  it('baja la interna con promedio y deja intactas las que no miden notas', () => {
    const out = resolverBeneficiosDelPlan({
      beneficios,
      catalogo,
      promAnio: 5.8,
      promUltimoPeriodo: 5.0,
      promediosCerrados: false,
    })
    expect(out.map((r) => r.resultado)).toEqual(['BAJA', 'NO_APLICA', 'NO_APLICA'])
    expect(out[0]?.porcFinal).toBe(28)
    expect(out[0]?.montoFinal).toBe(700000)
    expect(out[1]?.montoFinal).toBe(200000)
    expect(out[2]?.montoFinal).toBe(500000)
  })

  it('bloquea si una interna exige promedio y no hay nota', () => {
    const out = resolverBeneficiosDelPlan({
      beneficios,
      catalogo,
      promAnio: null,
      promUltimoPeriodo: null,
      promediosCerrados: false,
    })
    expect(out[0]?.resultado).toBe('BLOQUEO_SIN_PROMEDIO')
    expect(out.some((r) => r.resultado === 'BLOQUEO_SIN_PROMEDIO')).toBe(true)
  })
})
