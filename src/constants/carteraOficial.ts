/** Alumno en consolidado MOL pero ausente de la cartera oficial (Excel BASE PARA PRUEBA). */
export const TITULO_FUERA_CARTERA_OFICIAL = 'No es posible generar tu rematrícula'

export const URL_PORTAL_SOLICITUDES = 'https://solicitudes.uniacc.cl/login'

export const TEXTO_ENLACE_PORTAL_SOLICITUDES = 'Portal de Solicitudes UNIACC'

export const MSG_DEUDA_PENDIENTE =
  'No es posible continuar con tu rematrícula. Según nuestros registros, hay situación financiera pendiente por regularizar. Ingresa al Portal de Solicitudes y genera un caso para revisar tu situación.'

export const MSG_APODERADO_DESACTUALIZADO =
  'Los datos de su apoderado o sostenedor requieren actualización. Para realizar este trámite, ingrese al Portal de Solicitudes UNIACC y registre su requerimiento en la categoría «Problema con matrícula online».'

export const MSG_FUERA_CARTERA_OFICIAL =
  'El estado de rematrícula requiere revisión antes de continuar con la rematrícula. Para solicitar orientación, ingresa al Portal de Solicitudes UNIACC'

export const TITULO_BECA_SUBDERE = 'No es posible continuar con tu proceso de rematrícula'

export const MSG_BECA_SUBDERE =
  'El estado de tu beneficio SUBDERE requiere revisión antes de continuar con la rematrícula. Para solicitar orientación, ingresa al Portal de Solicitudes UNIACC'

export const TITULO_MATRICULA_BACKOFFICE = 'Ya te encuentras matriculado'

export const MSG_MATRICULA_BACKOFFICE =
  'Tu proceso de rematrícula fue realizado por Backoffice y ya te encuentras matriculado.'

const AVISO_SESION_SUBDERE = 'rematricula-bloqueo-subdere'
const AVISO_SESION_MATRICULA_BO = 'rematricula-bloqueo-matricula-bo'

export function guardarAvisoSubdere(): void {
  sessionStorage.setItem(AVISO_SESION_SUBDERE, '1')
}

export function tomarAvisoSubdere(): boolean {
  if (sessionStorage.getItem(AVISO_SESION_SUBDERE) !== '1') return false
  sessionStorage.removeItem(AVISO_SESION_SUBDERE)
  return true
}

export function guardarAvisoMatriculaBackoffice(): void {
  sessionStorage.setItem(AVISO_SESION_MATRICULA_BO, '1')
}

export function tomarAvisoMatriculaBackoffice(): boolean {
  if (sessionStorage.getItem(AVISO_SESION_MATRICULA_BO) !== '1') return false
  sessionStorage.removeItem(AVISO_SESION_MATRICULA_BO)
  return true
}

export type EstadoCarteraOficial = {
  carteraCargada: boolean
  enCartera: boolean
  excluidoMol: boolean
  /** Origen de carga en `mnp_cartera_oficial.fuente` (ej. reintegro_2025_ult_mat). */
  fuente?: string | null
}

/** True si la fila de cartera oficial corresponde a campaña de reintegro. */
export function esFuenteReintegroCartera(fuente: string | null | undefined): boolean {
  return (fuente ?? '').trim().toLowerCase().startsWith('reintegro')
}

export function fueraCarteraDesdeEstado(estado: EstadoCarteraOficial): boolean {
  return estado.carteraCargada && (!estado.enCartera || estado.excluidoMol)
}

export function filaFueraCarteraOficial(row: {
  fuera_cartera_oficial?: boolean | null
}): boolean {
  return row.fuera_cartera_oficial === true
}
