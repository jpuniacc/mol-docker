import { acceptHMRUpdate, defineStore } from 'pinia'

import {
  activarErpSpAmbiente,
  fetchErpSpAmbienteActivo,
  fetchErpSpAmbientes,
  type ErpSpAmbiente,
} from '@/services/erpSpAmbiente'
import type { TpMnpErpSpAmbienteRow } from '@/types/supabase'

export const useErpSpAmbienteStore = defineStore('erpSpAmbiente', {
  state: () => ({
    loading: false,
    error: null as string | null,
    rows: [] as TpMnpErpSpAmbienteRow[],
    vigente: null as TpMnpErpSpAmbienteRow | null,
    loaded: false,
  }),

  getters: {
    ambiente(): ErpSpAmbiente {
      const a = this.vigente?.ambiente
      return a === 'test' ? 'test' : 'prod'
    },
    label(): string {
      return this.vigente?.label ?? (this.ambiente === 'test' ? 'Test espejado' : 'Producción')
    },
    badgeText(): string {
      return this.ambiente === 'test' ? 'ERP SP: TEST' : 'ERP SP: PROD'
    },
    isTest(): boolean {
      return this.ambiente === 'test'
    },
  },

  actions: {
    reset() {
      this.loading = false
      this.error = null
      this.rows = []
      this.vigente = null
      this.loaded = false
    },

    async ensureLoaded(force = false) {
      if (this.loaded && !force) return
      await this.fetchAll()
    },

    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        const [listRes, vigenteRes] = await Promise.all([
          fetchErpSpAmbientes(),
          fetchErpSpAmbienteActivo(),
        ])

        if (listRes.error) {
          this.error = listRes.error
          this.rows = []
        } else {
          this.rows = [...listRes.data].sort((a, b) =>
            a.ambiente === 'prod' ? -1 : b.ambiente === 'prod' ? 1 : 0,
          )
        }

        if (vigenteRes.error) {
          this.error = this.error ?? vigenteRes.error
          this.vigente = null
        } else {
          this.vigente = vigenteRes.data
        }

        this.loaded = true
      } finally {
        this.loading = false
      }
    },

    async activar(ambiente: ErpSpAmbiente) {
      this.loading = true
      this.error = null
      try {
        const { error } = await activarErpSpAmbiente(ambiente)
        if (error) {
          this.error = error
          return false
        }
        await this.fetchAll()
        return true
      } finally {
        this.loading = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useErpSpAmbienteStore, import.meta.hot))
}
