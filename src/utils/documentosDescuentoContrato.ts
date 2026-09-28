import { incrementPeek } from '@/utils/pagareCuotasDraft'

/** Tipo de documento de pago, como en la cuenta corriente. */
export const TIPO_DOC_BECAS_INTERNAS = 'BECAS INTERNAS ASIGNADAS'
export const TIPO_DOC_BECAS_ESTATALES = 'BECAS ESTATALES ASIGNADAS'
export const TIPO_DOC_CONVENIOS = 'DESCTO. CONVENIOS ASIGNADOS'
export const TIPO_DOC_CAE = 'PAGARÉ CAE'

export type LineaParaDocumentoDescuento = {
  concepto: 'matricula' | 'arancel'
  flujo: string | null
  descripcion: string
  monto: number
}

export type DocumentoDescuentoAsignado = {
  concepto: 'matricula' | 'arancel'
  /** Correlativo CORRPAGNUM, para grabarlo después en la cuenta corriente. */
  documento: string
  tipoDocumento: string
  descripcion: string
  detalle: string
  monto: number
  vencimiento: string
}

export function tipoDocumentoDescuento(flujo: string | null): string {
  if (flujo === 'CONVENIO') return TIPO_DOC_CONVENIOS
  if (flujo === 'ESTATAL') return TIPO_DOC_BECAS_ESTATALES
  if (flujo === 'CAE') return TIPO_DOC_CAE
  return TIPO_DOC_BECAS_INTERNAS
}

/**
 * Un solo peek CORRPAGNUM. Matrícula = peek, pagaré de arancel = peek+1,
 * y cada convenio, beca, estatal o CAE toma el correlativo siguiente.
 */
export function asignarDocumentosDescuento(input: {
  peek: string
  lineas: LineaParaDocumentoDescuento[]
  vencimiento: string
  reservadosPagare?: number
}): DocumentoDescuentoAsignado[] {
  const reservados = input.reservadosPagare ?? 2
  const ordenadas = [...input.lineas].sort((a, b) => {
    if (a.concepto === b.concepto) return 0
    return a.concepto === 'matricula' ? -1 : 1
  })
  return ordenadas
    .filter((linea) => linea.monto > 0 || linea.flujo === 'CAE')
    .map((linea, index) => {
      const tipoDocumento = tipoDocumentoDescuento(linea.flujo)
      return {
        concepto: linea.concepto,
        documento: incrementPeek(input.peek, reservados + index),
        tipoDocumento,
        descripcion: linea.descripcion,
        detalle: tipoDocumento,
        monto: linea.monto,
        vencimiento: input.vencimiento,
      }
    })
}
