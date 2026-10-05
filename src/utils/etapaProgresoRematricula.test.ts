import { describe, expect, it } from 'vitest'
import {
  etiquetaActividadLog,
  etiquetaEtapaProgreso,
  lineasDetalleActividad,
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
