export const PASOS_ALUMNO_REMATRICULA = [
  'matricula-alumno-datos',
  'matricula-alumno-forma-pago',
  'matricula-alumno-firma',
  'matricula-alumno-resumen',
] as const

export function indicePasoAlumno(name: string | symbol | null | undefined): number {
  if (typeof name !== 'string') return 0
  const indice = PASOS_ALUMNO_REMATRICULA.indexOf(
    name as (typeof PASOS_ALUMNO_REMATRICULA)[number],
  )
  return indice >= 0 ? indice + 1 : 0
}

export function pasoMaximoAlumno(ctx: {
  pasoAlcanzado: number
  discapacidad: unknown
  pagoMatricula: unknown
  formaPagoSeleccionada: unknown
  firmaCompletada: boolean
}): number {
  let paso = ctx.pasoAlcanzado
  if (ctx.discapacidad != null) paso = Math.max(paso, 2)
  if (ctx.pagoMatricula != null || ctx.formaPagoSeleccionada != null) paso = Math.max(paso, 3)
  if (ctx.firmaCompletada) paso = 4
  if (paso < 1) return 1
  if (paso > 4) return 4
  return paso
}

const RUTA_FIRMA_ALUMNO = 'matricula-alumno-firma'

export function rutaSiEnvioFirmaBloquea(
  envioFirmaIniciado: boolean,
  nombreRuta: string | symbol | null | undefined,
): typeof RUTA_FIRMA_ALUMNO | null {
  if (!envioFirmaIniciado || typeof nombreRuta !== 'string') return null
  if (
    nombreRuta === 'matricula-alumno-datos' ||
    nombreRuta === 'matricula-alumno-forma-pago'
  ) {
    return RUTA_FIRMA_ALUMNO
  }
  return null
}

export function pasoBloqueadoTrasEnvio(input: {
  envioFirmaIniciado: boolean
  firmaCompletada: boolean
  step: number
  pasoMaximo: number
}): boolean {
  if (input.firmaCompletada) return input.step !== 4
  if (input.envioFirmaIniciado && (input.step === 1 || input.step === 2)) return true
  return input.step > input.pasoMaximo
}
