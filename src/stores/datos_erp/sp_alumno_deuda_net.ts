import { acceptHMRUpdate, defineStore } from 'pinia'

import {
  fetchAlumnoDeudaNet,
  rutSinDv,
  type AlumnoDeudaNetData,
  type AlumnoDeudaNetParams,
} from '@/services/alumnoDeudaNetApi'

/**
 * Store on-demand del SP ERP:
 *   sp_alumno_deuda_net
 *
 * Params: @RUT (sin DV), @FECCAJA (servidor), @NoMostrar=0, @Opcion=124
 * Endpoint: POST /api/rematricula/alumno/deuda-net
 */
export const useSpAlumnoDeudaNetStore = defineStore('sp_alumno_deuda_net', {
  state: () => ({
    loading: false,
    error: null as string | null,
    data: null as AlumnoDeudaNetData | null,
    paramsUsados: null as AlumnoDeudaNetParams | null,
    fetchedAt: null as string | null,
    duracionMs: null as number | null,
  }),
  getters: {
    tieneDeuda: (s) => s.data?.tieneDeuda === true,
    deudaValor: (s) => s.data?.deuda ?? null,
  },
  actions: {
    reset() {
      this.loading = false
      this.error = null
      this.data = null
      this.paramsUsados = null
      this.fetchedAt = null
      this.duracionMs = null
    },

    /**
     * @param rutCompleto RUT con o sin DV / puntos; se normaliza a cuerpo sin DV.
     */
    async fetchFromErp(rutCompleto: string): Promise<boolean> {
      this.loading = true
      this.error = null
      const rut = rutSinDv(rutCompleto)
      const params: AlumnoDeudaNetParams = { rut, opcion: 124, noMostrar: 0 }
      this.paramsUsados = { ...params }

      try {
        if (!rut) {
          this.data = null
          this.error = 'RUT inválido para consultar deuda'
          return false
        }

        const res = await fetchAlumnoDeudaNet(params)
        this.duracionMs = res.duracionMs ?? null
        if (res.params) this.paramsUsados = { ...res.params }

        console.log('[sp_alumno_deuda_net] respuesta', {
          ok: res.ok,
          data: res.data,
          params: res.params ?? params,
          error: res.error,
          duracionMs: res.duracionMs,
        })

        if (!res.ok || !res.data) {
          this.data = null
          this.fetchedAt = null
          this.error = res.error ?? res.message ?? 'No se pudo consultar deuda'
          return false
        }

        this.data = res.data
        this.fetchedAt = new Date().toISOString()
        return true
      } finally {
        this.loading = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSpAlumnoDeudaNetStore, import.meta.hot))
}
