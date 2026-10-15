import { describe, expect, it } from 'vitest'

import * as XLSX from 'xlsx'

import { filasDesdeMatriz, libroPlantillaDesbloqueo } from './parseDesbloqueoTomaRamosExcel'

describe('filasDesdeMatriz', () => {
  it('lee RUT, DV y CODCLI', () => {
    const parsed = filasDesdeMatriz([
      ['RUT', 'DV', 'CODCLI'],
      ['20974688', '3', '20261MUIN1DR004'],
      ['', '', ''],
    ])
    expect(parsed.error).toBeNull()
    expect(parsed.filas).toEqual([
      { rut: '20974688', dv: '3', codcli: '20261MUIN1DR004' },
    ])
  })

  it('acepta DIG como DV', () => {
    const parsed = filasDesdeMatriz([
      ['RUT', 'DIG', 'CODCLI'],
      ['22045228', 'K', '20261PSIC1DR034'],
    ])
    expect(parsed.filas[0]?.dv).toBe('K')
  })

  it('la plantilla trae RUT, DV y CODCLI', () => {
    const libro = libroPlantillaDesbloqueo()
    const hoja = libro.Sheets.Desbloqueo
    const matriz = XLSX.utils.sheet_to_json(hoja!, { header: 1, defval: '' }) as unknown[][]
    expect(matriz[0]).toEqual(['RUT', 'DV', 'CODCLI'])
    const conFila = filasDesdeMatriz([
      matriz[0] ?? [],
      ['20974688', '3', '20261MUIN1DR004'],
    ])
    expect(conFila.filas).toHaveLength(1)
  })

  it('pide las tres columnas', () => {
    const parsed = filasDesdeMatriz([['RUT', 'NOMBRE'], ['20974688', 'Ana']])
    expect(parsed.error).toContain('CODCLI')
  })
})
