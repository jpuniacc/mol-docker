export type UltimaRespuestaTyc = {
  accion: 'acepta' | 'rechaza'
  tycUpdatedAt: string
} | null

function mismoInstante(a: string, b: string): boolean {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a.trim() === b.trim()
  return ta === tb
}

export function debeSaltarPasoTyc(input: {
  aceptadoEnSesion: boolean
  ultimaRespuesta: UltimaRespuestaTyc
  tycUpdatedAtActual: string | null
}): boolean {
  if (input.aceptadoEnSesion) return true
  if (input.ultimaRespuesta?.accion !== 'acepta') return false
  const actual = input.tycUpdatedAtActual?.trim() ?? ''
  if (!actual) return true
  return mismoInstante(input.ultimaRespuesta.tycUpdatedAt, actual)
}
