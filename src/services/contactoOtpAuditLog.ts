import { supabase } from '@/services/supabaseClient'
import { enmascararTelefonoChile } from '@/utils/telefonoChile'

export type ContactoOtpCanalLog = 'correo' | 'telefono'

export type ContactoOtpEventoLog =
  | 'envio'
  | 'reenvio'
  | 'verificar_ok'
  | 'verificar_fallido'
  | 'continuar_sin_otp'

export type RegistrarLogContactoOtpPayload = {
  canal: ContactoOtpCanalLog
  evento: ContactoOtpEventoLog
  numeroEnvio?: number
  contactoValor: string
  rutAlumno: string | null
  codcli: string | null
  nombreAlumno: string | null
  anioPeriodo: number | null
  semestrePeriodo: number | null
  esMock: boolean
  sesionId?: string | null
  urlOrigen?: string | null
  periodoLabel?: string | null
}

function enmascararEmail(email: string): string {
  const t = email.trim()
  const at = t.indexOf('@')
  if (at <= 0) return '***'
  const local = t.slice(0, at)
  const domain = t.slice(at + 1)
  const localMask = local.length <= 1 ? '*' : `${local[0]}***`
  return `${localMask}@${domain}`
}

export function enmascararContactoOtp(canal: ContactoOtpCanalLog, valor: string): string {
  if (canal === 'correo') return enmascararEmail(valor)
  return enmascararTelefonoChile(valor)
}

export async function registrarLogContactoOtp(
  payload: RegistrarLogContactoOtpPayload,
): Promise<string | null> {
  const { error } = await supabase.rpc('registrar_log_mol_contacto_otp', {
    p_canal: payload.canal,
    p_evento: payload.evento,
    p_numero_envio: payload.numeroEnvio ?? null,
    p_contacto_mascara: enmascararContactoOtp(payload.canal, payload.contactoValor),
    p_rut_alumno: payload.rutAlumno,
    p_codcli: payload.codcli,
    p_nombre_alumno: payload.nombreAlumno,
    p_anio_periodo: payload.anioPeriodo,
    p_semestre_periodo: payload.semestrePeriodo,
    p_periodo_label: payload.periodoLabel ?? null,
    p_url_origen: payload.urlOrigen ?? (typeof window !== 'undefined' ? window.location.href : null),
    p_es_mock: payload.esMock,
    p_sesion_id: payload.sesionId ?? null,
  })

  if (error) return error.message
  return null
}
