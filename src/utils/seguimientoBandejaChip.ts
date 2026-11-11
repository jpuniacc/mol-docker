export type EtapaProgresoBd =
  | 'sin_ingreso'
  | 'ingreso'
  | 'tyc'
  | 'datos'
  | 'forma_pago'
  | 'firma'
  | 'matriculado'
  | 'matriculado_bo'
  | 'conflicto_mol_bo'

export type ChipBandeja =
  | 'sin_ingreso'
  | 'ingreso'
  | 'tyc'
  | 'datos'
  | 'forma_pago'
  | 'contrato_pdte'
  | 'firmado_pdte_u'
  | 'matriculado'
  | 'matriculado_bo'
  | 'conflicto_mol_bo'

/** Espejo API: chip 6 = TuFirma enviada !ready dentro de forma_pago. */
export function chipBandejaDesdeSenales(input: {
  etapaActual: EtapaProgresoBd
  tufirmaEnviadaPendiente: boolean
}): ChipBandeja {
  if (input.etapaActual === 'matriculado') return 'matriculado'
  if (input.etapaActual === 'matriculado_bo') return 'matriculado_bo'
  if (input.etapaActual === 'conflicto_mol_bo') return 'conflicto_mol_bo'
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
  matriculado_bo: 'Matriculado por BackOffice',
  conflicto_mol_bo: 'Error: MOL y BackOffice',
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
  'matriculado_bo',
  'conflicto_mol_bo',
]

export function numeroChipBandeja(chip: ChipBandeja): number {
  const i = ORDEN_CHIPS_BANDEJA.indexOf(chip)
  return i >= 0 ? i + 1 : 0
}

const COLOR_ETAPA: Record<ChipBandeja, { bg: string; text: string; border: string }> = {
  sin_ingreso: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  ingreso: { bg: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-200' },
  tyc: { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
  datos: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' },
  forma_pago: { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200' },
  contrato_pdte: { bg: 'bg-orange-50', text: 'text-[#FF5B00]', border: 'border-orange-200' },
  firmado_pdte_u: { bg: 'bg-lime-50', text: 'text-lime-800', border: 'border-lime-200' },
  matriculado: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  matriculado_bo: { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200' },
  conflicto_mol_bo: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
}


export function colorEtapaChip(chip: ChipBandeja) {
  return COLOR_ETAPA[chip]
}

export function etiquetaSubetapaFormaPago(
  v: 'cae' | 'ministerial' | 'ambos' | 'resto' | null | undefined,
): string {
  if (v === 'cae') return 'CAE'
  if (v === 'ministerial') return 'Beneficio min.'
  if (v === 'ambos') return 'Ambos'
  if (v === 'resto') return 'Resto'
  return '—'
}

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
