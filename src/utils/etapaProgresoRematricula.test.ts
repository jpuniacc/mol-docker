import { describe, expect, it } from 'vitest'
import {
  etiquetaActividadLog,
  etiquetaEtapaProgreso,
  etiquetaPermanenciaEtapa,
  lineasDetalleActividad,
  permanenciaEtapa,
  resolverEtapaProgreso,
} from './etapaProgresoRematricula'

describe('resolverEtapaProgreso', () => {
  it('sin hitos → sin_ingreso', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: false,
        tycAcepta: false,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: false,
      }),
    ).toBe('sin_ingreso')
  })

  it('solo ingreso → ingreso', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: true,
        tycAcepta: false,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: false,
      }),
    ).toBe('ingreso')
  })

  it('tyc sin datos → tyc', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: true,
        tycAcepta: true,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: false,
      }),
    ).toBe('tyc')
  })

  it('matriculado gana aunque falten flags intermedios', () => {
    expect(
      resolverEtapaProgreso({
        tieneIngreso: false,
        tycAcepta: false,
        datosOk: false,
        formaPagoOk: false,
        firmaOk: false,
        matriculadoOk: true,
      }),
    ).toBe('matriculado')
  })

  it('etiqueta legible', () => {
    expect(etiquetaEtapaProgreso('forma_pago')).toMatch(/pago/i)
  })
})

describe('etiquetaActividadLog', () => {
  it('etiqueta la matrícula actualizada por el SP', () => {
    expect(etiquetaActividadLog('matricula', 'matriculado')).toBe(
      'Matrícula actualizada en U+',
    )
  })
})

describe('lineasDetalleActividad', () => {
  it('muestra el documento y la versión de TyC, sin el JSON', () => {
    const lineas = lineasDetalleActividad({
      codigo_tyc: 'mol',
      tyc_titulo: 'Términos y Condiciones de Rematrícula Online',
      tyc_updated_at: '2026-09-14T19:16:04.123312+00:00',
    })
    expect(lineas.map((linea) => linea.etiqueta)).toEqual(['Documento', 'Versión'])
    expect(lineas[0]?.valor).toBe('Términos y Condiciones de Rematrícula Online')
    expect(lineas[1]?.valor).toMatch(/14-09-2026/)
  })
})

describe('permanenciaEtapa', () => {
  const ahora = new Date('2026-10-15T18:00:00.000Z')

  it('no marca 24 horas exactas', () => {
    expect(permanenciaEtapa('datos', '2026-10-14T18:00:00.000Z', ahora)).toEqual({
      marcada: false,
      horas: null,
    })
  })

  it('marca más de 24 horas con horas enteras', () => {
    expect(permanenciaEtapa('forma_pago', '2026-10-14T10:30:00.000Z', ahora)).toEqual({
      marcada: true,
      horas: 31,
    })
    expect(etiquetaPermanenciaEtapa(31)).toBe('1 día y 7 horas en esta etapa')
    expect(etiquetaPermanenciaEtapa(27)).toBe('1 día y 3 horas en esta etapa')
    expect(etiquetaPermanenciaEtapa(25)).toBe('1 día y 1 hora en esta etapa')
    expect(etiquetaPermanenciaEtapa(24)).toBe('1 día en esta etapa')
    expect(etiquetaPermanenciaEtapa(48)).toBe('2 días en esta etapa')
    expect(etiquetaPermanenciaEtapa(50)).toBe('2 días y 2 horas en esta etapa')
  })

  it('no marca Sin ingreso ni Matriculado', () => {
    const haceDosDias = '2026-10-13T18:00:00.000Z'
    expect(permanenciaEtapa('sin_ingreso', haceDosDias, ahora).marcada).toBe(false)
    expect(permanenciaEtapa('matriculado', haceDosDias, ahora).marcada).toBe(false)
  })

  it('no marca si falta la fecha de entrada', () => {
    expect(permanenciaEtapa('ingreso', null, ahora)).toEqual({ marcada: false, horas: null })
  })
})
