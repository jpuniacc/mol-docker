/** Alumno en consolidado MOL pero ausente de la cartera oficial (Excel BASE PARA PRUEBA). */
export const TITULO_FUERA_CARTERA_OFICIAL = 'No es posible generar tu rematrícula'

export const URL_PORTAL_SOLICITUDES = 'https://solicitudes.uniacc.cl/login'

export const TEXTO_ENLACE_PORTAL_SOLICITUDES = 'Portal de Solicitudes UNIACC'

export const MSG_APODERADO_DESACTUALIZADO =
  'Los datos de su apoderado o sostenedor requieren actualización. Para realizar este trámite, ingrese al Portal de Solicitudes UNIACC y registre su requerimiento en la categoría «Problema con matrícula online».'

export const MSG_FUERA_CARTERA_OFICIAL =
  'El estado de rematrícula requiere revisión antes de continuar con la rematrícula. Para solicitar orientación, ingresa al Portal de Solicitudes UNIACC'

export const TITULO_BECA_SUBDERE = 'No es posible continuar con tu proceso de rematrícula'

export const MSG_BECA_SUBDERE =
  'El estado de tu beneficio SUBDERE requiere revisión antes de continuar con la rematrícula. Para solicitar orientación, ingresa al Portal de Solicitudes UNIACC'

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
