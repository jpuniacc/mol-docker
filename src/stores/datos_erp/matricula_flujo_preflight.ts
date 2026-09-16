import { acceptHMRUpdate, defineStore } from 'pinia'

import {
  fetchMatriculaFlujoPreflight,
  rutSinDv,
  type MatriculaFlujoPreflightParams,
  type MatriculaFlujoPreflightSteps,
} from '@/services/matriculaFlujoPreflightApi'

/**
 * Preflight de matrícula (SELECT + deuda SP).
 * Endpoint: POST /api/rematricula/alumno/flujo-preflight
 *
 * Defaults planilla: TIPOMAT=12, CAJA=10, CODGRUPO=10.
 * Correlativos: peek actual + preview (Valor+1), sin consumir en UMAS.
 */
export const useMatriculaFlujoPreflightStore = defineStore('matricula_flujo_preflight', {
  state: () => ({
    loading: false,
    error: null as string | null,
    steps: null as MatriculaFlujoPreflightSteps | null,
    paramsUsados: null as MatriculaFlujoPreflightParams | null,
    fetchedAt: null as string | null,
    duracionMs: null as number | null,
    /** true solo si deuda/tipomat/caja/params OK */
    ok: false,
  }),
  getters: {
    tipomatOk: (s) => s.steps?.tipomat.ok === true,
    cajaOk: (s) => s.steps?.caja.ok === true,
    cajaAbierta: (s) => s.steps?.caja.abierta === true,
    parametrosOk: (s) => s.steps?.parametros.ok === true,
    tieneDeuda: (s) => s.steps?.deuda.tieneDeuda === true,
    correlativoPreview: (s) => s.steps?.correlativos.CORRELATIVO.preview ?? null,
    corrpagnumPreview: (s) => s.steps?.correlativos.CORRPAGNUM.preview ?? null,
    secuenciaPreview: (s) => s.steps?.correlativos.SECUENCIA.preview ?? null,
    contratoPreview: (s) => s.steps?.contrato.preview ?? null,
    peeksPagareOk: (s) =>
      Boolean(
        s.steps?.correlativos.CORRELATIVO.preview &&
          s.steps?.correlativos.CORRPAGNUM.preview &&
          s.steps?.correlativos.SECUENCIA.preview &&
          s.steps?.contrato.preview,
      ),
  },
  actions: {
    reset() {
      this.loading = false
      this.error = null
      this.steps = null
      this.paramsUsados = null
      this.fetchedAt = null
      this.duracionMs = null
      this.ok = false
    },

    async fetchFromErp(input: {
      rutCompleto: string
      codCarr: string
      tipomat?: number
      caja?: number
      codgrupo?: number
    }): Promise<boolean> {
      this.loading = true
      this.error = null
      const rut = rutSinDv(input.rutCompleto)
      const params: MatriculaFlujoPreflightParams = {
        rut,
        codCarr: input.codCarr.trim(),
        tipomat: input.tipomat,
        caja: input.caja,
        codgrupo: input.codgrupo,
      }
      this.paramsUsados = { ...params }

      try {
        if (!rut) {
          this.steps = null
          this.ok = false
          this.error = 'RUT inválido para preflight'
          return false
        }
        if (!params.codCarr) {
          this.steps = null
          this.ok = false
          this.error = 'codCarr requerido para preflight'
          return false
        }

        const res = await fetchMatriculaFlujoPreflight(params)
        this.duracionMs = res.duracionMs ?? null
        if (res.params) this.paramsUsados = { ...res.params }

        console.log('[matricula_flujo_preflight] respuesta', {
          ok: res.ok,
          steps: res.steps,
          params: res.params ?? params,
          error: res.error,
          duracionMs: res.duracionMs,
        })

        if (!res.steps) {
          this.steps = null
          this.ok = false
          this.fetchedAt = null
          this.error = res.error ?? res.message ?? 'No se pudo consultar preflight'
          return false
        }

        this.steps = res.steps
        this.ok = res.ok === true
        this.fetchedAt = new Date().toISOString()
        this.error = res.error ?? (res.ok ? null : res.message ?? null)
        return true
      } finally {
        this.loading = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatriculaFlujoPreflightStore, import.meta.hot))
}
