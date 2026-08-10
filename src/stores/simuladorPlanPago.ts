import { defineStore } from 'pinia'

import {
  calcularDesdeForm,
  crearFormDesdeRow,
  fetchSimulacionesPorCodcli,
  fetchSimuladorCatalogos,
  guardarSimulacion,
} from '@/services/simuladorPlanPago'
import { useConvenioStore } from '@/stores/convenio'
import { useTipoPagoStore } from '@/stores/tipoPago'
import type { PlanPagosMvRow } from '@/types/supabase'
import type {
  SimulacionPlanPagoRow,
  SimuladorCatalogos,
  SimuladorFormState,
  SimuladorResultado,
} from '@/types/simuladorPlanPago'

function esCaeActivo(v: string | null | undefined): boolean {
  const norm = (v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return norm === 'si' || norm === 's' || norm === 'true' || norm === '1'
}

export const useSimuladorPlanPagoStore = defineStore('simuladorPlanPago', {
  state: () => ({
    open: false,
    loadingCatalogos: false,
    loadingHistorial: false,
    saving: false,
    error: null as string | null,
    row: null as PlanPagosMvRow | null,
    catalogos: null as SimuladorCatalogos | null,
    form: null as SimuladorFormState | null,
    resultado: null as SimuladorResultado | null,
    historial: [] as SimulacionPlanPagoRow[],
  }),

  getters: {
    puedeGuardar(s): boolean {
      return (
        !!s.row &&
        !!s.form &&
        !!s.resultado &&
        s.resultado.errores.length === 0
      )
    },
  },

  actions: {
    async abrir(row: PlanPagosMvRow) {
      this.open = true
      this.row = row
      this.error = null
      this.resultado = null
      this.loadingCatalogos = true
      try {
        const tipoPagoStore = useTipoPagoStore()
        const convenioStore = useConvenioStore()
        const [{ data, error }] = await Promise.all([
          fetchSimuladorCatalogos(),
          tipoPagoStore.fetchTiposPago(),
          convenioStore.fetchConvenios(),
        ])
        if (error || !data) {
          this.error = error ?? 'No se cargaron catálogos del simulador'
          return
        }
        if (tipoPagoStore.error) {
          this.error = tipoPagoStore.error
          return
        }
        if (convenioStore.error) {
          this.error = convenioStore.error
          return
        }
        const catalogos = {
          ...data,
          tiposPago: tipoPagoStore.simuladorTiposPago,
          convenios: convenioStore.simuladorConvenios,
        }
        this.catalogos = catalogos
        this.form = crearFormDesdeRow(row, catalogos)
        this.recalcular()
        await this.cargarHistorial(row.codcli ?? '')
        this.aplicarUltimasFormasPago()
      } finally {
        this.loadingCatalogos = false
      }
    },

    cerrar() {
      this.open = false
      this.row = null
      this.form = null
      this.resultado = null
      this.historial = []
      this.error = null
    },

    recalcular() {
      if (!this.row || !this.form || !this.catalogos) return
      this.resultado = calcularDesdeForm(this.row, this.form, this.catalogos)
    },

    patchForm(partial: Partial<SimuladorFormState>) {
      if (!this.form) return
      this.form = { ...this.form, ...partial }
      this.recalcular()
    },

    aplicarUltimasFormasPago() {
      if (!this.form || !this.catalogos) return
      const ultima = this.historial[0]
      if (!ultima?.inputs_json) {
        if (this.row) {
          this.form = { ...this.form, marca_cae: esCaeActivo(this.row.alumno_cae) }
          this.recalcular()
        }
        return
      }

      const tipoMatriculaId =
        ultima.inputs_json.tipo_pago_matricula_id != null
          ? String(ultima.inputs_json.tipo_pago_matricula_id)
          : null
      const tipoArancelId =
        ultima.inputs_json.tipo_pago_arancel_id != null
          ? String(ultima.inputs_json.tipo_pago_arancel_id)
          : null

      const existeTipoPago = (
        id: string | null,
        concepto: 'MATRICULA' | 'ARANCEL',
      ) =>
        !!id &&
        this.catalogos?.tiposPago.some(
          (t) => t.id === id && t.concepto === concepto,
        )

      const existeConvenio = (id: string | null) =>
        !!id &&
        this.catalogos?.convenios.some((c) => c.id === id)

      const patch: Partial<SimuladorFormState> = {
        marca_cae: this.row ? esCaeActivo(this.row.alumno_cae) : this.form.marca_cae,
      }
      if (existeTipoPago(tipoMatriculaId, 'MATRICULA')) {
        patch.tipo_pago_matricula_id = tipoMatriculaId
      }
      if (existeTipoPago(tipoArancelId, 'ARANCEL')) {
        patch.tipo_pago_arancel_id = tipoArancelId
      }
      const convenioId =
        ultima.inputs_json.convenio_id != null
          ? String(ultima.inputs_json.convenio_id)
          : null
      if (existeConvenio(convenioId)) {
        patch.convenio_id = convenioId
      }

      if (Object.keys(patch).length === 0) return
      this.form = { ...this.form, ...patch }
      this.recalcular()
    },

    async cargarHistorial(codcli: string) {
      if (!codcli) return
      this.loadingHistorial = true
      try {
        const { data, error } = await fetchSimulacionesPorCodcli(codcli)
        if (error) this.error = error
        else this.historial = data
      } finally {
        this.loadingHistorial = false
      }
    },

    async guardar(createdBy?: string | null) {
      if (!this.row || !this.form || !this.resultado) return
      this.saving = true
      this.error = null
      try {
        const { id, error } = await guardarSimulacion({
          row: this.row,
          form: this.form,
          resultado: this.resultado,
          estado: 'guardada',
          createdBy,
        })
        if (error) {
          this.error = error
          return
        }
        if (id && this.row.codcli) await this.cargarHistorial(this.row.codcli)
      } finally {
        this.saving = false
      }
    },
  },
})
