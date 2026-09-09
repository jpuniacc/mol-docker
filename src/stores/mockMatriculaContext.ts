import { defineStore } from 'pinia'

import { usePa08MtArancelSelMatriculaNetStore } from '@/stores/datos_erp/pa08_MT_ARANCEL_sel_MATRICULA_NET'
import { useSpAlumnoDeudaNetStore } from '@/stores/datos_erp/sp_alumno_deuda_net'
import { useSpListaDocpagMatriculaCajaArancelStore } from '@/stores/datos_erp/sp_lista_docpag_matricula_caja_arancel'
import { useSpListaDocpagMatriculaCajaMatriculaStore } from '@/stores/datos_erp/sp_lista_docpag_matricula_caja_matricula'
import type { PlanPagosMvRow } from '@/types/supabase'

export type MockDiscapacidadRespuesta = {
  contesta: boolean
  tipo: string | null
  afirmaciones: string[]
}

export type MockVerificacionCae = {
  resultado: 'continua' | 'pendiente_resolucion'
}

export type MockConvenioDocumento = {
  storagePath: string
  nombreArchivo: string
}

export type MockPagoMatriculaMedio = 'pagare' | 'webpay' | 'toku'

export type MockCuotaPagareDetalle = {
  documento: 'PAGARÉ'
  correlativo: string
  vencimiento: string
  monto: number
  totalAcumulado: number
  items: 'MATRICULA'
  cuota: number
  totalCuotas: 10
  idDocumento: 5
}

export type MockPagoMatricula = {
  medio: MockPagoMatriculaMedio
  /** Solo camino pagaré: tipodoc ERP. */
  tipodoc?: '5'
  nombre: string
  cuotas?: 10
  diaVencimiento?: 5 | 15 | 25
  fechaInicio?: string
  monto: number
  valorCuota?: number
  /** true para toku/webpay (simulación). */
  simulado?: boolean
  cuotasDetalle?: MockCuotaPagareDetalle[]
}

const MOCK_CTX_STORAGE_KEY = 'rematricula-mock-matricula'

type StoredMockMatriculaContext = {
  selectedPlanPagos: PlanPagosMvRow
  tycAccepted: boolean
  discapacidad: MockDiscapacidadRespuesta | null
  verificacionCae: MockVerificacionCae | null
  formaPagoSeleccionada: 'webpay' | 'pagare' | 'toku' | null
  firmaCompletada: boolean
  conveniosDocumentos: Record<string, MockConvenioDocumento>
  pagoMatricula: MockPagoMatricula | null
  apoderadoConfirmado: boolean | null
  apoderadoBloqueo: boolean
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

function isDiaVencimiento(v: unknown): v is 5 | 15 | 25 {
  return v === 5 || v === 15 || v === 25
}

function sanitizePagoMatricula(v: unknown): MockPagoMatricula | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Partial<MockPagoMatricula>
  if (!isFormaPago(o.medio)) return null
  if (typeof o.nombre !== 'string' || !o.nombre.trim()) return null
  const monto = Number(o.monto)
  if (!Number.isFinite(monto) || monto < 0) return null

  const base: MockPagoMatricula = {
    medio: o.medio,
    nombre: o.nombre.trim(),
    monto,
    simulado: o.simulado === true,
  }

  if (o.medio === 'pagare') {
    if (o.tipodoc !== '5') return null
    if (o.cuotas !== 10) return null
    if (!isDiaVencimiento(o.diaVencimiento)) return null
    if (typeof o.fechaInicio !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.fechaInicio)) {
      return null
    }
    base.tipodoc = '5'
    base.cuotas = 10
    base.diaVencimiento = o.diaVencimiento
    base.fechaInicio = o.fechaInicio
    const vc = Number(o.valorCuota)
    base.valorCuota = Number.isFinite(vc) ? vc : Math.round(monto / 10)
    base.simulado = false
    if (Array.isArray(o.cuotasDetalle) && o.cuotasDetalle.length === 10) {
      base.cuotasDetalle = o.cuotasDetalle as MockCuotaPagareDetalle[]
    }
  }

  return base
}

export const useMockMatriculaContextStore = defineStore('mockMatriculaContext', {
  state: () => ({
    selectedPlanPagos: null as PlanPagosMvRow | null,
    tycAccepted: false,
    discapacidad: null as MockDiscapacidadRespuesta | null,
    verificacionCae: null as MockVerificacionCae | null,
    formaPagoSeleccionada: null as 'webpay' | 'pagare' | 'toku' | null,
    firmaCompletada: false,
    conveniosDocumentos: {} as Record<string, MockConvenioDocumento>,
    pagoMatricula: null as MockPagoMatricula | null,
    apoderadoConfirmado: null as boolean | null,
    apoderadoBloqueo: false,
  }),
  getters: {
    tieneAlumnoSeleccionado: (s) => s.selectedPlanPagos != null,
    nombreAlumnoDisplay: (s) => {
      const p = s.selectedPlanPagos
      if (!p) return null
      return [p.nombre_alumno, p.apellido_paterno_alumno, p.apellido_materno_alumno]
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .join(' ')
    },
  },
  actions: {
    persistToSessionStorage() {
      if (!this.selectedPlanPagos) {
        sessionStorage.removeItem(MOCK_CTX_STORAGE_KEY)
        return
      }
      const payload: StoredMockMatriculaContext = {
        selectedPlanPagos: this.selectedPlanPagos,
        tycAccepted: this.tycAccepted,
        discapacidad: this.discapacidad,
        verificacionCae: this.verificacionCae,
        formaPagoSeleccionada: this.formaPagoSeleccionada,
        firmaCompletada: this.firmaCompletada,
        conveniosDocumentos: this.conveniosDocumentos,
        pagoMatricula: this.pagoMatricula,
        apoderadoConfirmado: this.apoderadoConfirmado,
        apoderadoBloqueo: this.apoderadoBloqueo,
      }
      sessionStorage.setItem(MOCK_CTX_STORAGE_KEY, JSON.stringify(payload))
    },

    hydrateFromSessionStorage() {
      try {
        const raw = sessionStorage.getItem(MOCK_CTX_STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as Partial<StoredMockMatriculaContext>
        if (!parsed.selectedPlanPagos || typeof parsed.selectedPlanPagos !== 'object') {
          sessionStorage.removeItem(MOCK_CTX_STORAGE_KEY)
          return
        }
        this.selectedPlanPagos = parsed.selectedPlanPagos
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
        this.pagoMatricula = sanitizePagoMatricula(parsed.pagoMatricula)
        this.apoderadoConfirmado =
          parsed.apoderadoConfirmado === true || parsed.apoderadoConfirmado === false
            ? parsed.apoderadoConfirmado
            : null
        this.apoderadoBloqueo = parsed.apoderadoBloqueo === true
      } catch {
        sessionStorage.removeItem(MOCK_CTX_STORAGE_KEY)
      }
    },

    clearSessionStorage() {
      sessionStorage.removeItem(MOCK_CTX_STORAGE_KEY)
    },

    setAlumno(planRow: PlanPagosMvRow) {
      this.selectedPlanPagos = planRow
      this.tycAccepted = false
      this.discapacidad = null
      this.verificacionCae = null
      this.formaPagoSeleccionada = null
      this.firmaCompletada = false
      this.conveniosDocumentos = {}
      this.pagoMatricula = null
      this.apoderadoConfirmado = null
      this.apoderadoBloqueo = false
      usePa08MtArancelSelMatriculaNetStore().reset()
      useSpListaDocpagMatriculaCajaMatriculaStore().reset()
      useSpListaDocpagMatriculaCajaArancelStore().reset()
      useSpAlumnoDeudaNetStore().reset()
      this.persistToSessionStorage()
    },

    /** Actualiza la fila del plan sin resetear TyC / CAE / documentos del flujo. */
    patchSelectedPlanPagos(planRow: PlanPagosMvRow) {
      this.selectedPlanPagos = planRow
      this.persistToSessionStorage()
    },

    clearAlumno() {
      this.selectedPlanPagos = null
      this.tycAccepted = false
      this.discapacidad = null
      this.verificacionCae = null
      this.formaPagoSeleccionada = null
      this.firmaCompletada = false
      this.conveniosDocumentos = {}
      this.pagoMatricula = null
      this.apoderadoConfirmado = null
      this.apoderadoBloqueo = false
      usePa08MtArancelSelMatriculaNetStore().reset()
      useSpListaDocpagMatriculaCajaMatriculaStore().reset()
      useSpListaDocpagMatriculaCajaArancelStore().reset()
      useSpAlumnoDeudaNetStore().reset()
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
  },
})
