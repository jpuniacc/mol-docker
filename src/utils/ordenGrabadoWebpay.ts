export type OrdenGrabadoWebpay =
  | { tipo: 'grabar'; cerrarFicha: boolean }
  | { tipo: 'firmar' }
  | { tipo: 'cerrar-ficha' }
  | { tipo: 'esperar' }

export function ordenGrabadoWebpay(input: {
  ambosWebpay: boolean
  numOperacion: string | null
  firmasListas: boolean
}): OrdenGrabadoWebpay {
  if (!input.ambosWebpay) return { tipo: 'esperar' }
  const tieneNumero = /^\d+$/.test((input.numOperacion ?? '').trim())
  if (!tieneNumero) return { tipo: 'grabar', cerrarFicha: false }
  if (!input.firmasListas) return { tipo: 'firmar' }
  return { tipo: 'cerrar-ficha' }
}
