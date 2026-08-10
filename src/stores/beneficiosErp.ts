import { acceptHMRUpdate, defineStore } from 'pinia'

import { syncBeneficiosFromErp } from '@/services/beneficiosSyncApi'
import { fetchMtBeneficio, fmtFecha } from '@/services/fetchMtBeneficio'
import type { MtBeneficioRow } from '@/types/supabase'

export type BeneficiosErpFiltros = {
  codBeneficio: string
  descripcion: string
  tipo: string
  origen: string
}

const FILTROS_VACIOS: BeneficiosErpFiltros = {
  codBeneficio: '',
  descripcion: '',
  tipo: '',
  origen: '',
}

export const useBeneficiosErpStore = defineStore('beneficiosErp', {
  state: () => ({
    rows: [] as MtBeneficioRow[],
    loading: false,
    syncing: false,
    error: null as string | null,
    loaded: false,
    filtros: { ...FILTROS_VACIOS } as BeneficiosErpFiltros,
  }),

  getters: {
    total(): number {
      return this.rows.length
    },

    ultimaSync(): string | null {
      const ts = this.rows.reduce<string | null>((max, r) => {
        if (!r.synced_at) return max
        if (!max || r.synced_at > max) return r.synced_at
        return max
      }, null)
      if (!ts) return null
      return fmtFecha(ts)
    },

    rowsFiltradas(): MtBeneficioRow[] {
      const qCod = this.filtros.codBeneficio.trim()
      const qDesc = this.filtros.descripcion.trim().toUpperCase()
      const qTipo = this.filtros.tipo.trim().toUpperCase()
      const qOrigen = this.filtros.origen.trim().toUpperCase()

      return this.rows.filter((r) => {
        if (qCod && String(r.cod_beneficio ?? '') !== qCod) return false
        if (qDesc && !(r.descripcion ?? '').toUpperCase().includes(qDesc)) return false
        if (qTipo && !(r.tipo ?? '').toUpperCase().includes(qTipo)) return false
        if (qOrigen && !(r.origen_beneficio ?? '').toUpperCase().includes(qOrigen)) return false
        return true
      })
    },

    totalFiltrado(): number {
      return this.rowsFiltradas.length
    },
  },

  actions: {
    reset() {
      this.rows = []
      this.loading = false
      this.syncing = false
      this.error = null
      this.loaded = false
      this.filtros = { ...FILTROS_VACIOS }
    },

    resetFiltros() {
      this.filtros = { ...FILTROS_VACIOS }
    },

    setFiltro<K extends keyof BeneficiosErpFiltros>(key: K, value: BeneficiosErpFiltros[K]) {
      this.filtros[key] = value
    },

    async ensureLoaded(force = false) {
      if (this.loaded && !force) return
      await this.fetchAll()
    },

    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchMtBeneficio()
        if (error) {
          this.error = error
          this.rows = []
        } else {
          this.rows = data
        }
        this.loaded = true
      } finally {
        this.loading = false
      }
    },

    async syncFromErp(): Promise<{ ok: boolean; filasCargadas?: number; error?: string }> {
      this.syncing = true
      this.error = null
      try {
        const result = await syncBeneficiosFromErp()
        if (!result.ok) {
          this.error = result.error ?? 'No se pudo actualizar desde ERP'
          return { ok: false, error: this.error }
        }
        await this.fetchAll()
        return { ok: true, filasCargadas: result.filasCargadas }
      } finally {
        this.syncing = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBeneficiosErpStore, import.meta.hot))
}
