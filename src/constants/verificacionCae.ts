import type { PlanPagosMvRow } from '@/types/supabase'

export type VerificacionCaeResultado = 'continua' | 'pendiente_resolucion'

export function tieneCae(plan: PlanPagosMvRow | null | undefined): boolean {
  const raw = (plan?.alumno_cae ?? '').trim().toLowerCase()
  return raw === 'si' || raw === 'sí'
}

export const VERIFICACION_CAE_UI = {
  cardTitulo: 'Verificación CAE',
  cardDescripcion: 'Validamos que exista resolución CAE para el periodo activo antes de continuar.',
  badgeEnEspera: 'En espera',
  badgeVerificando: 'Verificando…',
  badgeCaeActivo: 'CAE activo',
  verificandoDescripcion: 'Estamos validando si existe resolución CAE para el periodo activo.',
  pendienteTitulo: 'Rematrícula en espera',
  pendienteMensaje:
    'Detectamos que tienes CAE activo, pero aún no está disponible la resolución para este periodo. Tu registro de rematrícula quedará guardado en espera. Te avisaremos cuando puedas continuar.',
  pendienteAclaracion: 'Esto no significa que tu rematrícula fue rechazada.',
  pasosTitulo: '¿Qué ocurre ahora?',
  pasos: [
    'Tu avance queda pausado en este paso.',
    'El equipo cargará la resolución CAE del periodo.',
    'Cuando esté lista, usa Reintentar verificación para continuar.',
  ] as const,
  contextoPeriodo: 'Periodo',
  contextoAlumno: 'Alumno',
  contextoCodcli: 'codcli',
  reintentar: 'Reintentar verificación',
  volver: 'Volver a datos personales',
  reintentando: 'Verificando…',
  ayudaBotones: 'Si acabas de recibir confirmación de tu resolución CAE, pulsa reintentar.',
} as const
