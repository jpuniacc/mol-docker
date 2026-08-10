import { periodoActivoLabel } from '@/services/periodoActivo'
import { useAuthStore } from '@/stores/auth'

export type ContextoMolAuditoriaOpciones = {
  rutAlumno?: string | null
  codcli?: string | null
  nombreAlumno?: string | null
  anioPeriodo?: number | null
  semestrePeriodo?: number | null
  esMock?: boolean
  urlOrigen?: string | null
}

export type ContextoMolAuditoria = {
  sesionId: string | null
  rutAlumno: string | null
  codcli: string | null
  nombreAlumno: string | null
  anioPeriodo: number | null
  semestrePeriodo: number | null
  periodoLabel: string | null
  esMock: boolean
  urlOrigen: string | null
}

export function obtenerSesionLogId(): string | null {
  return useAuthStore().sessionLogId
}

export function contextoMolAuditoria(opciones: ContextoMolAuditoriaOpciones = {}): ContextoMolAuditoria {
  const anioPeriodo = opciones.anioPeriodo ?? null
  const semestrePeriodo = opciones.semestrePeriodo ?? null
  const periodoLabel =
    anioPeriodo != null && semestrePeriodo != null
      ? periodoActivoLabel(anioPeriodo, semestrePeriodo)
      : null

  return {
    sesionId: obtenerSesionLogId(),
    rutAlumno: opciones.rutAlumno ?? null,
    codcli: opciones.codcli ?? null,
    nombreAlumno: opciones.nombreAlumno ?? null,
    anioPeriodo,
    semestrePeriodo,
    periodoLabel,
    esMock: opciones.esMock ?? false,
    urlOrigen:
      opciones.urlOrigen ??
      (typeof window !== 'undefined' ? window.location.href : null),
  }
}
