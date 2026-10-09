export const CONTACTO_OTP_CONFIG_CODIGO = 'mol'

export const CONTACTO_OTP_EMAIL_SEGUNDOS_DEFAULT = 300
export const CONTACTO_OTP_SMS_SEGUNDOS_DEFAULT = 300
export const CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_DEFAULT = 30
export const CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_DEFAULT = 30

export const CONTACTO_OTP_EMAIL_SEGUNDOS_MIN = 30
export const CONTACTO_OTP_EMAIL_SEGUNDOS_MAX = 3600
export const CONTACTO_OTP_SMS_SEGUNDOS_MIN = 30
export const CONTACTO_OTP_SMS_SEGUNDOS_MAX = 3600
export const CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_MIN = 5
export const CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_MAX = 600
export const CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_MIN = 5
export const CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_MAX = 600

/** 1 envío inicial + 1 reenvío antes de ofrecer continuar sin OTP. */
export const CONTACTO_OTP_MAX_ENVIOS = 2

export const CONTACTO_OTP_SIN_VALIDAR_MENSAJE_CORREO =
  'Veo que tienes problemas al recibir el código en tu correo. Presiona Aceptar para seguir con el proceso; se mantendrá el dato ingresado.'

export const CONTACTO_OTP_SIN_VALIDAR_MENSAJE_TELEFONO =
  'Veo que tienes problemas al recibir el código en tu teléfono móvil (celular). Presiona Aceptar para seguir con el proceso; se mantendrá el dato ingresado.'

export const CONTACTO_OTP_SIN_VALIDAR_ACEPTAR = 'Aceptar'

export const CONTACTO_OTP_SIN_VALIDAR_CANCELAR = 'Cancelar'

/** Texto para el alumno: 300 → "5 minutos", 60 → "1 minuto", 90 → "1 minuto y 30 segundos". */
export function formatearDuracionOtp(totalSegundos: number): string {
  const segundos = Math.max(0, Math.round(totalSegundos))
  const minutos = Math.floor(segundos / 60)
  const resto = segundos % 60
  const etiquetaMinutos = minutos === 1 ? '1 minuto' : `${minutos} minutos`
  const etiquetaSegundos = resto === 1 ? '1 segundo' : `${resto} segundos`
  if (minutos === 0) return etiquetaSegundos
  if (resto === 0) return etiquetaMinutos
  return `${etiquetaMinutos} y ${etiquetaSegundos}`
}
