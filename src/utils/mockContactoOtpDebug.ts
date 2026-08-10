const PREFIX = '[mock-contacto-otp]'

/** Logs de depuración del flujo OTP contacto mock (filtrar consola por `mock-contacto-otp`). */
export function logMockContactoOtp(label: string, data?: unknown): void {
  if (data === undefined) {
    console.log(PREFIX, label)
  } else {
    console.log(PREFIX, label, data)
  }
}
