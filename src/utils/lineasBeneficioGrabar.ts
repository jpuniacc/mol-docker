import type { LineaParaDocumentoDescuento } from '@/utils/documentosDescuentoContrato'

/**
 * Beneficios que se grabarán en la cuenta, sin folio. El correlativo se asigna después
 * con asignarDocumentosDescuento. El CAE solo entra con monto mayor que cero.
 */
export function lineasBeneficioGrabar(input: {
  lineasArancel: LineaParaDocumentoDescuento[]
  descuentoMatricula: LineaParaDocumentoDescuento | null
  cae: LineaParaDocumentoDescuento | null
}): LineaParaDocumentoDescuento[] {
  const lineas = input.lineasArancel.filter((linea) => linea.flujo !== 'CAE' && linea.monto > 0)
  if (input.cae && input.cae.monto > 0) lineas.push(input.cae)
  if (input.descuentoMatricula && input.descuentoMatricula.monto > 0) {
    lineas.push(input.descuentoMatricula)
  }
  return lineas
}
