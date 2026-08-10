import { acceptHMRUpdate, defineStore } from 'pinia'

import { fetchPeriodoActivoVigente } from '@/services/periodoActivo'
import { syncEstadoCaeAlumnosFromErp } from '@/services/estadoCaeAlumnosSyncApi'
import { fetchMnpEstadoCaeAlumnos, fmtFecha } from '@/services/fetchMnpEstadoCaeAlumnos'
import type { MnpEstadoCaeAlumnoRow } from '@/types/supabase'

export type EstadoCaeAlumnosErpFiltros = {
  codcli: string
  codBeneficio: string
  descripcion: string
  nombreEstado: string
}

const FILTROS_VACIOS: EstadoCaeAlumnosErpFiltros = {
  codcli: '',
  codBeneficio: '',
  descripcion: '',
  nombreEstado: '',
}

export const useEstadoCaeAlumnosErpStore = defineStore('estadoCaeAlumnosErp', {
  state: () => ({
    rows: [] as MnpEstadoCaeAlumnoRow[],
    loading: false,
    syncing: false,
    error: null as string | null,
    loaded: false,
    periodoLabel: null as string | null,
    anioPeriodo: null as number | null,
    semestrePeriodo: null as number | null,
    filtros: { ...FILTROS_VACIOS } as EstadoCaeAlumnosErpFiltros,
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

    rowsFiltradas(): MnpEstadoCaeAlumnoRow[] {
      const qCodcli = this.filtros.codcli.trim()
      const qCodBen = this.filtros.codBeneficio.trim()
      const qDesc = this.filtros.descripcion.trim().toUpperCase()
      const qEstado = this.filtros.nombreEstado.trim().toUpperCase()

      return this.rows.filter((r) => {
        if (qCodcli && !(r.codcli ?? '').includes(qCodcli)) return false
        if (qCodBen && String(r.cod_beneficio ?? r.cod_beneficio_cargado ?? '') !== qCodBen)
          return false
        if (qDesc && !(r.descripcion ?? '').toUpperCase().includes(qDesc)) return false
        if (qEstado && !(r.nombre_estado_beneficio ?? '').toUpperCase().includes(qEstado))
          return false
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
      this.periodoLabel = null
      this.anioPeriodo = null
      this.semestrePeriodo = null
      this.filtros = { ...FILTROS_VACIOS }
    },

    async ensureLoaded(force = false) {
      if (this.loaded && !force) return
      await this.fetchAll()
    },

    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        const { data: periodo, error: periodoError } = await fetchPeriodoActivoVigente()
        if (periodoError) {
          this.error = periodoError
          this.rows = []
          return
        }
        if (!periodo) {
          this.error = 'No hay periodo activo configurado.'
          this.rows = []
          return
        }

        this.anioPeriodo = periodo.anio_periodo
        this.semestrePeriodo = periodo.semestre_periodo
        this.periodoLabel = `${periodo.anio_periodo}-${periodo.semestre_periodo}`

        const { data, error } = await fetchMnpEstadoCaeAlumnos({
          anio: periodo.anio_periodo,
          semestre: periodo.semestre_periodo,
        })
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

    async syncFromErp(): Promise<{
      ok: boolean
      filasCargadas?: number
      periodo?: string | null
      error?: string
    }> {
      this.syncing = true
      this.error = null
      try {
        const result = await syncEstadoCaeAlumnosFromErp()
        if (!result.ok) {
          this.error = result.error ?? 'No se pudo actualizar desde ERP'
          return { ok: false, error: this.error }
        }
        await this.fetchAll()
        return {
          ok: true,
          filasCargadas: result.filasCargadas,
          periodo: result.periodo ?? this.periodoLabel,
        }
      } finally {
        this.syncing = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useEstadoCaeAlumnosErpStore, import.meta.hot))
}
