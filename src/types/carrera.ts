/**
 * Tipo para una carrera de la tabla carreras_uniacc en Supabase
 */
export interface CarreraUniacc {
  id: number
  anio: number
  nombre_programa: string
  nivel_academico: string | null
  descripcion_programa: string
  duracion_programa: string
  modalidad_programa: string | null
  matricula: number
  arancel: number
  requisitos_ingreso: string
  malla: string
  version_simulador: number
  arancel_referencia: number
  anio_arancel_referencia: number
  facultad: string
  codigo_carrera: string | null
}

