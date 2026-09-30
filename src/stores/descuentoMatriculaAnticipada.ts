import { acceptHMRUpdate, defineStore } from 'pinia'

import {
  DESCUENTO_MATRICULA_APLICABLE_FILTRO_TODOS,
  type DescuentoMatriculaAplicable,
} from '@/constants/descuentoMatriculaAnticipada'
import {
  deleteDescuentoMatriculaAnticipada,
  fetchDescuentosMatriculaAnticipada,
  insertDescuentoMatriculaAnticipada,
  type DescuentoMatriculaAnticipadaInput,
  updateDescuentoMatriculaAnticipada,
  validarPeriodo,
  validarVigencia,
} from '@/services/descuentoMatriculaAnticipada'
import type { TpMnpDescuentoMatriculaAnticipadaRow } from '@/types/supabase'

export type DescuentoMatriculaAnticipadaFiltros = {
  periodo: string
  aplicable_a: string
  texto: string
  soloActivos: boolean
}

const FILTROS_VACIOS: DescuentoMatriculaAnticipadaFiltros = {
  periodo: '',
  aplicable_a: DESCUENTO_MATRICULA_APLICABLE_FILTRO_TODOS,
  texto: '',
  soloActivos: false,
}

export const useDescuentoMatriculaAnticipadaStore = defineStore(
  'descuentoMatriculaAnticipada',
  {
    state: () => ({
      rows: [] as TpMnpDescuentoMatriculaAnticipadaRow[],
      loading: false,
      saving: false,
      error: null as string | null,
      loaded: false,
      filtros: { ...FILTROS_VACIOS } as DescuentoMatriculaAnticipadaFiltros,
    }),

    getters: {
      total(): number {
        return this.rows.length
      },

      rowsFiltradas(): TpMnpDescuentoMatriculaAnticipadaRow[] {
        const qPeriodo = this.filtros.periodo.trim()
        const qAplicable = this.filtros.aplicable_a.trim()
        const qTexto = this.filtros.texto.trim().toUpperCase()
        const filtrarAplicable =
          qAplicable && qAplicable !== DESCUENTO_MATRICULA_APLICABLE_FILTRO_TODOS

        return this.rows.filter((r) => {
          if (this.filtros.soloActivos && !r.activo) return false
          if (qPeriodo && r.periodo !== qPeriodo) return false
          if (filtrarAplicable && r.aplicable_a !== qAplicable) return false
          if (qTexto) {
            const hay =
              (r.nombre ?? '').toUpperCase().includes(qTexto) ||
              String(r.cod_beneficio ?? '').includes(qTexto)
            if (!hay) return false
          }
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
        this.saving = false
        this.error = null
        this.loaded = false
        this.filtros = { ...FILTROS_VACIOS }
      },

      resetFiltros() {
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
          const { data, error } = await fetchDescuentosMatriculaAnticipada()
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

      validateInput(payload: DescuentoMatriculaAnticipadaInput): string | null {
        if (!Number.isFinite(payload.cod_beneficio) || payload.cod_beneficio <= 0) {
          return 'Código beneficio inválido.'
        }
        if (!payload.nombre.trim()) return 'El nombre es obligatorio.'
        if (!validarPeriodo(payload.periodo)) {
          return 'Periodo inválido (use formato AAAA-S, ej. 2027-1).'
        }
        const vigErr = validarVigencia(payload.vigencia_desde, payload.vigencia_hasta)
        if (vigErr) return vigErr
        const monto = Number(payload.monto_descuento)
        if (!Number.isFinite(monto) || monto < 0) {
          return 'El monto debe ser un valor en pesos igual o mayor a 0.'
        }
        return null
      },

      async create(
        payload: DescuentoMatriculaAnticipadaInput,
      ): Promise<{ ok: boolean; error?: string }> {
        const validation = this.validateInput(payload)
        if (validation) {
          this.error = validation
          return { ok: false, error: validation }
        }
        this.saving = true
        this.error = null
        try {
          const { data, error } = await insertDescuentoMatriculaAnticipada(payload)
          if (error || !data) {
            this.error = error ?? 'No se pudo crear'
            return { ok: false, error: this.error }
          }
          await this.fetchAll()
          return { ok: true }
        } finally {
          this.saving = false
        }
      },

      async update(
        id: number,
        payload: DescuentoMatriculaAnticipadaInput,
      ): Promise<{ ok: boolean; error?: string }> {
        const validation = this.validateInput(payload)
        if (validation) {
          this.error = validation
          return { ok: false, error: validation }
        }
        this.saving = true
        this.error = null
        try {
          const { data, error } = await updateDescuentoMatriculaAnticipada(id, payload)
          if (error || !data) {
            this.error = error ?? 'No se pudo actualizar'
            return { ok: false, error: this.error }
          }
          await this.fetchAll()
          return { ok: true }
        } finally {
          this.saving = false
        }
      },

      async remove(id: number): Promise<{ ok: boolean; error?: string }> {
        this.saving = true
        this.error = null
        try {
          const { error } = await deleteDescuentoMatriculaAnticipada(id)
          if (error) {
            this.error = error
            return { ok: false, error }
          }
          await this.fetchAll()
          return { ok: true }
        } finally {
          this.saving = false
        }
      },
    },
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useDescuentoMatriculaAnticipadaStore, import.meta.hot),
  )
}

export type { DescuentoMatriculaAnticipadaInput, DescuentoMatriculaAplicable }
