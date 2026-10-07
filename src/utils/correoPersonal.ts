export const MENSAJE_CORREO_PERSONAL_UNIACC =
  'El correo personal no puede ser de la universidad (@uniacc). Usa un correo propio.'

/**
 * Dominio institucional UNIACC: `uniacc`, `uniacc.cl`, `uniacc.edu` o un subdominio
 * (`mail.uniacc.cl`). No marca coincidencias parciales como `myuniacc.com`.
 */
export function esCorreoDominioUniacc(email: string): boolean {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at < 1 || at === trimmed.length - 1) return false
  const domain = trimmed.slice(at + 1).replace(/\.$/, '')
  if (!domain) return false
  return (
    domain === 'uniacc' ||
    domain.startsWith('uniacc.') ||
    domain.endsWith('.uniacc') ||
    domain.includes('.uniacc.')
  )
}
