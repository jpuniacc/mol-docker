/** Alumno en consolidado MOL pero ausente de la cartera oficial (Excel BASE PARA PRUEBA). */
export const TITULO_FUERA_CARTERA_OFICIAL = 'No es posible generar tu rematrícula'

export const MSG_FUERA_CARTERA_OFICIAL =
  'No es posible generar tu proceso de rematrícula en este momento. Comunícate con tu consejero o con Dirección de Vida Universitaria (DVU) para revisar tu situación.'

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
