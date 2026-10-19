export const REINTENTOS_ENLACE_FIRMA = 3
export const ESPERA_REINTENTO_ENLACE_MS = 3_000

export function esEnlaceFirmaPendiente(error: string): boolean {
  return error.toLowerCase().includes('enlace de firma pendiente')
}

export function intentosAntesDelModalEnlace(): number {
  return REINTENTOS_ENLACE_FIRMA + 1
}
