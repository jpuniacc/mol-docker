import { describe, expect, it } from 'vitest'
import {
  aplicaChip,
  aplicaMedio,
  filasReportePagosACsv,
  normalizarMedio,
  parseFilaReportePagos,
  parseKpiReportePagos,
  porCarrera,
  resumirConcepto,
  serieDiaria,
  type FilaReportePagosRematricula,
} from './reportePagosRematricula'

const fila = (o: Partial<FilaReportePagosRematricula>): FilaReportePagosRematricula =>
  parseFilaReportePagos({ codcli: 'X', medio_matricula: 'pendiente', medio_arancel: 'pendiente', ...o })!

describe('reportePagosRematricula v2', () => {
  it('normaliza medio desconocido o null a pendiente', () => {
    expect(normalizarMedio('webpay')).toBe('webpay')
    expect(normalizarMedio('PAGARE')).toBe('pagare')
    expect(normalizarMedio(null)).toBe('pendiente')
    expect(normalizarMedio('toku')).toBe('pendiente')
  })

  it('parsea fila y descarta sin codcli', () => {
    expect(parseFilaReportePagos({ codcli: '' })).toBeNull()
    const f = parseFilaReportePagos({ codcli: '1', medio_matricula: 'pagare', monto_matricula: '250000', cuotas_matricula: 10 })!
    expect(f.monto_matricula).toBe(250000)
    expect(f.cuotas_matricula).toBe(10)
    expect(f.medio_arancel).toBe('pendiente')
  })

  it('parsea KPI por concepto y medio', () => {
    const k = parseKpiReportePagos([{ matriculados_mol: 3, mat_webpay_alumnos: 1, mat_webpay_monto: '200000', ara_pagare_alumnos: 2, ara_pagare_monto: 100 }])
    expect(k.matriculados_mol).toBe(3)
    expect(k.matricula.webpay_monto).toBe(200000)
    expect(k.arancel.pagare).toBe(2)
    expect(k.arancel.pendiente).toBe(0)
  })

  it('resume montos por concepto', () => {
    const filas = [
      fila({ medio_matricula: 'webpay', monto_matricula: 200000, medio_arancel: 'pagare', monto_arancel: 3000000 }),
      fila({ medio_matricula: 'pagare', monto_matricula: 250000, medio_arancel: 'pagare', monto_arancel: 1000000 }),
      fila({}),
    ]
    expect(resumirConcepto(filas, 'matricula')).toEqual({ webpay: 1, webpay_monto: 200000, pagare: 1, pagare_monto: 250000, pendiente: 1 })
    expect(resumirConcepto(filas, 'arancel')).toEqual({ webpay: 0, webpay_monto: 0, pagare: 2, pagare_monto: 4000000, pendiente: 1 })
  })

  it('chips y filtro de medio', () => {
    const f = fila({ medio_matricula: 'webpay', medio_arancel: 'pagare' })
    expect(aplicaChip(f, 'todos')).toBe(true)
    expect(aplicaChip(f, 'matricula:webpay')).toBe(true)
    expect(aplicaChip(f, 'arancel:webpay')).toBe(false)
    expect(aplicaMedio(f, 'pagare')).toBe(true)
    expect(aplicaMedio(f, 'pendiente')).toBe(false)
  })

  it('serie diaria acumulada en hora de Santiago', () => {
    const s = serieDiaria([
      fila({ fec_mat: '2026-11-02T12:00:00Z', medio_matricula: 'webpay' }),
      fila({ fec_mat: '2026-11-03T02:00:00Z' }), // 02-11 23:00 en Santiago
      fila({ fec_mat: '2026-11-04T15:00:00Z', medio_matricula: 'pagare' }),
      fila({ fec_mat: null }),
    ])
    expect(s).toEqual([
      { fecha: '2026-11-02', dia: 2, acumulado: 2, acumuladoConMedio: 1 },
      { fecha: '2026-11-04', dia: 1, acumulado: 3, acumuladoConMedio: 2 },
    ])
  })

  it('agrupa por carrera con Otras', () => {
    const filas = ['A', 'A', 'B', 'C', 'D'].map((c) => fila({ nombre_carrera: c, medio_matricula: 'pagare' }))
    const r = porCarrera(filas, 'matricula', 3)
    expect(r[0]).toEqual({ carrera: 'A', total: 2, webpay: 0, pagare: 2, pendiente: 0 })
    expect(r[2].carrera).toBe('Otras (2)')
    expect(r[2].total).toBe(2)
  })

  it('CSV escapa comas', () => {
    const csv = filasReportePagosACsv([fila({ nombre_alumno: 'Pérez, Ana' })])
    expect(csv.split('\n')[1]).toContain('"Pérez, Ana"')
  })
})
