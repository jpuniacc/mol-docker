export type DecisionMatriculaFirma = 'esperar' | 'avanzar' | 'mostrar-error'

export function decisionMatriculaFirma(estado: {
  ready: boolean
  matriculaActualizada?: boolean
  errorMatricula?: string | null
}): DecisionMatriculaFirma {
  if (!estado.ready) return 'esperar'
  if (estado.matriculaActualizada === true) return 'avanzar'
  return 'mostrar-error'
}
