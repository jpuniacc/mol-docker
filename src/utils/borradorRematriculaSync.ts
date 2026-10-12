export type ClaveBorradorRematricula = {
  codcli: string
  anio: number
  semestre: number
}

export type DecisionBorrador = 'usar-servidor' | 'subir-sesion' | 'nada'

export function claveBorradorValida(
  codcli: string | null | undefined,
  anio: number | null,
  semestre: number | null,
): ClaveBorradorRematricula | null {
  const limpio = (codcli ?? '').trim()
  if (!limpio || limpio === '—' || anio == null || semestre == null) return null
  return { codcli: limpio, anio, semestre }
}

/** Qué copia queda cuando la sesión y el servidor no coinciden. */
export function decidirBorrador(input: {
  sesionTieneAvance: boolean
  pendienteDeSubir: boolean
  sesionActualizadoEn: string | null
  servidorActualizadoEn: string | null
}): DecisionBorrador {
  if (input.pendienteDeSubir && input.sesionTieneAvance) return 'subir-sesion'
  if (!input.servidorActualizadoEn) {
    return input.sesionTieneAvance ? 'subir-sesion' : 'nada'
  }
  if (!input.sesionTieneAvance) return 'usar-servidor'
  const sesionMs = input.sesionActualizadoEn ? Date.parse(input.sesionActualizadoEn) : 0
  const servidorMs = Date.parse(input.servidorActualizadoEn)
  if (Number.isFinite(servidorMs) && servidorMs > sesionMs) return 'usar-servidor'
  return 'nada'
}
