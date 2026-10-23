/** Usuario sin `mv_usuario`: respuesta OK pero sin fila vigente en `mnp_datos_alumnos`. */
export const MSG_ACCESO_MNP_NO_VIGENTE =
  'Su estado no se encuentra vigente en los registros de la universidad. No puede ingresar al sistema.'

export const TITULO_ACCESO_NO_VIGENTE = 'No es posible continuar con tu proceso de rematrícula'

export const MSG_SITUACION_ACADEMICA =
  'Tu situación académica requiere revisión antes de continuar con la rematrícula. Para solicitar orientación, ingresa al Portal de Solicitudes UNIACC y selecciona la categoría correspondiente.'

/** Alumno con filas en MNP, ninguna con estado académico VIGENTE y que no es SUBDERE. */
export function mensajeAccesoNoVigente(_estados: Array<string | null | undefined>): string {
  return MSG_SITUACION_ACADEMICA
}

export function esEstadoAcademicoVigente(estado: string | null | undefined): boolean {
  return (estado ?? '').trim().toUpperCase() === 'VIGENTE'
}

/** Error de red, RLS o consulta al verificar alumno MNP. */
export const MSG_ACCESO_MNP_VERIFICACION_FALLIDA =
  'No se pudo verificar su estado en los registros. Intente más tarde o contacte a soporte.'
