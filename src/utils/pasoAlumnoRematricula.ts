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

export const NOMBRES_PASO_ALUMNO = [
  'Datos personales',
  'Forma de pago',
  'Firma de contrato',
  'Resumen final',
] as const

export type AccionPulsoPaso = 'nada' | 'aviso' | 'navegar'

export function accionAlPulsarPaso(input: {
  step: number | undefined
  pasoActual: number
  cerrado: boolean
}): AccionPulsoPaso {
  if (input.step === undefined) return 'nada'
  if (input.cerrado) return 'aviso'
  if (input.step === input.pasoActual) return 'nada'
  return 'navegar'
}

export function textoAvisoPasoCerrado(pasoActual: string, pasoPulsado: string): string {
  return `Estás en ${pasoActual}. ${pasoPulsado} no está abierto.`
}

export type EstadoPasoHome = 'pendiente' | 'en_curso' | 'listo'

export type PasoAvanceHome = {
  id: 'datos' | 'pago' | 'firma' | 'resumen'
  label: string
  estado: EstadoPasoHome
}

export type AvanceHomeAlumnoInput = {
  tycAccepted: boolean
  contactoCorreoValidado: string | null
  contactoTelefonoValidado: string | null
  apoderadoConfirmado: boolean | null
  discapacidad: unknown
  pasoAlcanzado: number
  pagoMatricula: unknown
  formaPagoSeleccionada: unknown
  firmaCompletada: boolean
  envioFirmaIniciado: boolean
}

export type CtaAvanceHome = {
  label: string
  routeName:
    | 'matricula-alumno-datos'
    | 'matricula-alumno-forma-pago'
    | 'matricula-alumno-firma'
    | 'matricula-alumno-resumen'
}

function textoGuardado(valor: string | null): boolean {
  return (valor ?? '').trim().length > 0
}

/** El paso 1 está listo cuando Forma de pago ya se puede abrir. */
export function datosPersonalesListos(input: AvanceHomeAlumnoInput): boolean {
  return (
    pasoMaximoAlumno({
      pasoAlcanzado: input.pasoAlcanzado,
      discapacidad: input.discapacidad,
      pagoMatricula: input.pagoMatricula,
      formaPagoSeleccionada: input.formaPagoSeleccionada,
      firmaCompletada: input.firmaCompletada,
    }) >= 2
  )
}

function datosPersonalesEmpezados(input: AvanceHomeAlumnoInput): boolean {
  return (
    input.tycAccepted ||
    textoGuardado(input.contactoCorreoValidado) ||
    textoGuardado(input.contactoTelefonoValidado) ||
    input.apoderadoConfirmado != null ||
    input.discapacidad != null
  )
}

function estadoDe(listo: boolean, empezado: boolean): EstadoPasoHome {
  if (listo) return 'listo'
  if (empezado) return 'en_curso'
  return 'pendiente'
}

export function pasosAvanceHome(input: AvanceHomeAlumnoInput): PasoAvanceHome[] {
  const datosListo = datosPersonalesListos(input)
  const pagoListo = input.pagoMatricula != null || input.formaPagoSeleccionada != null
  const firmaLista = input.firmaCompletada
  return [
    {
      id: 'datos',
      label: 'Datos personales y TyC',
      estado: estadoDe(datosListo, datosPersonalesEmpezados(input)),
    },
    {
      id: 'pago',
      label: 'Forma de pago',
      estado: estadoDe(pagoListo, datosListo && !pagoListo),
    },
    {
      id: 'firma',
      label: 'Firma de contrato',
      estado: estadoDe(firmaLista, pagoListo && !firmaLista),
    },
    {
      id: 'resumen',
      label: 'Resumen final',
      estado: estadoDe(firmaLista, false),
    },
  ]
}

export function ctaAvanceHome(pasos: PasoAvanceHome[]): CtaAvanceHome {
  const datos = pasos.find((paso) => paso.id === 'datos')
  const pago = pasos.find((paso) => paso.id === 'pago')
  const firma = pasos.find((paso) => paso.id === 'firma')
  if (firma?.estado === 'listo') {
    return { label: 'Ver resumen', routeName: 'matricula-alumno-resumen' }
  }
  if (pago?.estado === 'listo') {
    return { label: 'Continuar a firma', routeName: 'matricula-alumno-firma' }
  }
  if (datos?.estado === 'listo') {
    return { label: 'Continuar rematrícula', routeName: 'matricula-alumno-forma-pago' }
  }
  if (datos?.estado === 'en_curso') {
    return { label: 'Continuar rematrícula', routeName: 'matricula-alumno-datos' }
  }
  return { label: 'Iniciar rematrícula', routeName: 'matricula-alumno-datos' }
}

export function pasosListosHome(pasos: PasoAvanceHome[]): number {
  return pasos.filter((paso) => paso.estado === 'listo').length
}

const RUTA_POR_PASO_HOME = {
  datos: 'matricula-alumno-datos',
  pago: 'matricula-alumno-forma-pago',
  firma: 'matricula-alumno-firma',
  resumen: 'matricula-alumno-resumen',
} as const

const NUMERO_POR_PASO_HOME = {
  datos: 1,
  pago: 2,
  firma: 3,
  resumen: 4,
} as const

export type AccionElegirPasoHome =
  | { tipo: 'navegar'; routeName: CtaAvanceHome['routeName'] }
  | { tipo: 'aviso'; texto: string }

export function accionAlElegirPasoHome(
  input: AvanceHomeAlumnoInput,
  id: PasoAvanceHome['id'],
): AccionElegirPasoHome {
  const pasos = pasosAvanceHome(input)
  const destino = pasos.find((paso) => paso.id === id)
  const actual =
    pasos.find((paso) => paso.estado === 'en_curso') ??
    [...pasos].reverse().find((paso) => paso.estado === 'listo') ??
    pasos[0]
  const abierto = !pasoBloqueadoTrasEnvio({
    envioFirmaIniciado: input.envioFirmaIniciado,
    firmaCompletada: input.firmaCompletada,
    step: NUMERO_POR_PASO_HOME[id],
    pasoMaximo: pasoMaximoAlumno({
      pasoAlcanzado: input.pasoAlcanzado,
      discapacidad: input.discapacidad,
      pagoMatricula: input.pagoMatricula,
      formaPagoSeleccionada: input.formaPagoSeleccionada,
      firmaCompletada: input.firmaCompletada,
    }),
  })
  if (!abierto || destino == null || actual == null) {
    return {
      tipo: 'aviso',
      texto: textoAvisoPasoCerrado(actual?.label ?? 'Datos personales y TyC', destino?.label ?? ''),
    }
  }
  return { tipo: 'navegar', routeName: RUTA_POR_PASO_HOME[id] }
}
