import { contextoMolAuditoria, type ContextoMolAuditoriaOpciones } from '@/services/molAuditContext'
import { supabase } from '@/services/supabaseClient'

export type RetencionAuditAccion =
  | 'modal_mostrado'
  | 'completar_ahora'
  | 'salir_igual'
  | 'recordatorio_enviado'
  | 'retomar'
  | 'persistencia_error'
  | 'persistencia_ok'

export type RegistrarRetencionAuditParams = ContextoMolAuditoriaOpciones & {
  accion: RetencionAuditAccion
  payload?: Record<string, unknown>
}

export async function registrarRetencionAudit(
  params: RegistrarRetencionAuditParams,
): Promise<string | null> {
  try {
    const { accion, payload, ...ctxOpciones } = params
    const ctx = contextoMolAuditoria(ctxOpciones)

    const { data, error } = await supabase.rpc('registrar_log_mol_evento', {
      p_sesion_id: ctx.sesionId,
      p_categoria: 'retencion',
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
      console.warn('[RetencionAudit]', error.message)
      return null
    }
    return typeof data === 'string' ? data : null
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[RetencionAudit]', message)
    return null
  }
}

export function emitirRetencionAudit(params: RegistrarRetencionAuditParams): void {
  void registrarRetencionAudit(params).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[RetencionAudit]', message)
  })
}
