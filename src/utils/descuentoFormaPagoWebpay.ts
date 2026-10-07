/** 5 % del arancel pagado con Webpay, sobre el saldo después de beneficios. */
export const PORC_DESCUENTO_FORMA_PAGO_WEBPAY = 0.05

export function descuentoFormaPagoArancel(saldoTrasBeneficios: number): number {
  const saldo = Math.max(0, saldoTrasBeneficios)
  return Math.round(saldo * PORC_DESCUENTO_FORMA_PAGO_WEBPAY)
}

/** Lo que cobra Transbank: el saldo del arancel menos el 5 %. */
export function montoWebpayArancel(saldoTrasBeneficios: number): number {
  const saldo = Math.max(0, saldoTrasBeneficios)
  return saldo - descuentoFormaPagoArancel(saldo)
}
