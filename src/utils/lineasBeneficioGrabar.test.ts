import { describe, expect, it } from 'vitest'

import { lineasBeneficioGrabar } from '@/utils/lineasBeneficioGrabar'
import type { LineaParaDocumentoDescuento } from '@/utils/documentosDescuentoContrato'

const arancel: LineaParaDocumentoDescuento = {
  concepto: 'arancel',
  flujo: 'INTERNA',
  descripcion: 'Beca Excelencia',
  monto: 500000,
  codben: '2039',
  porc: 20,
  montoSolicitado: 500000,
}

const descuentoMatricula: LineaParaDocumentoDescuento = {
  concepto: 'matricula',
  flujo: 'DESCUENTO_MATRICULA',
  descripcion: 'Descuento octubre',
  monto: 30000,
  codben: '2100',
}

describe('lineasBeneficioGrabar', () => {
  it('conserva el codben del arancel y del descuento de matrícula, sin CAE en cero', () => {
    const lineas = lineasBeneficioGrabar({
      lineasArancel: [arancel],
      descuentoMatricula,
      cae: { concepto: 'arancel', flujo: 'CAE', descripcion: 'Crédito Aval del Estado', monto: 0 },
    })
    expect(lineas).toEqual([arancel, descuentoMatricula])
    expect(lineas[0]?.codben).toBe('2039')
    expect(lineas[1]?.codben).toBe('2100')
    expect(lineas.some((l) => l.flujo === 'CAE')).toBe(false)
  })

  it('guarda el CAE con monto mayor que cero aunque no venga en las líneas de arancel', () => {
    const cae: LineaParaDocumentoDescuento = {
      concepto: 'arancel',
      flujo: 'CAE',
      descripcion: 'Crédito Aval del Estado',
      monto: 1200000,
    }
    const lineas = lineasBeneficioGrabar({
      lineasArancel: [arancel],
      descuentoMatricula: null,
      cae,
    })
    expect(lineas).toEqual([arancel, cae])
  })

  it('descarta líneas de arancel sin monto y filas CAE duplicadas', () => {
    const lineas = lineasBeneficioGrabar({
      lineasArancel: [
        { ...arancel, monto: 0 },
        { concepto: 'arancel', flujo: 'CAE', descripcion: 'CAE dup', monto: 10 },
      ],
      descuentoMatricula: null,
      cae: null,
    })
    expect(lineas).toEqual([])
  })
})
