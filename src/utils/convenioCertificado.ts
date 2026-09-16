import type { MnpMvBeneficioPeriodoRow, PlanPagosMvRow } from '@/types/supabase'

export type CertificadoRequerido = {
  codigoBeneficio: string
  beneficio: string
  tipoCertificado: 'AFILIACION' | 'ANTIGUEDAD_LABORAL' | null
}

function normalizarCodigo(valor: string | null | undefined): string {
  return (valor ?? '').trim().toUpperCase()
}

export function detectarCertificadosRequeridos(
  plan: PlanPagosMvRow | null | undefined,
  catalogo: Pick<
    MnpMvBeneficioPeriodoRow,
    'codigo_beneficio' | 'beneficio' | 'requiere_certificado' | 'tipo_certificado'
  >[],
): CertificadoRequerido[] {
  if (!plan) return []
  const beneficios = Array.isArray(plan.beneficios_detalle) ? plan.beneficios_detalle : []
  if (beneficios.length === 0) return []

  const porCodigo = new Map<string, CertificadoRequerido>()
  for (const fila of catalogo) {
    if (!fila.requiere_certificado) continue
    const cod = normalizarCodigo(fila.codigo_beneficio)
    if (!cod) continue
    porCodigo.set(cod, {
      codigoBeneficio: (fila.codigo_beneficio ?? '').trim(),
      beneficio: fila.beneficio,
      tipoCertificado: fila.tipo_certificado,
    })
  }
  if (porCodigo.size === 0) return []

  const out: CertificadoRequerido[] = []
  const vistos = new Set<string>()
  for (const b of beneficios) {
    const cod = normalizarCodigo(b.cod_beneficio)
    if (!cod || vistos.has(cod)) continue
    const req = porCodigo.get(cod)
    if (!req) continue
    vistos.add(cod)
    out.push(req)
  }
  return out
}

export function textoTipoCertificado(
  tipo: CertificadoRequerido['tipoCertificado'],
): string {
  if (tipo === 'AFILIACION') return 'certificado de afiliación actualizado'
  if (tipo === 'ANTIGUEDAD_LABORAL') return 'certificado de antigüedad laboral actualizado'
  return 'documento que acredita el convenio'
}
