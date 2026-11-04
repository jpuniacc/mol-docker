export type DecisionMatriculaFirma = 'esperar' | 'avanzar' | 'mostrar-error'

export function decisionMatriculaFirma(estado: {
  ready: boolean
  matriculaActualizada?: boolean
  errorMatricula?: string | null
}): DecisionMatriculaFirma {
  if (!estado.ready) return 'esperar'
  if (estado.matriculaActualizada === true) return 'avanzar'
  // ensure/TuFirma puede devolver ready sin haber corrido el cierre MOL aún.
  if (estado.matriculaActualizada === undefined) return 'esperar'
  return 'mostrar-error'
}
