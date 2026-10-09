import { acceptHMRUpdate, defineStore } from 'pinia'

import { logMockContactoOtp } from '@/utils/mockContactoOtpDebug'

export type MockContactoModal = 'correo' | 'telefono' | null

export const useMockContactoOtpUiStore = defineStore('mockContactoOtpUi', {
  state: () => ({
    modalContacto: null as MockContactoModal,
    errorCorreo: null as string | null,
    errorTelefono: null as string | null,
    correoValidadoOk: false,
    telefonoValidadoOk: false,
    correoOtpPendiente: false,
    correoOtpCodigo: '',
    correoOtpExpiresAt: null as string | null,
    correoOtpIntentosFallidos: 0,
    correoOtpProximoReintentoAt: null as number | null, // timestamp hasta el cual no se puede reenviar
    correoOtpEnviando: false,
    correoOtpVerificando: false,
    correoOtpTick: 0,
    correoOtpEnviosRealizados: 0,
    telefonoOtpPendiente: false,
    telefonoOtpCodigo: '',
    telefonoOtpExpiresAt: null as string | null,
    telefonoOtpIntentosFallidos: 0,
    telefonoOtpProximoReintentoAt: null as number | null, // timestamp hasta el cual no se puede reenviar
    telefonoOtpEnviando: false,
    telefonoOtpVerificando: false,
    telefonoOtpTick: 0,
    telefonoOtpEnviosRealizados: 0,
    mostrarContinuarSinOtpCorreo: false,
    mostrarContinuarSinOtpTelefono: false,
  }),

  actions: {
    resetCorreoOtpEnvios() {
      logMockContactoOtp('store.resetCorreoOtpEnvios')
      this.correoOtpEnviosRealizados = 0
    },

    resetTelefonoOtpEnvios() {
      logMockContactoOtp('store.resetTelefonoOtpEnvios')
      this.telefonoOtpEnviosRealizados = 0
    },

    resetCorreoOtp() {
      logMockContactoOtp('store.resetCorreoOtp')
      this.correoOtpPendiente = false
      this.correoOtpCodigo = ''
      this.correoOtpExpiresAt = null
      this.correoOtpIntentosFallidos = 0
      this.correoOtpProximoReintentoAt = null
      this.correoOtpEnviando = false
      this.correoOtpVerificando = false
      this.correoOtpTick = 0
      this.mostrarContinuarSinOtpCorreo = false
    },

    resetTelefonoOtp() {
      logMockContactoOtp('store.resetTelefonoOtp')
      this.telefonoOtpPendiente = false
      this.telefonoOtpCodigo = ''
      this.telefonoOtpExpiresAt = null
      this.telefonoOtpIntentosFallidos = 0
      this.telefonoOtpProximoReintentoAt = null
      this.telefonoOtpEnviando = false
      this.telefonoOtpVerificando = false
      this.telefonoOtpTick = 0
      this.mostrarContinuarSinOtpTelefono = false
    },

    resetAll() {
      logMockContactoOtp('store.resetAll', {
        modalAntes: this.modalContacto,
        correoPendienteAntes: this.correoOtpPendiente,
        telefonoPendienteAntes: this.telefonoOtpPendiente,
      })
      this.modalContacto = null
      this.errorCorreo = null
      this.errorTelefono = null
      this.correoValidadoOk = false
      this.telefonoValidadoOk = false
      this.resetCorreoOtpEnvios()
      this.resetTelefonoOtpEnvios()
      this.resetCorreoOtp()
      this.resetTelefonoOtp()
    },

    abrirModalCorreo() {
      logMockContactoOtp('store.abrirModalCorreo', { pendiente: this.correoOtpPendiente })
      this.modalContacto = 'correo'
      this.errorCorreo = null
      if (!this.correoOtpPendiente) this.resetCorreoOtp()
    },

    abrirModalTelefono() {
      logMockContactoOtp('store.abrirModalTelefono', { pendiente: this.telefonoOtpPendiente })
      this.modalContacto = 'telefono'
      this.errorTelefono = null
      if (!this.telefonoOtpPendiente) this.resetTelefonoOtp()
    },

    cerrarModalCorreo() {
      logMockContactoOtp('store.cerrarModalCorreo', {
        modalActual: this.modalContacto,
        pendiente: this.correoOtpPendiente,
      })
      if (this.modalContacto !== 'correo') return
      this.modalContacto = null
      this.errorCorreo = null
      this.mostrarContinuarSinOtpCorreo = false
    },

    cerrarModalTelefono() {
      logMockContactoOtp('store.cerrarModalTelefono', {
        modalActual: this.modalContacto,
        pendiente: this.telefonoOtpPendiente,
      })
      if (this.modalContacto !== 'telefono') return
      this.modalContacto = null
      this.errorTelefono = null
      this.mostrarContinuarSinOtpTelefono = false
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMockContactoOtpUiStore, import.meta.hot))
}
