import { describe, expect, it } from 'vitest'

import {
  filasReportePagosACsv,
  parseFilaReportePagos,
  parseKpiReportePagos,
  type FilaReportePagosRematricula,
} from './reportePagosRematricula'

describe('parseFilaReportePagos', () => {
  it('acepta fila MOL con webpay', () => {
    const f = parseFilaReportePagos({
      codcli: '20241X',
      canal: 'MOL',
      pago_matricula: true,
      monto_matricula: 200000,
      pago_arancel: false,
    })
    expect(f?.canal).toBe('MOL')
    expect(f?.pago_matricula).toBe(true)
    expect(f?.monto_matricula).toBe(200000)
    expect(f?.pago_arancel).toBe(false)
  })

  it('rechaza canal inválido', () => {
    expect(parseFilaReportePagos({ codcli: 'x', canal: 'X' })).toBeNull()
  })
})

describe('parseKpiReportePagos', () => {
  it('lee totales', () => {
    const k = parseKpiReportePagos([
      {
        matriculados_total: 61,
        matriculados_mol: 50,
        matriculados_bo: 11,
        webpay_matricula_alumnos: 40,
        webpay_matricula_monto: 1000,
        webpay_arancel_alumnos: 5,
        webpay_arancel_monto: 500,
        mol_sin_webpay_matricula: 10,
      },
    ])
    expect(k.matriculados_mol).toBe(50)
    expect(k.mol_sin_webpay_matricula).toBe(10)
  })
})

describe('filasReportePagosACsv', () => {
  it('incluye header y escapa comillas', () => {
    const filas: FilaReportePagosRematricula[] = [
      {
        codcli: 'A1',
        rut: '1-9',
        rut_norm: '19',
        nombre_alumno: 'Pérez, "Juan"',
        codigo_carrera: null,
        nombre_carrera: 'Psico',
        canal: 'MOL',
        pago_matricula: true,
        monto_matricula: 1,
        fecha_matricula: null,
        buy_order_matricula: null,
        pago_arancel: false,
        monto_arancel: null,
        fecha_arancel: null,
        buy_order_arancel: null,
      },
    ]
    const csv = filasReportePagosACsv(filas)
    expect(csv.split('\n')[0]).toContain('codcli')
    expect(csv).toContain('"Pérez, ""Juan"""')
    expect(csv).toContain(',si,1,')
  })
})
