export const TELEFONO_CHILE_PREFIJO = '+56'
export const TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO = 9
export const TELEFONO_CHILE_INPUT_MAX = 20

const DIGITOS_CON_PAIS = 11

/** Dígitos nacionales. Quita 56 solo si el pegado trae 11 dígitos. */
export function extraerDigitosTelefonoChile(raw: string): string {
  const digitos = raw.replace(/\D/g, '')
  if (digitos.length === DIGITOS_CON_PAIS && digitos.startsWith('56')) {
    return digitos.slice(2)
  }
  if (digitos.length === TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO) {
    return digitos
  }
  return digitos.slice(0, DIGITOS_CON_PAIS)
}

/** +56 más los dígitos extraídos. Vacío si no hay dígitos. */
export function normalizarTelefonoChile(raw: string): string {
  const digitos = extraerDigitosTelefonoChile(raw)
  if (!digitos) return ''
  return `${TELEFONO_CHILE_PREFIJO}${digitos}`
}

export function telefonoChileEsValido(s: string): boolean {
  return new RegExp(`^\\+56\\d{${TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO}}$`).test(s.trim())
}

/** Máscara de auditoría: +56*****4321. Inválido: ***. */
export function enmascararTelefonoChile(s: string): string {
  const norm = normalizarTelefonoChile(s)
  if (!telefonoChileEsValido(norm)) return '***'
  return `${TELEFONO_CHILE_PREFIJO}*****${norm.slice(-4)}`
}
