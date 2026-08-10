import { defineStore } from 'pinia'

import { supabase } from '@/services/supabaseClient'
import type { TpTipoPagoRow } from '@/types/supabase'
import type { SimuladorTipoPagoRow } from '@/types/simuladorPlanPago'

export function mapTipoPagoToSimulador(
  rows: TpTipoPagoRow[],
): SimuladorTipoPagoRow[] {
  return rows.flatMap((row) => {
    const base = {
      id: String(row.id),
      codigo: String(row.codigo_tipo_pago),
      nombre: row.descripcion_tipo_pago,
      cuotas_max: row.codigo_tipo_pago === 1 ? 1 : 12,
      activo: true,
      orden: row.codigo_tipo_pago,
      created_at: row.created_at,
    }

    return [
      { ...base, concepto: 'MATRICULA' as const },
      { ...base, concepto: 'ARANCEL' as const },
    ]
  })
}

export const useTipoPagoStore = defineStore('tipoPago', {
  state: () => ({
    rows: [] as TpTipoPagoRow[],
    loading: false,
    error: null as string | null,
    loaded: false,
  }),

  getters: {
    opciones: (s): TpTipoPagoRow[] => s.rows,
    simuladorTiposPago: (s): SimuladorTipoPagoRow[] =>
      mapTipoPagoToSimulador(s.rows),
  },

  actions: {
    async fetchTiposPago(force = false) {
      if (this.loaded && !force) return
      this.loading = true
      this.error = null
      try {
        const { data, error } = await supabase
          .from('tp_tipo_pago')
          .select('id, codigo_tipo_pago, descripcion_tipo_pago, created_at')
          .order('codigo_tipo_pago', { ascending: true })

        if (error) {
          this.error = error.message
          this.rows = []
          return
        }

        this.rows = (data ?? []) as TpTipoPagoRow[]
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
  },
})
