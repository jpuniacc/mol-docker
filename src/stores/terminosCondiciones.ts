import { acceptHMRUpdate, defineStore } from 'pinia'

import { fetchTerminosMol, updateTerminosMol } from '@/services/terminosCondiciones'
import type { TpTerminosCondicionesRow } from '@/types/supabase'

export const useTerminosCondicionesStore = defineStore('terminosCondiciones', {
  state: () => ({
    loading: false,
    saving: false,
    error: null as string | null,
    documento: null as TpTerminosCondicionesRow | null,
    loaded: false,
  }),

  getters: {
    tituloDisplay: (s) => s.documento?.titulo?.trim() || null,
    contenidoHtml: (s) => s.documento?.contenido_html ?? '',
    disponible: (s) =>
      s.documento != null &&
      (s.documento.titulo?.trim().length ?? 0) > 0 &&
      (s.documento.contenido_html?.trim().length ?? 0) > 0,
  },

  actions: {
    reset() {
      this.loading = false
      this.saving = false
      this.error = null
      this.documento = null
      this.loaded = false
    },

    async ensureLoaded(force = false) {
      if (this.loaded && !force) return
      await this.fetch()
    },

    async fetch() {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchTerminosMol()
        if (error) {
          this.error = error
          this.documento = null
        } else {
          this.documento = data
        }
        this.loaded = true
      } finally {
        this.loading = false
      }
    },

    async save(titulo: string, contenidoHtml: string) {
      this.saving = true
      this.error = null
      try {
        const { data, error } = await updateTerminosMol({ titulo, contenidoHtml })
        if (error) {
          this.error = error
          return false
        }
        this.documento = data
        return true
      } finally {
        this.saving = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTerminosCondicionesStore, import.meta.hot))
}
