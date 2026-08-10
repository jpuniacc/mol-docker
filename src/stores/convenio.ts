import { defineStore } from 'pinia'

import { supabase } from '@/services/supabaseClient'
import type { TpConvenioRow } from '@/types/supabase'
import type { SimuladorConvenioRow } from '@/types/simuladorPlanPago'

export function mapConvenioToSimulador(
  rows: TpConvenioRow[],
): SimuladorConvenioRow[] {
  return rows
    .filter((row) => row.activo)
    .map((row) => ({
      id: String(row.id),
      codigo: String(row.codigo_convenio),
      nombre: row.descripcion_convenio,
      concepto: row.concepto,
      tipo_descuento: row.tipo_descuento,
      valor_descuento: Number(row.valor_descuento),
      activo: row.activo,
      orden: row.codigo_convenio,
      created_at: row.created_at,
    }))
}

export const useConvenioStore = defineStore('convenio', {
  state: () => ({
    rows: [] as TpConvenioRow[],
    loading: false,
    error: null as string | null,
    loaded: false,
  }),

  getters: {
    opciones: (s): TpConvenioRow[] => s.rows,
    simuladorConvenios: (s): SimuladorConvenioRow[] => mapConvenioToSimulador(s.rows),
  },

  actions: {
    async fetchConvenios(force = false) {
      if (this.loaded && !force) return
      this.loading = true
      this.error = null
      try {
        const { data, error } = await supabase
          .from('tp_convenio')
          .select(
            'id, codigo_convenio, descripcion_convenio, concepto, tipo_descuento, valor_descuento, activo, created_at',
          )
          .eq('activo', true)
          .order('codigo_convenio', { ascending: true })

        if (error) {
          const legacy = await supabase
            .from('mnp_simulador_convenio')
            .select('*')
            .eq('activo', true)
            .order('orden')
          if (legacy.error) {
            this.error = error.message
            this.rows = []
            return
          }
          this.rows = ((legacy.data ?? []) as SimuladorConvenioRow[]).map((c) => ({
            id: Number(c.id) || 0,
            codigo_convenio: Number(c.codigo) || 0,
            descripcion_convenio: c.nombre,
            concepto: c.concepto,
            tipo_descuento: c.tipo_descuento,
            valor_descuento: c.valor_descuento,
            activo: c.activo,
            created_at: c.created_at ?? '',
          }))
          this.loaded = true
          return
        }

        const rows = (data ?? []) as TpConvenioRow[]
        if (rows.length === 0) {
          const legacy = await supabase
            .from('mnp_simulador_convenio')
            .select('*')
            .eq('activo', true)
            .order('orden')
          if (!legacy.error && (legacy.data?.length ?? 0) > 0) {
            this.rows = ((legacy.data ?? []) as SimuladorConvenioRow[]).map((c) => ({
              id: Number(c.id) || 0,
              codigo_convenio: Number(c.codigo) || 0,
              descripcion_convenio: c.nombre,
              concepto: c.concepto,
              tipo_descuento: c.tipo_descuento,
              valor_descuento: c.valor_descuento,
              activo: c.activo,
              created_at: c.created_at ?? '',
            }))
            this.loaded = true
            return
          }
        }

        this.rows = rows
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
  },
})
