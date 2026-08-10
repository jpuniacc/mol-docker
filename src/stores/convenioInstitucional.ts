import { acceptHMRUpdate, defineStore } from 'pinia'

import { periodoLabel } from '@/constants/convenioInstitucional'
import {
  fetchConveniosInstitucionales,
  importConveniosInstitucionales,
  softDeleteConvenioInstitucional,
  upsertConvenioInstitucional,
  type ConvenioInstitucionalCompleto,
  type ConvenioPeriodoInput,
  type ConvenioUpsertInput,
} from '@/services/convenioInstitucional'
import { parseConveniosExcel } from '@/services/parseConveniosExcel'

export const useConvenioInstitucionalStore = defineStore('convenioInstitucional', {
  state: () => ({
    rows: [] as ConvenioInstitucionalCompleto[],
    loading: false,
    saving: false,
    importing: false,
    error: null as string | null,
    loaded: false,
    filtroTexto: '',
    filtroEstado: '' as string,
    soloPeriodoActivo: false,
    filtroAnio: null as number | null,
    filtroSemestre: null as number | null,
  }),

  getters: {
    rowsFiltradas(state): ConvenioInstitucionalCompleto[] {
      const q = state.filtroTexto.trim().toLowerCase()
      return state.rows.filter((r) => {
        if (!r.activo && state.soloPeriodoActivo) return false
        if (state.filtroEstado && r.estado !== state.filtroEstado) return false
        if (
          state.soloPeriodoActivo &&
          state.filtroAnio != null &&
          state.filtroSemestre != null &&
          !r.periodos.some(
            (p) =>
              p.activo &&
              p.anio_periodo === state.filtroAnio &&
              p.semestre_periodo === state.filtroSemestre,
          )
        ) {
          return false
        }
        if (!q) return true
        const hay = [
          r.institucion,
          r.codigo_beneficio ?? '',
          r.beneficiarios ?? '',
          r.estado,
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    },

    total(): number {
      return this.rows.length
    },

    totalFiltrado(): number {
      return this.rowsFiltradas.length
    },
  },

  actions: {
    reset() {
      this.rows = []
      this.loading = false
      this.saving = false
      this.importing = false
      this.error = null
      this.loaded = false
      this.filtroTexto = ''
      this.filtroEstado = ''
      this.soloPeriodoActivo = false
      this.filtroAnio = null
      this.filtroSemestre = null
    },

    setPeriodoFiltro(anio: number | null, semestre: number | null) {
      this.filtroAnio = anio
      this.filtroSemestre = semestre
    },

    periodoChips(row: ConvenioInstitucionalCompleto): string[] {
      return row.periodos
        .filter((p) => p.activo)
        .map((p) => periodoLabel(p.anio_periodo, p.semestre_periodo))
        .sort()
    },

    ofertasActivasCount(row: ConvenioInstitucionalCompleto): number {
      return row.descuentos.filter((d) => d.aplica).length
    },

    async ensureLoaded(force = false) {
      if (this.loaded && !force) return
      await this.fetchAll()
    },

    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchConveniosInstitucionales()
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

    async upsert(input: ConvenioUpsertInput) {
      this.saving = true
      this.error = null
      try {
        const { error } = await upsertConvenioInstitucional(input)
        if (error) {
          this.error = error
          return { ok: false as const, error }
        }
        await this.fetchAll()
        return { ok: true as const }
      } finally {
        this.saving = false
      }
    },

    async softDelete(id: string) {
      this.saving = true
      try {
        const { error } = await softDeleteConvenioInstitucional(id)
        if (error) {
          this.error = error
          return { ok: false as const, error }
        }
        await this.fetchAll()
        return { ok: true as const }
      } finally {
        this.saving = false
      }
    },

    async importFromExcel(buffer: ArrayBuffer, periodos: ConvenioPeriodoInput[]) {
      this.importing = true
      this.error = null
      try {
        const parsed = parseConveniosExcel(buffer, periodos)
        if (parsed.errors.length && parsed.rows.length === 0) {
          this.error = parsed.errors.join('; ')
          return { ok: 0, errors: parsed.errors }
        }
        const result = await importConveniosInstitucionales(parsed.rows)
        await this.fetchAll()
        return {
          ok: result.ok,
          errors: [...parsed.errors, ...result.errors],
        }
      } finally {
        this.importing = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useConvenioInstitucionalStore, import.meta.hot))
}
