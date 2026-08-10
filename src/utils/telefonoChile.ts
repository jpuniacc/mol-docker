export const TELEFONO_CHILE_PREFIJO = '+569'
export const TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO = 8

/** Extrae solo los 8 dígitos del abonado (sin prefijo país). */
export function extraerDigitosTelefonoChile(raw: string): string {
  const digitos = raw.replace(/\D/g, '')
  if (digitos.startsWith('569')) {
    return digitos.slice(3, 3 + TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO)
  }
  if (digitos.startsWith('56')) {
    return digitos.slice(2, 2 + TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO)
  }
  return digitos.slice(0, TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO)
}

/** Valor normalizado E.164 Chile móvil: +56912345678 */
export function normalizarTelefonoChile(raw: string): string {
  const digitos = extraerDigitosTelefonoChile(raw)
  if (!digitos) return ''
  return `${TELEFONO_CHILE_PREFIJO}${digitos}`
}

export function telefonoChileEsValido(s: string): boolean {
  return new RegExp(`^\\+569\\d{${TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO}}$`).test(s.trim())
}

/** Máscara para auditoría: +569****5678 */
export function enmascararTelefonoChile(s: string): string {
  const norm = normalizarTelefonoChile(s)
  if (!telefonoChileEsValido(norm)) return '***'
  const ultimos = norm.slice(-4)
  return `${TELEFONO_CHILE_PREFIJO}****${ultimos}`
}
