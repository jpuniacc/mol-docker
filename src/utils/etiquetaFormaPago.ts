type MedioConcepto = 'webpay' | 'pagare' | null
type FormaPago = 'webpay' | 'pagare' | 'toku' | null

const ETIQUETA: Record<'webpay' | 'pagare' | 'toku', string> = {
  webpay: 'WebPay',
  pagare: 'Pagaré',
  toku: 'TOKU',
}

/** Texto del resumen. Con los dos conceptos definidos manda ese par; si no, el medio único anterior. */
export function etiquetaFormaPago(input: {
  medioMatricula: MedioConcepto
  medioArancel: MedioConcepto
  formaPagoSeleccionada: FormaPago
}): string {
  const matricula = input.medioMatricula
  const arancel = input.medioArancel
  if (matricula && arancel) {
    if (matricula === arancel) return ETIQUETA[matricula]
    return 'WebPay y pagaré'
  }
  const unica = input.formaPagoSeleccionada
  if (!unica) return 'No seleccionada'
  return ETIQUETA[unica]
}
