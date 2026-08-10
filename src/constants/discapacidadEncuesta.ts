export const DISCAPACIDAD_TIPOS = [
  'Física',
  'Visual',
  'Auditiva',
  'Psíquica',
  'Autismo',
] as const

export type DiscapacidadTipo = (typeof DISCAPACIDAD_TIPOS)[number]

export const DISCAPACIDAD_AFIRMACIONES = [
  'Soy usuario de silla de ruedas o alguna ayuda técnica para desplazarme',
  'Soy usuario de lengua de señas',
  'Soy una persona ciega',
  'Ninguna de las anteriores',
] as const

export type DiscapacidadAfirmacion = (typeof DISCAPACIDAD_AFIRMACIONES)[number]

export const DISCAPACIDAD_ENCUESTA_UI = {
  alertTitle: 'Encuesta opcional de discapacidad',
  alertDescription:
    'Esta encuesta es voluntaria. Los datos que compartas son sensibles y se usarán exclusivamente para coordinar apoyos de inclusión en UNIACC. Omitirla no afecta tu matrícula.',
  cardTitle: 'Encuesta discapacidad',
  cardDescription: '¿Deseas contestar la encuesta?',
  badgeOpcional: 'Opcional',
  opcionContestar: 'Sí, deseo contestar',
  opcionContestarHint: 'Responderás dos preguntas independientes sobre tipo y situaciones funcionales.',
  opcionOmitir: 'No deseo informar',
  opcionOmitirHint: 'Puedes continuar sin registrar información de discapacidad.',
  confirmOmitirTitle: '¿Continuar sin informar?',
  confirmOmitirMessage:
    'Puedes omitir esta encuesta sin afectar tu matrícula. No se guardará tipo ni afirmaciones.',
  confirmOmitirCancel: 'Cancelar',
  confirmOmitirConfirm: 'Continuar sin informar',
  avisoIndependencia:
    'Son dos preguntas independientes. Puedes responder solo el tipo, solo las afirmaciones, o ambas. Lo que indiques en una no condiciona la otra.',
  pregunta1Titulo: '1. Tipo de discapacidad',
  pregunta1Badge: 'Obligatoria',
  pregunta1Subtitulo: 'Clasificación según SENADIS (TyC §4.4).',
  pregunta2Titulo: '2. Afirmaciones',
  pregunta2Badge: 'Opcional',
  pregunta2Subtitulo:
    'Indica si te identificas con alguna de estas situaciones. No está relacionado con el tipo que elegiste arriba.',
  ctaGuardar: 'Guardar y continuar',
  ctaGuardando: 'Guardando…',
  ctaAyuda: 'Solo necesitas completar el tipo para continuar. Las afirmaciones son voluntarias.',
} as const
