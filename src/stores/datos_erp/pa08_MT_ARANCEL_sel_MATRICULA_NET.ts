import { defineStore } from 'pinia'

import {
  fetchArancelMatriculaNet,
  type ArancelMatriculaNetData,
  type ArancelMatriculaNetParams,
} from '@/services/arancelMatriculaNetApi'

/**
 * Store on-demand del SP ERP:
 *   pa08_MT_ARANCEL_sel_MATRICULA_NET
 *
 * Uso: forma-pago del flujo mock (y producción) para obtener
 * matrícula + arancel vigentes desde U+, no desde montos históricos
 * del consolidado (VW_DOCPAG).
 *
 * ---------------------------------------------------------------------------
 * Parámetros de entrada (body API → SP)
 * ---------------------------------------------------------------------------
 * @CODCARR   ← params.codCarr      ← consolidado.codigo_carrera / vista.cod_carrera
 * @ANO       ← params.ano          ← consolidado.anio_matricula
 * @ANOINI    ← params.anoIni       ← consolidado.anio_ingreso / vista.ano_ingreso
 * @FECMOD    ← sysdate en servidor API (no viaja en el body del front)
 * @PERIODO   ← params.periodo      ← consolidado.periodo_matricula
 * @CATALUMNO ← params.catAlumno    ← consolidado.categoria_alumno (string)
 * @JORNADA   ← params.jornada      ← consolidado.jornada_carrera (AD/D/V/S)
 *
 * ---------------------------------------------------------------------------
 * Campos de salida tipados (data)
 * ---------------------------------------------------------------------------
 * matricula        ← MATRICULA (monto matrícula)
 * arancel          ← MONTO / ARANCEL (monto arancel)
 * cuotasMatricula  ← CUOTAS_MATRICULA (si el SP lo expone)
 * cuotasArancel    ← CUOTAS (cuotas típicas de arancel en MT_ARANCEL)
 * documentos       ← DOCUMENTOS
 * moneda           ← MONEDA
 * fecMod           ← FECMOD de la fila
 * fuente           ← 'sp' | 'mt_arancel' (fallback si no hay EXECUTE)
 * raw              ← primera fila cruda del recordset (diagnóstico / mapeo)
 *
 * Endpoint: POST /api/rematricula/arancel/matricula-net
 */
export type Pa08MtArancelSelMatriculaNetParams = ArancelMatriculaNetParams
export type Pa08MtArancelSelMatriculaNetData = ArancelMatriculaNetData

export const usePa08MtArancelSelMatriculaNetStore = defineStore(
  'pa08MtArancelSelMatriculaNet',
  {
    state: () => ({
      loading: false,
      error: null as string | null,
      errorCode: null as string | null,
      /** Params con los que se obtuvo `data` (auditoría / reintento). */
      paramsUsados: null as Pa08MtArancelSelMatriculaNetParams | null,
      data: null as Pa08MtArancelSelMatriculaNetData | null,
      fetchedAt: null as string | null,
      duracionMs: null as number | null,
    }),
    getters: {
      /** Monto bruto matrícula desde el SP (0 si aún no hay data). */
      montoMatricula: (s) => Number(s.data?.matricula ?? 0),
      /** Monto bruto arancel desde el SP (0 si aún no hay data). */
      montoArancel: (s) => Number(s.data?.arancel ?? 0),
      tieneData: (s) => s.data != null,
      paramsResumen: (s) => {
        const p = s.paramsUsados
        if (!p) return null
        return `CODCARR=${p.codCarr} ANO=${p.ano} ANOINI=${p.anoIni} PERIODO=${p.periodo} CATALUMNO=${p.catAlumno} JORNADA=${p.jornada}`
      },
    },
    actions: {
      reset() {
        this.loading = false
        this.error = null
        this.errorCode = null
        this.paramsUsados = null
        this.data = null
        this.fetchedAt = null
        this.duracionMs = null
      },

      /**
       * Llama al API on-demand y guarda el resultado del SP.
       * No usa cache local de mnp_mt_arancel: siempre ERP.
       */
      async fetchFromErp(params: Pa08MtArancelSelMatriculaNetParams): Promise<boolean> {
        this.loading = true
        this.error = null
        this.errorCode = null
        this.paramsUsados = { ...params }

        try {
          const res = await fetchArancelMatriculaNet(params)
          this.duracionMs = res.duracionMs ?? null
          if (res.params) this.paramsUsados = { ...res.params }

          if (!res.ok || !res.data) {
            this.data = null
            this.fetchedAt = null
            this.errorCode = res.code ?? null
            this.error = res.error || res.message || 'No se pudo obtener arancel/matrícula del ERP'
            return false
          }

          this.data = res.data
          this.fetchedAt = new Date().toISOString()
          this.error = null
          this.errorCode = null
          return true
        } catch (err) {
          this.data = null
          this.fetchedAt = null
          this.errorCode = 'ERP_ERROR'
          this.error = err instanceof Error ? err.message : 'Error consultando SP'
          return false
        } finally {
          this.loading = false
        }
      },
    },
  },
)
