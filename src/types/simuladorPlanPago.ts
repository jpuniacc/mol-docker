import type { PlanPagosMvBeneficioDetalle, PlanPagosMvRow } from '@/types/supabase'

export type SimuladorConcepto = 'MATRICULA' | 'ARANCEL'

export type SimuladorTipoPagoRow = {
  id: string
  codigo: string
  nombre: string
  concepto: 'MATRICULA' | 'ARANCEL' | 'AMBOS'
  cuotas_max: number
  activo: boolean
  orden: number
  created_at: string
}

export type SimuladorConvenioRow = {
  id: string
  codigo: string
  nombre: string
  concepto: 'MATRICULA' | 'ARANCEL' | 'AMBOS'
  tipo_descuento: 'PORCENTAJE' | 'MONTO'
  valor_descuento: number
  activo: boolean
  orden: number
  created_at: string
}

export type SimuladorBecaEstadoRow = {
  id: string
  codigo: string
  nombre: string
  concepto: 'MATRICULA' | 'ARANCEL' | 'AMBOS'
  tipo_descuento: 'PORCENTAJE' | 'MONTO'
  valor_descuento: number
  activo: boolean
  orden: number
  created_at: string
}

export type SimuladorReglaRow = {
  clave: string
  valor_json: unknown
  descripcion: string | null
  updated_at: string
}

export type SimulacionPlanPagoEstado = 'borrador' | 'guardada' | 'anulada'

export type SimulacionPlanPagoRow = {
  id: string
  codcli: string
  rut: string | null
  nombre_alumno: string | null
  cod_carrera: string | null
  nombre_carrera: string | null
  anio_matricula: number | null
  periodo_matricula: number | null
  periodo_label: string | null
  estado: SimulacionPlanPagoEstado
  validez_propuesta: string | null
  arancel_un_semestre: boolean
  marca_cae: boolean
  monto_cae: number
  abono_resolucion: number
  abono_contado_arancel: number
  descuento_medio_pago_pct: number
  inputs_json: SimuladorInputsJson
  totales_json: SimuladorTotalesJson
  matricula_bruto: number | null
  arancel_bruto: number | null
  monto_neto_financiar: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SimulacionPlanPagoDetalleRow = {
  id: string
  simulacion_id: string
  concepto: SimuladorConcepto
  tipo_pago_codigo: string | null
  tipo_pago_nombre: string | null
  n_cuotas: number
  bruto: number
  beneficio_erp: number
  beca_estado: number
  convenio: number
  abono: number
  cae: number
  beneficio_adicional: number
  neto: number
  valor_cuota: number | null
}

export type SimuladorInputsJson = {
  tipo_pago_matricula_id: string | null
  tipo_pago_arancel_id: string | null
  n_cuotas_matricula: number
  n_cuotas_arancel: number
  convenio_id: string | null
  beca_estado_id: string | null
  beneficio_matricula_no_renovable_id: string | null
  beneficio_adicional_codigo: string | null
  beneficio_adicional_pct: number
}

export type SimuladorTotalesJson = {
  total_beca_estado: number
  total_beca_arancel_pct: number
  monto_financiar_becas: number
  monto_financiar_cae: number
  monto_arancel_financiar: number
  monto_arancel_mas_matricula: number
  monto_neto_financiar: number
}

export type SimuladorFormState = {
  validez_propuesta: string
  arancel_un_semestre: boolean
  marca_cae: boolean
  monto_cae: number
  abono_resolucion: number
  abono_contado_arancel: number
  descuento_medio_pago_pct: number
  tipo_pago_matricula_id: string | null
  tipo_pago_arancel_id: string | null
  n_cuotas_matricula: number
  n_cuotas_arancel: number
  convenio_id: string | null
  beca_estado_id: string | null
  beneficio_matricula_no_renovable_id: string | null
  beneficio_adicional_codigo: string | null
  beneficio_adicional_pct: number
}

export type SimuladorConceptoCalculo = {
  concepto: SimuladorConcepto
  bruto: number
  beneficio_erp: number
  beca_estado: number
  convenio: number
  abono: number
  cae: number
  beneficio_adicional: number
  neto: number
  n_cuotas: number
  valor_cuota: number | null
  tipo_pago_codigo: string | null
  tipo_pago_nombre: string | null
}

export type SimuladorResultado = {
  matricula: SimuladorConceptoCalculo
  arancel: SimuladorConceptoCalculo
  totales: SimuladorTotalesJson
  errores: string[]
}

export type SimuladorCatalogos = {
  tiposPago: SimuladorTipoPagoRow[]
  convenios: SimuladorConvenioRow[]
  becasEstado: SimuladorBecaEstadoRow[]
  reglas: Record<string, unknown>
}

export type { PlanPagosMvRow, PlanPagosMvBeneficioDetalle }
