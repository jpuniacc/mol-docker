import { describe, expect, it } from 'vitest'
import { armarGrabarCuentaWebpay } from '@/utils/grabarCuentaWebpay'

const base = {
  rut: '19.740.769-7',
  codcliAcademico: '20241PSIC1DR033',
  codigoCarrera: 'PSIC1DR',
  ano: 2027,
  periodo: 1 as const,
  caja: 997,
  contrato: '20271PSIC1DR0001',
  fechaInicio: '2026-10-07',
  montoMatricula: 250_000,
  montoArancel: 4_140_000,
  descuentos: [],
  cerrarFicha: false,
}

describe('armarGrabarCuentaWebpay', () => {
  it('manda el saldo antes del 5 % y no inventa folios de pagaré', () => {
    const armado = armarGrabarCuentaWebpay(base)
    expect(armado.ok).toBe(true)
    if (!armado.ok) return
    expect(armado.payload.codcli).toBe('19740769')
    expect(armado.payload.montoMatricula).toBe(250_000)
    expect(armado.payload.montoArancel).toBe(4_140_000)
    expect(armado.payload.cuotas).toBe(1)
    expect(armado.payload.corrpagMatricula).toBe('0')
    expect(armado.payload.corrpagArancel).toBe('0')
    expect(armado.payload.medioMatricula).toBe('webpay')
    expect(armado.payload.medioArancel).toBe('webpay')
    expect(armado.payload.cerrarFicha).toBe(false)
    expect(armado.payload.beneficios).toEqual([])
  })

  it('incluye la beca con su folio y deja fuera un monto en cero', () => {
    const armado = armarGrabarCuentaWebpay({
      ...base,
      descuentos: [
        {
          concepto: 'arancel',
          documento: '90121376727',
          tipoDocumento: 'BECAS INTERNAS ASIGNADAS',
          descripcion: 'Beca',
          detalle: 'BECAS INTERNAS ASIGNADAS',
          monto: 125_000,
          vencimiento: '29/12/2027',
          codben: '2039',
          porc: 50,
          montoSolicitado: 125_000,
        },
        {
          concepto: 'arancel',
          documento: '90121376728',
          tipoDocumento: 'PAGARÉ CAE',
          descripcion: 'CAE',
          detalle: 'PAGARÉ CAE',
          monto: 0,
          vencimiento: '29/12/2027',
          codben: '4',
          porc: 0,
          montoSolicitado: 0,
        },
      ],
    })
    expect(armado.ok).toBe(true)
    if (!armado.ok) return
    expect(armado.payload.beneficios).toEqual([
      {
        codben: 2039,
        porcSol: 50,
        porcApr: 50,
        montoSol: 125_000,
        montoApr: 125_000,
        monto: 125_000,
        aplicable: 1,
        concepto: 'A',
        corrpag: '90121376727',
      },
    ])
  })

  it('rechaza un beneficio con monto si no trae CODBEN o folio', () => {
    const sinCodigo = armarGrabarCuentaWebpay({
      ...base,
      descuentos: [
        {
          concepto: 'matricula',
          documento: '90121376727',
          tipoDocumento: 'DESCUENTO MATRÍCULA',
          descripcion: 'Mes',
          detalle: 'DESCUENTO MATRÍCULA',
          monto: 50_000,
          vencimiento: '29/12/2027',
          codben: null,
        },
      ],
    })
    expect(sinCodigo).toEqual({ ok: false, error: 'Falta el CODBEN de un beneficio' })
  })
})
