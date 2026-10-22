export type OrdenGrabadoWebpay =
  | { tipo: 'grabar'; cerrarFicha: boolean }
  | { tipo: 'firmar' }
  | { tipo: 'cerrar-ficha' }
  | { tipo: 'esperar' }

export function ordenGrabadoWebpay(input: {
  ambosWebpay: boolean
  cuentaGrabada: boolean
  firmasListas: boolean
}): OrdenGrabadoWebpay {
  if (!input.ambosWebpay) return { tipo: 'esperar' }
  if (!input.cuentaGrabada) return { tipo: 'grabar', cerrarFicha: false }
  if (!input.firmasListas) return { tipo: 'firmar' }
  return { tipo: 'cerrar-ficha' }
}
