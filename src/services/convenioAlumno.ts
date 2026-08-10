import type { ConvenioInstitucionalCompleto } from '@/services/convenioInstitucional'
import type { PlanPagosMvBeneficioDetalle, PlanPagosMvRow } from '@/types/supabase'

export type ConvenioAlumnoMatch = {
  convenio: ConvenioInstitucionalCompleto
  codBeneficioAlumno: string
  descripcionBeneficio: string | null
  esVigente: boolean
}

function normalizarCodigo(valor: string | null | undefined): string {
  return (valor ?? '').trim().toUpperCase()
}

/**
 * Cruza los beneficios del plan del alumno (`beneficios_detalle[].cod_beneficio`)
 * con el catálogo de convenios institucionales (`codigo_beneficio`).
 * Un convenio se considera vigente cuando su `estado === 'VIGENTE'`.
 */
export function detectarConveniosAlumno(
  plan: PlanPagosMvRow | null | undefined,
  convenios: ConvenioInstitucionalCompleto[],
): ConvenioAlumnoMatch[] {
  if (!plan) return []

  const beneficios: PlanPagosMvBeneficioDetalle[] = Array.isArray(plan.beneficios_detalle)
    ? plan.beneficios_detalle
    : []
  if (beneficios.length === 0) return []

  const conveniosPorCodigo = new Map<string, ConvenioInstitucionalCompleto>()
  for (const c of convenios) {
    const cod = normalizarCodigo(c.codigo_beneficio)
    if (!cod) continue
    // Prioriza convenios activos si hay duplicados por código.
    const existente = conveniosPorCodigo.get(cod)
    if (!existente || (!existente.activo && c.activo)) {
      conveniosPorCodigo.set(cod, c)
    }
  }
  if (conveniosPorCodigo.size === 0) return []

  const matches: ConvenioAlumnoMatch[] = []
  const vistos = new Set<string>()

  for (const b of beneficios) {
    const cod = normalizarCodigo(b.cod_beneficio)
    if (!cod) continue
    const convenio = conveniosPorCodigo.get(cod)
    if (!convenio) continue
    if (vistos.has(convenio.id)) continue
    vistos.add(convenio.id)

    matches.push({
      convenio,
      codBeneficioAlumno: (b.cod_beneficio ?? '').trim(),
      descripcionBeneficio: b.descripcion ?? null,
      esVigente: convenio.estado === 'VIGENTE',
    })
  }

  return matches
}
