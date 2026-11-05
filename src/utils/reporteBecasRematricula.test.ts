import { describe, expect, it } from 'vitest'
import {
  aplicaChipBecas,
  ETIQUETA_ART13,
  parseFilaReporteBecas,
  parseKpiReporteBecas,
  peorResultadoArt13,
  resultadoArt13Alumno,
} from './reporteBecasRematricula'

describe('reporteBecasRematricula', () => {
  it('Art.13 por promedio: mantiene / baja / pierde / sin promedio', () => {
    expect(resultadoArt13Alumno({ promAnio: 5.6, becasExigenPromedio: true })).toBe('MANTIENE')
    expect(resultadoArt13Alumno({ promAnio: 5.0, becasExigenPromedio: true })).toBe('BAJA')
    expect(resultadoArt13Alumno({ promAnio: 3.5, becasExigenPromedio: true })).toBe('PIERDE')
    expect(resultadoArt13Alumno({ promAnio: null, becasExigenPromedio: true })).toBe('SIN_PROMEDIO')
    expect(resultadoArt13Alumno({ promAnio: 4.0, becasExigenPromedio: false })).toBe('NO_APLICA')
  })

  it('peor resultado prioriza pierde sobre baja', () => {
    expect(peorResultadoArt13('BAJA', 'PIERDE')).toBe('PIERDE')
    expect(peorResultadoArt13('MANTIENE', 'BAJA')).toBe('BAJA')
  })

  it('parsea fila con Talento 1744 omite tope 70', () => {
    const f = parseFilaReporteBecas({
      codcli: 'X',
      prom_anio: 5.0,
      tiene_exige_promedio: true,
      resultado_art13: 'BAJA',
      becas: [
        {
          codben: '1744',
          descripcion: 'Beca Talento Presencial',
          porc: 100,
          monto: 4000000,
          exige_promedio: true,
          omite_tope_70: true,
        },
      ],
    })!
    expect(f.cantidad_becas).toBe(1)
    expect(f.becas[0].omite_tope_70).toBe(true)
    expect(f.resultado_art13).toBe('BAJA')
    expect(ETIQUETA_ART13.BAJA).toBe('Baja %')
  })

  it('parsea KPI y chips', () => {
    const k = parseKpiReporteBecas([{ matriculados_mol: 10, con_beca: 7, art13_baja: 2 }])
    expect(k.con_beca).toBe(7)
    expect(k.art13_baja).toBe(2)
    const f = parseFilaReporteBecas({
      codcli: '1',
      cantidad_becas: 1,
      resultado_art13: 'BAJA',
      becas: [{ codben: '1756', descripcion: 'Apoyo', porc: 15, monto: 1, exige_promedio: true }],
    })!
    expect(aplicaChipBecas(f, 'BAJA')).toBe(true)
    expect(aplicaChipBecas(f, 'sin_beca')).toBe(false)
  })
})
