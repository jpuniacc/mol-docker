export type EtapaProgresoBd =
  | 'sin_ingreso'
  | 'ingreso'
  | 'tyc'
  | 'datos'
  | 'forma_pago'
  | 'firma'
  | 'matriculado'

export type ChipBandeja =
  | 'sin_ingreso'
  | 'ingreso'
  | 'tyc'
  | 'datos'
  | 'forma_pago'
  | 'contrato_pdte'
  | 'firmado_pdte_u'
  | 'matriculado'

/** Espejo API: chip 6 = TuFirma enviada !ready dentro de forma_pago. */
export function chipBandejaDesdeSenales(input: {
  etapaActual: EtapaProgresoBd
  tufirmaEnviadaPendiente: boolean
}): ChipBandeja {
  if (input.etapaActual === 'matriculado') return 'matriculado'
  if (input.etapaActual === 'firma') return 'firmado_pdte_u'
  if (input.etapaActual === 'forma_pago' && input.tufirmaEnviadaPendiente) {
    return 'contrato_pdte'
  }
  if (input.etapaActual === 'forma_pago') return 'forma_pago'
  return input.etapaActual
}

export const ETIQUETA_CHIP_BANDEJA: Record<ChipBandeja, string> = {
  sin_ingreso: 'Sin ingreso',
  ingreso: 'Ingresó (sin TyC)',
  tyc: 'TyC OK · datos faltantes',
  datos: 'Datos OK · sin forma de pago',
  forma_pago: 'Forma de pago',
  contrato_pdte: 'Contrato / firma pendiente',
  firmado_pdte_u: 'Firmado · pdte U+',
  matriculado: 'Matriculado U+',
}

export const ORDEN_CHIPS_BANDEJA: ChipBandeja[] = [
  'sin_ingreso',
  'ingreso',
  'tyc',
  'datos',
  'forma_pago',
  'contrato_pdte',
  'firmado_pdte_u',
  'matriculado',
]

export function particionChipsExclusiva(
  rows: Array<{ id: string; chip: ChipBandeja }>,
): { ok: boolean; interseccion56: string[]; interseccion67: string[] } {
  const c5 = new Set(rows.filter((r) => r.chip === 'forma_pago').map((r) => r.id))
  const c6 = new Set(rows.filter((r) => r.chip === 'contrato_pdte').map((r) => r.id))
  const c7 = new Set(rows.filter((r) => r.chip === 'firmado_pdte_u').map((r) => r.id))
  const interseccion56 = [...c5].filter((id) => c6.has(id))
  const interseccion67 = [...c6].filter((id) => c7.has(id))
  return {
    ok: interseccion56.length === 0 && interseccion67.length === 0,
    interseccion56,
    interseccion67,
  }
}
