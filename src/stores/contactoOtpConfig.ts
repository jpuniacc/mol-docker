import { acceptHMRUpdate, defineStore } from 'pinia'

import {
  CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_DEFAULT,
  CONTACTO_OTP_EMAIL_SEGUNDOS_DEFAULT,
  CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_DEFAULT,
  CONTACTO_OTP_SMS_SEGUNDOS_DEFAULT,
} from '@/constants/contactoOtpConfig'
import { fetchContactoOtpConfig, updateContactoOtpConfig } from '@/services/contactoOtpConfig'
import type { TpContactoOtpConfigRow } from '@/types/supabase'
import { logMockContactoOtp } from '@/utils/mockContactoOtpDebug'

export const useContactoOtpConfigStore = defineStore('contactoOtpConfig', {
  state: () => ({
    loading: false,
    saving: false,
    error: null as string | null,
    config: null as TpContactoOtpConfigRow | null,
    loaded: false,
  }),

  getters: {
    emailSegundos: (s) => s.config?.otp_email_segundos ?? CONTACTO_OTP_EMAIL_SEGUNDOS_DEFAULT,
    smsSegundos: (s) => s.config?.otp_sms_segundos ?? CONTACTO_OTP_SMS_SEGUNDOS_DEFAULT,
    emailReintentoSegundos: (s) =>
      s.config?.otp_email_reintento_segundos ?? CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_DEFAULT,
    smsReintentoSegundos: (s) =>
      s.config?.otp_sms_reintento_segundos ?? CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_DEFAULT,
  },

  actions: {
    reset() {
      this.loading = false
      this.saving = false
      this.error = null
      this.config = null
      this.loaded = false
    },

    async ensureLoaded(force = false) {
      logMockContactoOtp('config.ensureLoaded', { force, loaded: this.loaded })
      if (this.loaded && !force) return
      await this.fetch()
    },

    async fetch() {
      logMockContactoOtp('config.fetch.inicio')
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchContactoOtpConfig()
        if (error) {
          this.error = error
          this.config = null
          logMockContactoOtp('config.fetch.error', error)
        } else {
          this.config = data
          logMockContactoOtp('config.fetch.ok', {
            raw: data,
            emailSegundos: data?.otp_email_segundos,
            smsSegundos: data?.otp_sms_segundos,
            emailReintentoSegundos: data?.otp_email_reintento_segundos,
            smsReintentoSegundos: data?.otp_sms_reintento_segundos,
          })
        }
        this.loaded = true
      } finally {
        this.loading = false
      }
    },

    async save(payload: {
      otpEmailSegundos: number
      otpSmsSegundos: number
      otpEmailReintentoSegundos: number
      otpSmsReintentoSegundos: number
    }) {
      this.saving = true
      this.error = null
      try {
        const { data, error } = await updateContactoOtpConfig(payload)
        if (error) {
          this.error = error
          return false
        }
        this.config = data
        return true
      } finally {
        this.saving = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useContactoOtpConfigStore, import.meta.hot))
}
