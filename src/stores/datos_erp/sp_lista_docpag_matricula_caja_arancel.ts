import { acceptHMRUpdate, defineStore } from 'pinia'

import {
  fetchDocpagListaCaja,
  type DocpagListaCajaItem,
  type DocpagListaCajaParams,
} from '@/services/docpagListaCajaApi'

/**
 * Store on-demand del SP ERP (rama arancel):
 *   sp_lista_docpag_matricula_caja @DESPLIEGA='A'
 *
 * Lista documentos configurados para pagar el arancel.
 * Endpoint: POST /api/rematricula/docpag/lista-caja
 */
export const useSpListaDocpagMatriculaCajaArancelStore = defineStore(
  'sp_lista_docpag_matricula_caja_arancel',
  {
    state: () => ({
      loading: false,
      error: null as string | null,
      docs: [] as DocpagListaCajaItem[],
      paramsUsados: null as DocpagListaCajaParams | null,
      fetchedAt: null as string | null,
      duracionMs: null as number | null,
      loaded: false,
    }),
    getters: {
      cantidad: (s) => s.docs.length,
      tieneData: (s) => s.docs.length > 0,
    },
    actions: {
      reset() {
        this.loading = false
        this.error = null
        this.docs = []
        this.paramsUsados = null
        this.fetchedAt = null
        this.duracionMs = null
        this.loaded = false
      },

      async ensureLoaded(force = false) {
        if (this.loaded && !force && !this.error) return
        await this.fetchFromErp()
      },

      async fetchFromErp(): Promise<boolean> {
        this.loading = true
        this.error = null
        const params: DocpagListaCajaParams = {
          despliega: 'A',
          requiereBen: 'N',
          idPerfil: 1,
        }
        this.paramsUsados = { ...params }

        try {
          const res = await fetchDocpagListaCaja(params)
          this.duracionMs = res.duracionMs ?? null
          if (res.params) this.paramsUsados = { ...res.params }

          if (!res.ok) {
            this.docs = []
            this.fetchedAt = null
            this.error = res.error ?? res.message ?? 'Error listando docs arancel'
            this.loaded = false
            return false
          }

          this.docs = res.data ?? []
          this.fetchedAt = new Date().toISOString()
          this.loaded = true
          return true
        } finally {
          this.loading = false
        }
      },
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useSpListaDocpagMatriculaCajaArancelStore, import.meta.hot),
  )
}
