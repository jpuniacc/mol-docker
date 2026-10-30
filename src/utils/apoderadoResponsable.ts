import type { PlanPagosMvRow } from '@/types/supabase'

export const APODERADO_SIN_INFO = 'Sin información'

export function esPropioSostenedor(esResponsable: string | null | undefined): boolean {
  return (esResponsable ?? '').trim().toUpperCase() === 'S'
}

function normalizarRut(rut: string | null | undefined): string | null {
  const t = (rut ?? '').replace(/[.\s]/g, '').toUpperCase()
  const m = /^(\d{1,8})-?([\dK])$/.exec(t)
  if (!m) return null
  const cuerpo = m[1].replace(/^0+(?=\d)/, '')
  let suma = 0
  let mul = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const r = 11 - (suma % 11)
  const dv = r === 11 ? '0' : r === 10 ? 'K' : String(r)
  return dv === m[2] ? `${cuerpo}-${dv}` : null
}

/**
 * ¿El contrato lleva sostenedor financiero (bloque + firmante TuFirma)?
 * Solo si es_responsable_financiero es 'N' (si no se conoce, se omite esa condición)
 * Y el RUT del sostenedor es válido Y distinto al del alumno. Misma regla que uniacc-api.
 */
export function tieneSostenedorFinanciero(
  esResponsable: string | null | undefined,
  rutAlumno: string | null | undefined,
  rutSostenedor: string | null | undefined,
): boolean {
  if (esResponsable !== undefined) {
    if ((esResponsable ?? '').trim().toUpperCase() !== 'N') return false
  }
  const sost = normalizarRut(rutSostenedor)
  if (!sost) return false
  return normalizarRut(rutAlumno) !== sost
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
