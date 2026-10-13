/** Alumno en consolidado MOL pero ausente de la cartera oficial (Excel BASE PARA PRUEBA). */
export const TITULO_FUERA_CARTERA_OFICIAL = 'No es posible generar tu rematrícula'

export const MSG_FUERA_CARTERA_OFICIAL =
  'No es posible generar tu proceso de rematrícula en este momento. Comunícate con tu consejero o con Dirección de Vida Universitaria (DVU) para revisar tu situación.'

export const TITULO_BECA_SUBDERE = 'No es posible continuar con tu proceso de rematrícula'

export const CORREO_BECA_SUBDERE = 'servicio.estudiante@uniacc.cl'

export const MSG_BECA_SUBDERE =
  'El estado de tu Beca SUBDERE requiere revisión. Comunícate con servicio.estudiante@uniacc.cl, indicando tu RUT y teléfono de contacto.'

const AVISO_SESION_SUBDERE = 'rematricula-bloqueo-subdere'

export function guardarAvisoSubdere(): void {
  sessionStorage.setItem(AVISO_SESION_SUBDERE, '1')
}

export function tomarAvisoSubdere(): boolean {
  if (sessionStorage.getItem(AVISO_SESION_SUBDERE) !== '1') return false
  sessionStorage.removeItem(AVISO_SESION_SUBDERE)
  return true
}

export type EstadoCarteraOficial = {
  carteraCargada: boolean
  enCartera: boolean
  excluidoMol: boolean
}

export function fueraCarteraDesdeEstado(estado: EstadoCarteraOficial): boolean {
  return estado.carteraCargada && (!estado.enCartera || estado.excluidoMol)
}

export function filaFueraCarteraOficial(row: {
  fuera_cartera_oficial?: boolean | null
}): boolean {
  return row.fuera_cartera_oficial === true
}
