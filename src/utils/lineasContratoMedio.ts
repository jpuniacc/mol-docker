import type { ContratoMatriculaViewModel } from '@/types/contratoMatricula'

export type MedioContrato = 'pagare' | 'webpay'

export type BloquesContrato = {
  muestraCuotasMatricula: boolean
  muestraCuotasArancel: boolean
  muestraPagadoWebpayMatricula: boolean
  muestraPagadoWebpayArancel: boolean
  muestraMandatoPagare: boolean
  descuentoFormaPagoArancel: number
  montoWebpayMatricula: number
  montoWebpayArancel: number
}

/** View-model del contrato más lo que decide el medio de cada concepto. */
export type ContratoMatriculaViewModelConMedio = ContratoMatriculaViewModel & {
  bloques: BloquesContrato
}

export function bloquesContrato(input: {
  medioMatricula: 'pagare' | 'webpay'
  medioArancel: 'pagare' | 'webpay'
  descuentoFormaPagoArancel: number
  montoWebpayMatricula: number
  montoWebpayArancel: number
}): {
  muestraCuotasMatricula: boolean
  muestraCuotasArancel: boolean
  muestraPagadoWebpayMatricula: boolean
  muestraPagadoWebpayArancel: boolean
  muestraMandatoPagare: boolean
  descuentoFormaPagoArancel: number
  montoWebpayMatricula: number
  montoWebpayArancel: number
} {
  return {
    muestraCuotasMatricula: input.medioMatricula === 'pagare',
    muestraCuotasArancel: input.medioArancel === 'pagare',
    muestraPagadoWebpayMatricula: input.medioMatricula === 'webpay',
    muestraPagadoWebpayArancel: input.medioArancel === 'webpay',
    muestraMandatoPagare: true,
    descuentoFormaPagoArancel: input.medioArancel === 'webpay' ? input.descuentoFormaPagoArancel : 0,
    montoWebpayMatricula: input.medioMatricula === 'webpay' ? input.montoWebpayMatricula : 0,
    montoWebpayArancel: input.medioArancel === 'webpay' ? input.montoWebpayArancel : 0,
  }
}
