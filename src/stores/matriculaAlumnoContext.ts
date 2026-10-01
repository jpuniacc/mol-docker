import { defineStore } from 'pinia'

import { useMatriculaFlujoPreflightStore } from '@/stores/datos_erp/matricula_flujo_preflight'
import { usePa08MtArancelSelMatriculaNetStore } from '@/stores/datos_erp/pa08_MT_ARANCEL_sel_MATRICULA_NET'
import { useSpAlumnoDeudaNetStore } from '@/stores/datos_erp/sp_alumno_deuda_net'
import { useSpListaDocpagMatriculaCajaArancelStore } from '@/stores/datos_erp/sp_lista_docpag_matricula_caja_arancel'
import { useSpListaDocpagMatriculaCajaMatriculaStore } from '@/stores/datos_erp/sp_lista_docpag_matricula_caja_matricula'
import type {
  MockConvenioDocumento,
  MockDiscapacidadRespuesta,
  MockPagoMatricula,
  MockVerificacionCae,
} from '@/stores/mockMatriculaContext'

const ALUMNO_CTX_STORAGE_KEY = 'rematricula-alumno-matricula'

type StoredAlumnoMatriculaContext = {
  tycAccepted: boolean
  discapacidad: MockDiscapacidadRespuesta | null
  verificacionCae: MockVerificacionCae | null
  formaPagoSeleccionada: 'webpay' | 'pagare' | 'toku' | null
  firmaCompletada: boolean
  conveniosDocumentos: Record<string, MockConvenioDocumento>
  pagoMatricula: MockPagoMatricula | null
  apoderadoConfirmado: boolean | null
  apoderadoBloqueo: boolean
  convenioCertificadoBloqueo: boolean
  estatalBloqueo: boolean
  promedioBloqueo: boolean
  contactoCorreoValidado: string | null
  contactoTelefonoValidado: string | null
}

function sanitizeConveniosDocumentos(v: unknown): Record<string, MockConvenioDocumento> {
  if (typeof v !== 'object' || v === null) return {}
  const out: Record<string, MockConvenioDocumento> = {}
  for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
    if (
      typeof val === 'object' &&
      val !== null &&
      typeof (val as MockConvenioDocumento).storagePath === 'string' &&
      typeof (val as MockConvenioDocumento).nombreArchivo === 'string'
    ) {
      out[key] = {
        storagePath: (val as MockConvenioDocumento).storagePath,
        nombreArchivo: (val as MockConvenioDocumento).nombreArchivo,
      }
    }
  }
  return out
}

function isVerificacionCae(v: unknown): v is MockVerificacionCae {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as MockVerificacionCae).resultado !== undefined &&
    ((v as MockVerificacionCae).resultado === 'continua' ||
      (v as MockVerificacionCae).resultado === 'pendiente_resolucion')
  )
}

function isFormaPago(v: unknown): v is 'webpay' | 'pagare' | 'toku' {
  return v === 'webpay' || v === 'pagare' || v === 'toku'
}

function hasAnyProgressPayload(parsed: Partial<StoredAlumnoMatriculaContext>): boolean {
  return (
    parsed.tycAccepted === true ||
    parsed.discapacidad != null ||
    parsed.verificacionCae != null ||
    parsed.formaPagoSeleccionada != null ||
    parsed.firmaCompletada === true ||
    (parsed.conveniosDocumentos != null &&
      typeof parsed.conveniosDocumentos === 'object' &&
      Object.keys(parsed.conveniosDocumentos).length > 0) ||
    parsed.pagoMatricula != null ||
    parsed.apoderadoConfirmado != null ||
    parsed.apoderadoBloqueo === true ||
    parsed.convenioCertificadoBloqueo === true ||
    parsed.estatalBloqueo === true ||
    parsed.promedioBloqueo === true ||
    (typeof parsed.contactoCorreoValidado === 'string' &&
      parsed.contactoCorreoValidado.trim().length > 0) ||
    (typeof parsed.contactoTelefonoValidado === 'string' &&
      parsed.contactoTelefonoValidado.trim().length > 0)
  )
}

function textoPersistido(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

export const useMatriculaAlumnoContextStore = defineStore('matriculaAlumnoContext', {
  state: () => ({
    tycAccepted: false,
    discapacidad: null as MockDiscapacidadRespuesta | null,
    verificacionCae: null as MockVerificacionCae | null,
    formaPagoSeleccionada: null as 'webpay' | 'pagare' | 'toku' | null,
    firmaCompletada: false,
    conveniosDocumentos: {} as Record<string, MockConvenioDocumento>,
    pagoMatricula: null as MockPagoMatricula | null,
    apoderadoConfirmado: null as boolean | null,
    apoderadoBloqueo: false,
    convenioCertificadoBloqueo: false,
    estatalBloqueo: false,
    promedioBloqueo: false,
    contactoCorreoValidado: null as string | null,
    contactoTelefonoValidado: null as string | null,
  }),
  actions: {
    persistToSessionStorage() {
      const payload: StoredAlumnoMatriculaContext = {
        tycAccepted: this.tycAccepted,
        discapacidad: this.discapacidad,
        verificacionCae: this.verificacionCae,
        formaPagoSeleccionada: this.formaPagoSeleccionada,
        firmaCompletada: this.firmaCompletada,
        conveniosDocumentos: this.conveniosDocumentos,
        pagoMatricula: this.pagoMatricula,
        apoderadoConfirmado: this.apoderadoConfirmado,
        apoderadoBloqueo: this.apoderadoBloqueo,
        convenioCertificadoBloqueo: this.convenioCertificadoBloqueo,
        estatalBloqueo: this.estatalBloqueo,
        promedioBloqueo: this.promedioBloqueo,
        contactoCorreoValidado: this.contactoCorreoValidado,
        contactoTelefonoValidado: this.contactoTelefonoValidado,
      }
      sessionStorage.setItem(ALUMNO_CTX_STORAGE_KEY, JSON.stringify(payload))
    },

    hydrateFromSessionStorage() {
      try {
        const raw = sessionStorage.getItem(ALUMNO_CTX_STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as Partial<StoredAlumnoMatriculaContext>
        if (!hasAnyProgressPayload(parsed)) {
          sessionStorage.removeItem(ALUMNO_CTX_STORAGE_KEY)
          return
        }
        this.tycAccepted = parsed.tycAccepted === true
        this.discapacidad =
          parsed.discapacidad && typeof parsed.discapacidad === 'object'
            ? parsed.discapacidad
            : null
        this.verificacionCae = isVerificacionCae(parsed.verificacionCae)
          ? parsed.verificacionCae
          : null
        this.formaPagoSeleccionada = isFormaPago(parsed.formaPagoSeleccionada)
          ? parsed.formaPagoSeleccionada
          : null
        this.firmaCompletada = parsed.firmaCompletada === true
        this.conveniosDocumentos = sanitizeConveniosDocumentos(parsed.conveniosDocumentos)
        this.pagoMatricula =
          parsed.pagoMatricula && typeof parsed.pagoMatricula === 'object'
            ? parsed.pagoMatricula
            : null
        this.apoderadoConfirmado =
          parsed.apoderadoConfirmado === true || parsed.apoderadoConfirmado === false
            ? parsed.apoderadoConfirmado
            : null
        this.apoderadoBloqueo = parsed.apoderadoBloqueo === true
        this.convenioCertificadoBloqueo = parsed.convenioCertificadoBloqueo === true
        this.estatalBloqueo = parsed.estatalBloqueo === true
        this.promedioBloqueo = parsed.promedioBloqueo === true
        this.contactoCorreoValidado = textoPersistido(parsed.contactoCorreoValidado)
        this.contactoTelefonoValidado = textoPersistido(parsed.contactoTelefonoValidado)
      } catch {
        sessionStorage.removeItem(ALUMNO_CTX_STORAGE_KEY)
      }
    },

    clearSessionStorage() {
      sessionStorage.removeItem(ALUMNO_CTX_STORAGE_KEY)
    },

    resetStoresErp() {
      usePa08MtArancelSelMatriculaNetStore().reset()
      useSpListaDocpagMatriculaCajaMatriculaStore().reset()
      useSpListaDocpagMatriculaCajaArancelStore().reset()
      useSpAlumnoDeudaNetStore().reset()
      useMatriculaFlujoPreflightStore().reset()
    },

    resetFlujo() {
      this.tycAccepted = false
      this.discapacidad = null
      this.verificacionCae = null
      this.formaPagoSeleccionada = null
      this.firmaCompletada = false
      this.conveniosDocumentos = {}
      this.pagoMatricula = null
      this.apoderadoConfirmado = null
      this.apoderadoBloqueo = false
      this.convenioCertificadoBloqueo = false
      this.estatalBloqueo = false
      this.promedioBloqueo = false
      this.contactoCorreoValidado = null
      this.contactoTelefonoValidado = null
      this.resetStoresErp()
      this.clearSessionStorage()
    },

    acceptTyc() {
      this.tycAccepted = true
      this.persistToSessionStorage()
    },

    rejectTyc() {
      this.tycAccepted = false
      this.persistToSessionStorage()
    },

    setDiscapacidad(resp: MockDiscapacidadRespuesta) {
      this.discapacidad = resp
      this.persistToSessionStorage()
    },

    setVerificacionCae(resp: MockVerificacionCae) {
      this.verificacionCae = resp
      this.persistToSessionStorage()
    },

    setFormaPago(medio: 'webpay' | 'pagare' | 'toku') {
      this.formaPagoSeleccionada = medio
      this.persistToSessionStorage()
    },

    setPagoMatricula(pago: MockPagoMatricula) {
      this.pagoMatricula = pago
      this.persistToSessionStorage()
    },

    clearPagoMatricula() {
      this.pagoMatricula = null
      this.persistToSessionStorage()
    },

    setFirmaCompletada(ok: boolean) {
      this.firmaCompletada = ok
      this.persistToSessionStorage()
    },

    setConvenioDocumento(convenioId: string, doc: MockConvenioDocumento) {
      this.conveniosDocumentos = {
        ...this.conveniosDocumentos,
        [convenioId]: doc,
      }
      this.persistToSessionStorage()
    },

    removeConvenioDocumento(convenioId: string) {
      if (!(convenioId in this.conveniosDocumentos)) return
      const { [convenioId]: _omitido, ...resto } = this.conveniosDocumentos
      void _omitido
      this.conveniosDocumentos = resto
      this.persistToSessionStorage()
    },

    confirmarApoderadoOk() {
      this.apoderadoConfirmado = true
      this.apoderadoBloqueo = false
      this.persistToSessionStorage()
    },

    marcarApoderadoDesactualizado() {
      this.apoderadoConfirmado = false
      this.apoderadoBloqueo = true
      this.persistToSessionStorage()
    },

    setConvenioCertificadoBloqueo(bloqueado: boolean) {
      this.convenioCertificadoBloqueo = bloqueado
      this.persistToSessionStorage()
    },

    setEstatalBloqueo(bloqueado: boolean) {
      this.estatalBloqueo = bloqueado
      this.persistToSessionStorage()
    },

    setPromedioBloqueo(bloqueado: boolean) {
      this.promedioBloqueo = bloqueado
      this.persistToSessionStorage()
    },

    marcarCorreoValidado(correo: string) {
      const t = correo.trim()
      this.contactoCorreoValidado = t.length > 0 ? t : null
      this.persistToSessionStorage()
    },

    limpiarCorreoValidado() {
      if (this.contactoCorreoValidado == null) return
      this.contactoCorreoValidado = null
      this.persistToSessionStorage()
    },

    marcarTelefonoValidado(digitos: string) {
      const d = digitos.replace(/\D/g, '')
      this.contactoTelefonoValidado = d.length > 0 ? d : null
      this.persistToSessionStorage()
    },

    limpiarTelefonoValidado() {
      if (this.contactoTelefonoValidado == null) return
      this.contactoTelefonoValidado = null
      this.persistToSessionStorage()
    },
  },
})
