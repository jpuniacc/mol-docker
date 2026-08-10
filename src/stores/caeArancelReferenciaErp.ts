import { acceptHMRUpdate, defineStore } from 'pinia'

import { syncCaeArancelReferenciaFromErp } from '@/services/caeArancelReferenciaSyncApi'
import {
  fetchTpMnpCaeArancelReferencia,
  fmtFecha,
} from '@/services/fetchTpMnpCaeArancelReferencia'
import type { TpMnpCaeArancelReferenciaRow } from '@/types/supabase'

export type CaeArancelReferenciaErpFiltros = {
  codCarrera: string
  ano: string
  periodo: string
  soloConArancel: boolean
}

const FILTROS_VACIOS: CaeArancelReferenciaErpFiltros = {
  codCarrera: '',
  ano: '',
  periodo: '',
  soloConArancel: false,
}

export const useCaeArancelReferenciaErpStore = defineStore('caeArancelReferenciaErp', {
  state: () => ({
    rows: [] as TpMnpCaeArancelReferenciaRow[],
    loading: false,
    syncing: false,
    error: null as string | null,
    loaded: false,
    filtros: { ...FILTROS_VACIOS } as CaeArancelReferenciaErpFiltros,
    detalleExpandido: false,
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

    rowsFiltradas(): TpMnpCaeArancelReferenciaRow[] {
      const qCodCarrera = this.filtros.codCarrera.trim().toUpperCase()
      const qAno = this.filtros.ano.trim()
      const qPeriodo = this.filtros.periodo.trim()

      return this.rows.filter((r) => {
        if (qCodCarrera && !(r.cod_carrera ?? '').toUpperCase().includes(qCodCarrera)) return false
        if (qAno && String(r.ano ?? '') !== qAno) return false
        if (qPeriodo && String(r.periodo ?? '') !== qPeriodo) return false
        if (this.filtros.soloConArancel && !(Number(r.arancel_referencia) > 0)) return false
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
      this.detalleExpandido = false
    },

    resetFiltros() {
      this.filtros = { ...FILTROS_VACIOS }
    },

    setFiltro<K extends keyof CaeArancelReferenciaErpFiltros>(
      key: K,
      value: CaeArancelReferenciaErpFiltros[K],
    ) {
      this.filtros[key] = value
    },

    toggleDetalleExpandido() {
      this.detalleExpandido = !this.detalleExpandido
    },

    async ensureLoaded(force = false) {
      if (this.loaded && !force) return
      await this.fetchAll()
    },

    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchTpMnpCaeArancelReferencia()
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
        const result = await syncCaeArancelReferenciaFromErp()
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
  import.meta.hot.accept(acceptHMRUpdate(useCaeArancelReferenciaErpStore, import.meta.hot))
}
