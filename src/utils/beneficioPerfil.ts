import type {
  MnpMvBeneficioPeriodoFlujo,
  MnpMvBeneficioPeriodoRow,
  PlanPagosMvRow,
} from '@/types/supabase'

export type BecaEstatalDetectada = {
  codigoBeneficio: string
  beneficio: string
}

export type BeneficioPlanEtiqueta =
  | 'Interna'
  | 'Estatal'
  | 'Convenio'
  | 'Forma de pago'
  | 'No renovable'
  | 'No vigente'
  | 'En revisión'
  | 'Sin catálogo'

export type BeneficioPlanClasificado = {
  codigoBeneficio: string
  descripcion: string
  flujo: MnpMvBeneficioPeriodoFlujo | null
  etiqueta: BeneficioPlanEtiqueta
}

function normalizarCodigo(valor: string | null | undefined): string {
  return (valor ?? '').trim().toUpperCase()
}

function etiquetaDesdeFlujo(flujo: MnpMvBeneficioPeriodoFlujo | null): BeneficioPlanEtiqueta {
  if (flujo === 'ESTATAL') return 'Estatal'
  if (flujo === 'MOL_DVU') return 'Interna'
  if (flujo === 'CONVENIO') return 'Convenio'
  if (flujo === 'FORMA_PAGO') return 'Forma de pago'
  if (flujo === 'NO_RENOVABLE') return 'No renovable'
  if (flujo === 'NO_VIGENTE') return 'No vigente'
  if (flujo === 'EN_REVISION') return 'En revisión'
  return 'Sin catálogo'
}

export function detectarBecasEstatales(
  plan: PlanPagosMvRow | null | undefined,
  catalogo: Pick<MnpMvBeneficioPeriodoRow, 'codigo_beneficio' | 'beneficio' | 'flujo'>[],
): BecaEstatalDetectada[] {
  if (!plan) return []
  const beneficios = Array.isArray(plan.beneficios_detalle) ? plan.beneficios_detalle : []
  if (beneficios.length === 0) return []

  const porCodigo = new Map<string, BecaEstatalDetectada>()
  for (const fila of catalogo) {
    if (fila.flujo !== 'ESTATAL') continue
    const cod = normalizarCodigo(fila.codigo_beneficio)
    if (!cod) continue
    porCodigo.set(cod, {
      codigoBeneficio: (fila.codigo_beneficio ?? '').trim(),
      beneficio: fila.beneficio,
    })
  }
  if (porCodigo.size === 0) return []

  const out: BecaEstatalDetectada[] = []
  const vistos = new Set<string>()
  for (const b of beneficios) {
    const cod = normalizarCodigo(b.cod_beneficio)
    if (!cod || vistos.has(cod)) continue
    const match = porCodigo.get(cod)
    if (!match) continue
    vistos.add(cod)
    out.push(match)
  }
  return out
}

export function tieneBecaEstatal(
  plan: PlanPagosMvRow | null | undefined,
  catalogo: Pick<MnpMvBeneficioPeriodoRow, 'codigo_beneficio' | 'beneficio' | 'flujo'>[],
): boolean {
  return detectarBecasEstatales(plan, catalogo).length > 0
}

export function clasificarBeneficiosPlan(
  plan: PlanPagosMvRow | null | undefined,
  catalogo: Pick<MnpMvBeneficioPeriodoRow, 'codigo_beneficio' | 'beneficio' | 'flujo'>[],
): BeneficioPlanClasificado[] {
  if (!plan) return []
  const beneficios = Array.isArray(plan.beneficios_detalle) ? plan.beneficios_detalle : []
  const porCodigo = new Map<
    string,
    Pick<MnpMvBeneficioPeriodoRow, 'codigo_beneficio' | 'beneficio' | 'flujo'>
  >()
  for (const fila of catalogo) {
    const cod = normalizarCodigo(fila.codigo_beneficio)
    if (!cod) continue
    porCodigo.set(cod, fila)
  }

  return beneficios.map((b) => {
    const raw = (b.cod_beneficio ?? '').trim()
    const cat = porCodigo.get(normalizarCodigo(raw))
    const flujo = cat?.flujo ?? null
    return {
      codigoBeneficio: raw,
      descripcion: (b.descripcion ?? cat?.beneficio ?? 'Beneficio').trim() || 'Beneficio',
      flujo,
      etiqueta: etiquetaDesdeFlujo(flujo),
    }
  })
}
