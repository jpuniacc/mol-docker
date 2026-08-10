import { supabase } from '@/services/supabaseClient'
import { mapConvenioToSimulador } from '@/stores/convenio'
import { mapTipoPagoToSimulador } from '@/stores/tipoPago'
import type { PlanPagosMvRow } from '@/types/supabase'
import type { TpConvenioRow, TpTipoPagoRow } from '@/types/supabase'
import type {
  SimulacionPlanPagoDetalleRow,
  SimulacionPlanPagoRow,
  SimuladorBecaEstadoRow,
  SimuladorCatalogos,
  SimuladorConvenioRow,
  SimuladorFormState,
  SimuladorResultado,
} from '@/types/simuladorPlanPago'
import {
  buildDefaultForm,
  calcularSimulacion,
  reglaNumero,
} from '@/utils/simuladorPlanPago'

function parseReglas(
  rows: { clave: string; valor_json: unknown }[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const r of rows) {
    let v = r.valor_json
    if (typeof v === 'string') {
      try {
        v = JSON.parse(v)
      } catch {
        /* keep string */
      }
    }
    out[r.clave] = v
  }
  return out
}

async function fetchConveniosCatalogo(): Promise<{
  data: SimuladorConvenioRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('tp_convenio')
    .select(
      'id, codigo_convenio, descripcion_convenio, concepto, tipo_descuento, valor_descuento, activo, created_at',
    )
    .eq('activo', true)
    .order('codigo_convenio', { ascending: true })

  if (!error && (data?.length ?? 0) > 0) {
    return { data: mapConvenioToSimulador((data ?? []) as TpConvenioRow[]), error: null }
  }

  const legacy = await supabase
    .from('mnp_simulador_convenio')
    .select('*')
    .eq('activo', true)
    .order('orden')

  if (legacy.error) {
    return { data: [], error: legacy.error.message }
  }

  return {
    data: (legacy.data ?? []) as SimuladorConvenioRow[],
    error: null,
  }
}

export async function fetchSimuladorCatalogos(): Promise<{
  data: SimuladorCatalogos | null
  error: string | null
}> {
  const [tp, conveniosRes, beca, reg] = await Promise.all([
    supabase
      .from('tp_tipo_pago')
      .select('id, codigo_tipo_pago, descripcion_tipo_pago, created_at')
      .order('codigo_tipo_pago'),
    fetchConveniosCatalogo(),
    supabase
      .from('mnp_simulador_beca_estado')
      .select('*')
      .eq('activo', true)
      .order('orden'),
    supabase.from('mnp_simulador_regla').select('clave, valor_json'),
  ])

  const err =
    tp.error?.message ??
    conveniosRes.error ??
    beca.error?.message ??
    reg.error?.message ??
    null
  if (err) return { data: null, error: err }

  return {
    data: {
      tiposPago: mapTipoPagoToSimulador((tp.data ?? []) as TpTipoPagoRow[]),
      convenios: conveniosRes.data,
      becasEstado: (beca.data ?? []) as SimuladorBecaEstadoRow[],
      reglas: parseReglas(
        (reg.data ?? []) as { clave: string; valor_json: unknown }[],
      ),
    },
    error: null,
  }
}

export async function fetchSimulacionesPorCodcli(codcli: string): Promise<{
  data: SimulacionPlanPagoRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('mnp_simulacion_plan_pago')
    .select('*')
    .eq('codcli', codcli)
    .neq('estado', 'anulada')
    .order('created_at', { ascending: false })
    .limit(20)

  return {
    data: (data ?? []) as SimulacionPlanPagoRow[],
    error: error?.message ?? null,
  }
}

export async function fetchSimulacionDetalle(simulacionId: string): Promise<{
  data: SimulacionPlanPagoDetalleRow[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('mnp_simulacion_plan_pago_detalle')
    .select('*')
    .eq('simulacion_id', simulacionId)

  return {
    data: (data ?? []) as SimulacionPlanPagoDetalleRow[],
    error: error?.message ?? null,
  }
}

export function crearFormDesdeRow(
  row: PlanPagosMvRow,
  catalogos: SimuladorCatalogos,
): SimuladorFormState {
  const dias = reglaNumero(catalogos.reglas, 'dias_validez_propuesta', 30)
  return buildDefaultForm(row, {
    diasValidez: dias,
    tiposPago: catalogos.tiposPago,
    convenios: catalogos.convenios,
    becas: catalogos.becasEstado,
  })
}

export function calcularDesdeForm(
  row: PlanPagosMvRow,
  form: SimuladorFormState,
  catalogos: SimuladorCatalogos,
): SimuladorResultado {
  return calcularSimulacion(row, form, {
    tiposPago: catalogos.tiposPago,
    convenios: catalogos.convenios,
    becasEstado: catalogos.becasEstado,
  })
}

export async function guardarSimulacion(params: {
  row: PlanPagosMvRow
  form: SimuladorFormState
  resultado: SimuladorResultado
  estado?: 'borrador' | 'guardada'
  createdBy?: string | null
}): Promise<{ id: string | null; error: string | null }> {
  const { row, form, resultado, estado = 'guardada', createdBy } = params
  const nombre =
    [row.nombre_alumno, row.apellido_paterno_alumno, row.apellido_materno_alumno]
      .filter(Boolean)
      .join(' ')
      .trim() || row.nombre_alumno

  const cabecera = {
    codcli: row.codcli ?? '',
    rut: row.rut,
    nombre_alumno: nombre,
    cod_carrera: row.cod_carrera,
    nombre_carrera: row.nombre_carrera ?? row.carrera,
    anio_matricula: row.anio_matricula,
    periodo_matricula: row.periodo_matricula,
    periodo_label: row.periodo,
    estado,
    validez_propuesta: form.validez_propuesta || null,
    arancel_un_semestre: form.arancel_un_semestre,
    marca_cae: form.marca_cae,
    monto_cae: form.monto_cae,
    abono_resolucion: form.abono_resolucion,
    abono_contado_arancel: form.abono_contado_arancel,
    descuento_medio_pago_pct: form.descuento_medio_pago_pct,
    inputs_json: {
      tipo_pago_matricula_id: form.tipo_pago_matricula_id,
      tipo_pago_arancel_id: form.tipo_pago_arancel_id,
      n_cuotas_matricula: form.n_cuotas_matricula,
      n_cuotas_arancel: form.n_cuotas_arancel,
      convenio_id: form.convenio_id,
      beca_estado_id: form.beca_estado_id,
      beneficio_matricula_no_renovable_id:
        form.beneficio_matricula_no_renovable_id,
      beneficio_adicional_codigo: form.beneficio_adicional_codigo,
      beneficio_adicional_pct: form.beneficio_adicional_pct,
    },
    totales_json: resultado.totales,
    matricula_bruto: resultado.matricula.bruto,
    arancel_bruto: resultado.arancel.bruto,
    monto_neto_financiar: resultado.totales.monto_neto_financiar,
    created_by: createdBy ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data: ins, error: errIns } = await supabase
    .from('mnp_simulacion_plan_pago')
    .insert(cabecera)
    .select('id')
    .single()

  if (errIns || !ins?.id) {
    return { id: null, error: errIns?.message ?? 'No se pudo guardar' }
  }

  const simId = ins.id as string
  const detalles = [resultado.matricula, resultado.arancel].map((c) => ({
    simulacion_id: simId,
    concepto: c.concepto,
    tipo_pago_codigo: c.tipo_pago_codigo,
    tipo_pago_nombre: c.tipo_pago_nombre,
    n_cuotas: c.n_cuotas,
    bruto: c.bruto,
    beneficio_erp: c.beneficio_erp,
    beca_estado: c.beca_estado,
    convenio: c.convenio,
    abono: c.abono,
    cae: c.cae,
    beneficio_adicional: c.beneficio_adicional,
    neto: c.neto,
    valor_cuota: c.valor_cuota,
  }))

  const { error: errDet } = await supabase
    .from('mnp_simulacion_plan_pago_detalle')
    .insert(detalles)

  if (errDet) {
    await supabase.from('mnp_simulacion_plan_pago').delete().eq('id', simId)
    return { id: null, error: errDet.message }
  }

  return { id: simId, error: null }
}
