export type MediosCuentaWebpay = {
  medioMatricula: 'webpay' | 'pagare' | null
  medioArancel: 'webpay' | 'pagare' | null
  webpayMatriculaEstado: string | null | undefined
  webpayArancelEstado: string | null | undefined
  webpayMontoMatricula: number | null | undefined
  webpayMontoArancel: number | null | undefined
}

function matriculaListaParaCuentaWebpay(input: MediosCuentaWebpay): boolean {
  if (input.medioMatricula === 'webpay' && input.webpayMatriculaEstado === 'autorizada') {
    return true
  }
  if (input.medioMatricula != null) return false
  // Reintegro / matrícula cubierta: sin medio y monto 0.
  if (typeof input.webpayMontoMatricula === 'number') {
    return input.webpayMontoMatricula === 0
  }
  // Persistencia antigua: el $0 se guardaba como null; con arancel Webpay cerrado es reintegro.
  return (
    input.webpayMontoMatricula == null &&
    input.medioArancel === 'webpay' &&
    input.webpayArancelEstado === 'autorizada'
  )
}

function arancelListaParaCuentaWebpay(input: MediosCuentaWebpay): boolean {
  if (input.medioArancel === 'webpay' && input.webpayArancelEstado === 'autorizada') {
    return true
  }
  // Beca 100 %: sin medio y monto 0.
  return (
    input.medioArancel == null &&
    typeof input.webpayMontoArancel === 'number' &&
    input.webpayMontoArancel === 0
  )
}

/**
 * True cuando hay que grabar la cuenta U+ antes de firmar:
 * dos Webpay, Webpay+arancel $0, o matrícula $0 (reintegro) + Webpay arancel.
 */
export function cuentaWebpayAntesDeFirmar(input: MediosCuentaWebpay): boolean {
  return matriculaListaParaCuentaWebpay(input) && arancelListaParaCuentaWebpay(input)
}
