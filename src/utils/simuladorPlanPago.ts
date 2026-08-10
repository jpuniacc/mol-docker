import type { PlanPagosMvRow } from '@/types/supabase'
import type {
  SimuladorBecaEstadoRow,
  SimuladorConcepto,
  SimuladorConceptoCalculo,
  SimuladorConvenioRow,
  SimuladorFormState,
  SimuladorResultado,
  SimuladorTipoPagoRow,
  SimuladorTotalesJson,
} from '@/types/simuladorPlanPago'

function n(v: number | null | undefined): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function clampNonNeg(v: number): number {
  return Math.max(0, v)
}

function esCaeActivo(v: string | null | undefined): boolean {
  const norm = (v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return norm === 'si' || norm === 's' || norm === 'true' || norm === '1'
}

function aplicaConcepto(
  catalogConcepto: 'MATRICULA' | 'ARANCEL' | 'AMBOS',
  target: SimuladorConcepto,
): boolean {
  return catalogConcepto === 'AMBOS' || catalogConcepto === target
}

export function calcDescuentoCatalogo(
  base: number,
  tipo: 'PORCENTAJE' | 'MONTO',
  valor: number,
): number {
  if (base <= 0) return 0
  if (tipo === 'PORCENTAJE') return clampNonNeg((base * n(valor)) / 100)
  return clampNonNeg(n(valor))
}

function brutoArancel(row: PlanPagosMvRow, arancelUnSemestre: boolean): number {
  const bruto = n(row.monto_arancel)
  return arancelUnSemestre ? bruto / 2 : bruto
}

function beneficioAdicionalMonto(
  row: PlanPagosMvRow,
  codigo: string | null,
  pctOverride: number,
): { matricula: number; arancel: number } {
  let mat = 0
  let ara = 0
  const lista = row.beneficios_detalle ?? []
  for (const b of lista) {
    const cod = String(b.cod_beneficio ?? '')
    if (codigo && cod !== codigo) continue
    const monto = n(b.monto_aprobado ?? b.monto)
    const pct = pctOverride > 0 ? pctOverride : n(b.porc_apr)
    const aplicable = (b.aplicable ?? '').toUpperCase()
    const valor =
      pct > 0 && monto <= 0
        ? 0
        : monto > 0
          ? monto
          : 0
    if (aplicable === 'M' || aplicable === 'MATRICULA') mat += valor
    else if (
      aplicable === 'A' ||
      aplicable === 'ARANCEL' ||
      aplicable === 'S' ||
      aplicable === 'SI' ||
      aplicable === ''
    )
      ara += valor
  }
  if (codigo && pctOverride > 0) {
    const brutoMat = n(row.monto_matricula)
    const brutoAra = brutoArancel(row, false)
    if (mat === 0 && ara === 0) {
      return {
        matricula: (brutoMat * pctOverride) / 100,
        arancel: (brutoAra * pctOverride) / 100,
      }
    }
  }
  return { matricula: mat, arancel: ara }
}

export function defaultValidezPropuesta(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function buildDefaultForm(
  row: PlanPagosMvRow,
  opts: {
    diasValidez?: number
    tiposPago: SimuladorTipoPagoRow[]
    convenios: SimuladorConvenioRow[]
    becas: SimuladorBecaEstadoRow[]
  },
): SimuladorFormState {
  const esMandato = (t: SimuladorTipoPagoRow) =>
    t.codigo === '3' || t.nombre.toUpperCase().includes('MANDATO')
  const tpMat = opts.tiposPago.find(
    (t) => t.concepto === 'MATRICULA' && esMandato(t),
  )
  const tpAra = opts.tiposPago.find(
    (t) => t.concepto === 'ARANCEL' && esMandato(t),
  )
  const conv = opts.convenios.find(
    (c) => c.codigo === '0' || c.codigo === 'SIN_CONVENIO',
  )
  const beca = opts.becas.find((b) => b.codigo === 'SIN_BECA')
  return {
    validez_propuesta: defaultValidezPropuesta(opts.diasValidez ?? 30),
    arancel_un_semestre: false,
    marca_cae: esCaeActivo(row.alumno_cae),
    monto_cae: 0,
    abono_resolucion: 0,
    abono_contado_arancel: 0,
    descuento_medio_pago_pct: 0,
    tipo_pago_matricula_id: tpMat?.id ?? null,
    tipo_pago_arancel_id: tpAra?.id ?? null,
    n_cuotas_matricula: Math.max(1, n(row.cuota_matricula) || 1),
    n_cuotas_arancel: Math.max(1, n(row.cuota_arancel) || 1),
    convenio_id: conv?.id ?? null,
    beca_estado_id: beca?.id ?? null,
    beneficio_matricula_no_renovable_id: null,
    beneficio_adicional_codigo: null,
    beneficio_adicional_pct: 0,
  }
}

function calcConcepto(params: {
  concepto: SimuladorConcepto
  bruto: number
  beneficioErp: number
  becaEstadoMonto: number
  convenioMonto: number
  abono: number
  cae: number
  beneficioAdicional: number
  descuentoMedioPct: number
  nCuotas: number
  tipoPago: SimuladorTipoPagoRow | null
}): SimuladorConceptoCalculo {
  const base = clampNonNeg(
    params.bruto -
      params.beneficioErp -
      params.becaEstadoMonto -
      params.convenioMonto -
      params.abono -
      params.cae -
      params.beneficioAdicional,
  )
  const descMedio = calcDescuentoCatalogo(
    base,
    'PORCENTAJE',
    params.descuentoMedioPct,
  )
  const neto = clampNonNeg(base - descMedio)
  const cuotas = Math.max(1, params.nCuotas)
  return {
    concepto: params.concepto,
    bruto: params.bruto,
    beneficio_erp: params.beneficioErp,
    beca_estado: params.becaEstadoMonto,
    convenio: params.convenioMonto,
    abono: params.abono,
    cae: params.cae,
    beneficio_adicional: params.beneficioAdicional,
    neto,
    n_cuotas: cuotas,
    valor_cuota: neto > 0 ? neto / cuotas : null,
    tipo_pago_codigo: params.tipoPago?.codigo ?? null,
    tipo_pago_nombre: params.tipoPago?.nombre ?? null,
  }
}

export function calcularSimulacion(
  row: PlanPagosMvRow,
  form: SimuladorFormState,
  catalogos: {
    tiposPago: SimuladorTipoPagoRow[]
    convenios: SimuladorConvenioRow[]
    becasEstado: SimuladorBecaEstadoRow[]
  },
): SimuladorResultado {
  const errores: string[] = []
  const tpMat =
    catalogos.tiposPago.find((t) => t.id === form.tipo_pago_matricula_id) ??
    null
  const tpAra =
    catalogos.tiposPago.find((t) => t.id === form.tipo_pago_arancel_id) ?? null
  const convenio =
    catalogos.convenios.find((c) => c.id === form.convenio_id) ?? null
  const beca =
    catalogos.becasEstado.find((b) => b.id === form.beca_estado_id) ?? null

  if (!tpMat) errores.push('Selecciona el tipo de pago de matrícula')
  if (!tpAra) errores.push('Selecciona el tipo de pago de arancel')
  if (!form.validez_propuesta) errores.push('Ingresa la validez de la propuesta')

  const brutoMat = n(row.monto_matricula)
  const brutoAra = brutoArancel(row, form.arancel_un_semestre)
  const erpMat = n(row.beca_matricula)
  const erpAra = n(row.beca_arancel)

  const baseMat = clampNonNeg(brutoMat - erpMat)
  const baseAra = clampNonNeg(brutoAra - erpAra)

  let becaMat = 0
  let becaAra = 0
  if (beca) {
    if (aplicaConcepto(beca.concepto, 'MATRICULA'))
      becaMat = calcDescuentoCatalogo(
        baseMat,
        beca.tipo_descuento,
        beca.valor_descuento,
      )
    if (aplicaConcepto(beca.concepto, 'ARANCEL'))
      becaAra = calcDescuentoCatalogo(
        baseAra,
        beca.tipo_descuento,
        beca.valor_descuento,
      )
  }

  // Regla de negocio: los convenios SIEMPRE se aplican sobre el arancel,
  // nunca sobre la matrícula (se ignora convenio.concepto para este cálculo).
  const convMat = 0
  let convAra = 0
  if (convenio) {
    convAra = calcDescuentoCatalogo(
      baseAra,
      convenio.tipo_descuento,
      convenio.valor_descuento,
    )
  }

  const adic = beneficioAdicionalMonto(
    row,
    form.beneficio_adicional_codigo,
    form.beneficio_adicional_pct,
  )

  const caeAra = form.marca_cae ? clampNonNeg(form.monto_cae) : 0

  const matricula = calcConcepto({
    concepto: 'MATRICULA',
    bruto: brutoMat,
    beneficioErp: erpMat,
    becaEstadoMonto: becaMat,
    convenioMonto: convMat,
    abono: 0,
    cae: 0,
    beneficioAdicional: adic.matricula,
    descuentoMedioPct: 0,
    nCuotas: form.n_cuotas_matricula,
    tipoPago: tpMat,
  })

  const arancel = calcConcepto({
    concepto: 'ARANCEL',
    bruto: brutoAra,
    beneficioErp: erpAra,
    becaEstadoMonto: becaAra,
    convenioMonto: convAra,
    abono: n(form.abono_resolucion) + n(form.abono_contado_arancel),
    cae: caeAra,
    beneficioAdicional: adic.arancel,
    descuentoMedioPct: form.descuento_medio_pago_pct,
    nCuotas: form.n_cuotas_arancel,
    tipoPago: tpAra,
  })

  const totalBecaEstado = becaMat + becaAra
  const pctBecaAra =
    brutoAra > 0 ? Math.round((becaAra / brutoAra) * 10000) / 100 : 0
  const montoFinanciarBecas = erpMat + erpAra + totalBecaEstado + convMat + convAra
  const totales: SimuladorTotalesJson = {
    total_beca_estado: totalBecaEstado,
    total_beca_arancel_pct: pctBecaAra,
    monto_financiar_becas: montoFinanciarBecas,
    monto_financiar_cae: caeAra,
    monto_arancel_financiar: arancel.neto,
    monto_arancel_mas_matricula: arancel.neto + matricula.neto,
    monto_neto_financiar: matricula.neto + arancel.neto,
  }

  return { matricula, arancel, totales, errores }
}

export function reglaNumero(
  reglas: Record<string, unknown>,
  clave: string,
  fallback: number,
): number {
  const v = reglas[clave]
  const nVal = Number(v)
  return Number.isFinite(nVal) ? nVal : fallback
}
