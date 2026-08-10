import { CONTACTO_OTP_CONFIG_CODIGO } from '@/constants/contactoOtpConfig'
import { supabase } from '@/services/supabaseClient'
import type { TpContactoOtpConfigRow } from '@/types/supabase'

const SELECT_COLS =
  'id, codigo, otp_email_segundos, otp_sms_segundos, otp_email_reintento_segundos, otp_sms_reintento_segundos, updated_at'

export async function fetchContactoOtpConfig(): Promise<{
  data: TpContactoOtpConfigRow | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('tp_contacto_otp_config')
    .select(SELECT_COLS)
    .eq('codigo', CONTACTO_OTP_CONFIG_CODIGO)
    .maybeSingle()

  return {
    data: (data as TpContactoOtpConfigRow | null) ?? null,
    error: error?.message ?? null,
  }
}

export async function updateContactoOtpConfig(payload: {
  otpEmailSegundos: number
  otpSmsSegundos: number
  otpEmailReintentoSegundos: number
  otpSmsReintentoSegundos: number
}): Promise<{ data: TpContactoOtpConfigRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tp_contacto_otp_config')
    .update({
      otp_email_segundos: payload.otpEmailSegundos,
      otp_sms_segundos: payload.otpSmsSegundos,
      otp_email_reintento_segundos: payload.otpEmailReintentoSegundos,
      otp_sms_reintento_segundos: payload.otpSmsReintentoSegundos,
    })
    .eq('codigo', CONTACTO_OTP_CONFIG_CODIGO)
    .select(SELECT_COLS)
    .maybeSingle()

  return {
    data: (data as TpContactoOtpConfigRow | null) ?? null,
    error: error?.message ?? null,
  }
}
