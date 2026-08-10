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
  'Veo que tienes problemas al recibir el código en tu teléfono. Presiona Aceptar para seguir con el proceso; se mantendrá el dato ingresado.'

export const CONTACTO_OTP_SIN_VALIDAR_ACEPTAR = 'Aceptar'

export const CONTACTO_OTP_SIN_VALIDAR_CANCELAR = 'Cancelar'
