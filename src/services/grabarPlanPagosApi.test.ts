import { describe, expect, it } from 'vitest'

import { armarGrabarCuentaMixta } from '@/services/grabarPlanPagosApi'
import type { MockCuotaPagareDetalle, MockPagoMatricula } from '@/stores/mockMatriculaContext'

function cuota(item: 1 | 2, monto: number, folio: string): MockCuotaPagareDetalle {
  return {
    documento: 'PAGARÉ',
    correlativo: folio,
    vencimiento: '2026-10-15',
    monto,
    totalAcumulado: monto,
    items: item === 1 ? 'MATRICULA' : 'ARANCEL',
    item,
    cuota: 1,
    totalCuotas: 12,
    idDocumento: 5,
    ctapagnum: folio,
    ctadocnum: folio,
  }
}

function pago(cuotasDetalle: MockCuotaPagareDetalle[]): MockPagoMatricula {
  return {
    medio: 'pagare',
    tipodoc: '5',
    nombre: 'PAGARÉ',
    cuotas: 12,
    fechaInicio: '2026-10-15',
    monto: cuotasDetalle.reduce((suma, fila) => suma + fila.monto, 0),
    cuotasDetalle,
    contrato: '20271PSIC1DR0001',
  }
}

const base = {
  rut: '19.136.091-2',
  codcliAcademico: '20241PSIC1DR033',
  codigoCarrera: 'PSIC1DR',
  ano: 2027,
  periodo: 1 as const,
  caja: 997,
}

describe('armarGrabarCuentaMixta', () => {
  it('matrícula Webpay y arancel pagaré manda el monto de la tarjeta y el folio del pagaré', () => {
    const armado = armarGrabarCuentaMixta({
      ...base,
      pago: pago([cuota(2, 4_140_000, '90121412967')]),
      medioMatricula: 'webpay',
      medioArancel: 'pagare',
      montoWebpayMatricula: 250_000,
      montoWebpayArancel: null,
    })
    expect(armado.ok).toBe(true)
    if (!armado.ok) return
    expect(armado.payload.medioMatricula).toBe('webpay')
    expect(armado.payload.medioArancel).toBe('pagare')
    expect(armado.payload.montoMatricula).toBe(250_000)
    expect(armado.payload.montoArancel).toBe(4_140_000)
    expect(armado.payload.corrpagMatricula).toBe('0')
    expect(armado.payload.corrpagArancel).toBe('90121412967')
    expect(armado.payload.cuotas).toBe(12)
    expect(armado.payload.cerrarFicha).toBe(true)
  })

  it('matrícula pagaré y arancel Webpay invierte folio y monto', () => {
    const armado = armarGrabarCuentaMixta({
      ...base,
      pago: pago([cuota(1, 250_000, '90121412966')]),
      medioMatricula: 'pagare',
      medioArancel: 'webpay',
      montoWebpayMatricula: null,
      montoWebpayArancel: 4_140_000,
    })
    expect(armado.ok).toBe(true)
    if (!armado.ok) return
    expect(armado.payload.montoMatricula).toBe(250_000)
    expect(armado.payload.montoArancel).toBe(4_140_000)
    expect(armado.payload.corrpagMatricula).toBe('90121412966')
    expect(armado.payload.corrpagArancel).toBe('0')
    expect(armado.payload.medioMatricula).toBe('pagare')
    expect(armado.payload.medioArancel).toBe('webpay')
  })
})
