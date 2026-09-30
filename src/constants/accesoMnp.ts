/** Usuario sin `mv_usuario`: respuesta OK pero sin fila vigente en `mnp_datos_alumnos`. */
export const MSG_ACCESO_MNP_NO_VIGENTE =
  'Su estado no se encuentra vigente en los registros de la universidad. No puede ingresar al sistema.'

export const TITULO_ACCESO_NO_VIGENTE = 'No es posible ingresar'

/** Alumno con filas en MNP, ninguna con estado académico VIGENTE. */
export function mensajeAccesoNoVigente(estados: Array<string | null | undefined>): string {
  const unicos = [
    ...new Set(
      estados
        .map((estado) => (estado ?? '').trim())
        .filter((estado) => estado.length > 0),
    ),
  ]
  const lista = unicos.length > 0 ? unicos.join(', ') : 'no vigente'
  return `No es posible ingresar a la rematrícula. Tu estado académico es ${lista}. Comunícate con la Dirección de Vida Universitaria (DVU).`
}

export function esEstadoAcademicoVigente(estado: string | null | undefined): boolean {
  return (estado ?? '').trim().toUpperCase() === 'VIGENTE'
}

/** Error de red, RLS o consulta al verificar alumno MNP. */
export const MSG_ACCESO_MNP_VERIFICACION_FALLIDA =
  'No se pudo verificar su estado en los registros. Intente más tarde o contacte a soporte.'
