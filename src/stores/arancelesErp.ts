import { acceptHMRUpdate, defineStore } from 'pinia'

import { syncArancelesFromErp } from '@/services/arancelesSyncApi'
import { fetchMtArancel, fmtFecha } from '@/services/fetchMtArancel'
import type { MtArancelRow } from '@/types/supabase'

export type ArancelesErpFiltros = {
  codCarrera: string
  ano: string
  periodo: string
  categoria: string
  jornada: string
}

const FILTROS_VACIOS: ArancelesErpFiltros = {
  codCarrera: '',
  ano: '',
  periodo: '',
  categoria: '',
  jornada: '',
}

export const useArancelesErpStore = defineStore('arancelesErp', {
  state: () => ({
    rows: [] as MtArancelRow[],
    loading: false,
    syncing: false,
    error: null as string | null,
    loaded: false,
    filtros: { ...FILTROS_VACIOS } as ArancelesErpFiltros,
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

    rowsFiltradas(): MtArancelRow[] {
      const qCodCarrera = this.filtros.codCarrera.trim().toUpperCase()
      const qAno = this.filtros.ano.trim()
      const qCat = this.filtros.categoria.trim()
      const qPeriodo = this.filtros.periodo.trim()
      const qJornada = this.filtros.jornada.trim().toUpperCase()

      return this.rows.filter((r) => {
        if (qCodCarrera && !(r.cod_carrera ?? '').toUpperCase().includes(qCodCarrera)) return false
        if (qAno && String(r.ano ?? '') !== qAno) return false
        if (qCat && String(r.categoria_alumno ?? '') !== qCat) return false
        if (qPeriodo && String(r.periodo ?? '') !== qPeriodo) return false
        if (qJornada && !(r.jornada ?? '').toUpperCase().includes(qJornada)) return false
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

    setFiltro<K extends keyof ArancelesErpFiltros>(key: K, value: ArancelesErpFiltros[K]) {
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
        const { data, error } = await fetchMtArancel()
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
        const result = await syncArancelesFromErp()
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
  import.meta.hot.accept(acceptHMRUpdate(useArancelesErpStore, import.meta.hot))
}
