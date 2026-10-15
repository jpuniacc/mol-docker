import { acceptHMRUpdate, defineStore } from 'pinia'

import { fetchProximamente, updateProximamente } from '@/services/proximamenteApi'
import type { TpMolProximamenteRow } from '@/types/supabase'
import { mensajeProximamenteGuardable } from '@/utils/proximamenteGate'

export const useProximamenteStore = defineStore('proximamente', {
  state: () => ({
    loading: false,
    saving: false,
    error: null as string | null,
    config: null as TpMolProximamenteRow | null,
    loaded: false,
  }),

  getters: {
    /** Si la fila no se pudo leer, el portal sigue abierto. */
    activoEfectivo: (s) => (s.error || !s.config ? false : s.config.activo === true),
    mensajeVisible: (s) => (s.config?.mensaje ?? '').trim(),
  },

  actions: {
    async ensureLoaded() {
      if (this.loaded && !this.error) return
      await this.fetch()
    },

    async fetch() {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchProximamente()
        if (error) {
          this.error = error
          this.config = null
          this.loaded = false
          return
        }
        this.config = data
        this.loaded = true
      } finally {
        this.loading = false
      }
    },

    async save(payload: { activo: boolean; mensaje: string }): Promise<boolean> {
      const mensaje = payload.mensaje.trim()
      if (!mensajeProximamenteGuardable(mensaje)) {
        this.error = 'Escribe un mensaje.'
        return false
      }
      this.saving = true
      this.error = null
      try {
        const { data, error } = await updateProximamente({
          activo: payload.activo,
          mensaje,
        })
        if (error || !data) {
          this.error = error ?? 'No se pudo guardar.'
          return false
        }
        this.config = data
        this.loaded = true
        return true
      } finally {
        this.saving = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProximamenteStore, import.meta.hot))
}
