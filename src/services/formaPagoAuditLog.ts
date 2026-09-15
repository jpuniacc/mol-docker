import { contextoMolAuditoria, type ContextoMolAuditoriaOpciones } from '@/services/molAuditContext'
import { supabase } from '@/services/supabaseClient'

export type FormaPagoAuditAccion = 'confirmado' | 'cancelado'

export type RegistrarFormaPagoAuditParams = ContextoMolAuditoriaOpciones & {
  accion: FormaPagoAuditAccion
  payload?: Record<string, unknown>
}

export async function registrarFormaPagoAudit(
  params: RegistrarFormaPagoAuditParams,
): Promise<string | null> {
  const { accion, payload, ...ctxOpciones } = params
  const ctx = contextoMolAuditoria(ctxOpciones)

  const { data, error } = await supabase.rpc('registrar_log_mol_evento', {
    p_sesion_id: ctx.sesionId,
    p_categoria: 'forma_pago',
    p_accion: accion,
    p_origen_tabla: null,
    p_origen_id: null,
    p_payload: payload ?? null,
    p_rut_alumno: ctx.rutAlumno,
    p_codcli: ctx.codcli,
    p_nombre_alumno: ctx.nombreAlumno,
    p_anio_periodo: ctx.anioPeriodo,
    p_semestre_periodo: ctx.semestrePeriodo,
    p_periodo_label: ctx.periodoLabel,
    p_url_origen: ctx.urlOrigen,
    p_es_mock: ctx.esMock,
  })

  if (error) {
    console.warn('[FormaPagoAudit]', error.message)
    return null
  }

  return typeof data === 'string' ? data : null
}
