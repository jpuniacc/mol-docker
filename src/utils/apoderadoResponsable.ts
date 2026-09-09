import type { PlanPagosMvRow } from '@/types/supabase'

export const APODERADO_SIN_INFO = 'Sin información'

export function esPropioSostenedor(esResponsable: string | null | undefined): boolean {
  return (esResponsable ?? '').trim().toUpperCase() === 'S'
}

function textoOSinInfo(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : APODERADO_SIN_INFO
}

export function nombreCompletoApoderado(
  row: Pick<
    PlanPagosMvRow,
    'nombre_apoderado' | 'apellido_paterno_apoderado' | 'apellido_materno_apoderado'
  >,
): string {
  const parts = [row.nombre_apoderado, row.apellido_paterno_apoderado, row.apellido_materno_apoderado]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim())
  return parts.length > 0 ? parts.join(' ') : APODERADO_SIN_INFO
}

export function telefonoApoderadoDisplay(
  row: Pick<PlanPagosMvRow, 'telefono_apoder' | 'telefono_apoderado'>,
): string {
  const preferido = (row.telefono_apoder ?? '').trim()
  if (preferido) return preferido
  return textoOSinInfo(row.telefono_apoderado)
}

export function mailApoderadoDisplay(row: Pick<PlanPagosMvRow, 'mail_apoder'>): string {
  return textoOSinInfo(row.mail_apoder)
}
