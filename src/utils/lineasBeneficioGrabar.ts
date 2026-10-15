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

/**
 * Líneas del plan de pagaré. Parten de las mismas que el grabado Webpay, pero el CAE va sin
 * CODBEN: beneficiosDelPlan lo omite, como antes del código 4. El descuento de matrícula
 * conserva su CODBEN para que el grabado lo inserte en MT_POSBEN.
 * El CAE en cero se conserva en el plan de pagaré, antes del descuento de matrícula.
 */
export function lineasBeneficioPagare(input: {
  lineasArancel: LineaParaDocumentoDescuento[]
  descuentoMatricula: LineaParaDocumentoDescuento | null
  cae: LineaParaDocumentoDescuento | null
}): LineaParaDocumentoDescuento[] {
  const sinCodben = (linea: LineaParaDocumentoDescuento): LineaParaDocumentoDescuento => {
    const { codben: _codben, porc: _porc, montoSolicitado: _montoSolicitado, ...resto } = linea
    return resto
  }
  const lineas = lineasBeneficioGrabar(input).map((linea) =>
    linea === input.cae ? sinCodben(linea) : linea,
  )
  if (input.cae && input.cae.monto <= 0) {
    const indice = lineas.findIndex((linea) => linea.concepto === 'matricula')
    lineas.splice(indice === -1 ? lineas.length : indice, 0, sinCodben(input.cae))
  }
  return lineas
}
