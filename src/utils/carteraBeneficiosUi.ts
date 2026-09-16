import { esSinBeca } from './becaNombreMatch'

export type CarteraBeneficioRow = {
  periodo: string
  rut_norm: string
  codcli_excel: string
  beca_1: string | null
  pct_1: number | null
  beca_2: string | null
  pct_2: number | null
  consolidado: string | null
  cod_beneficio_1: string | null
  cod_beneficio_2: string | null
}

export type BeneficioExcelUiItem = {
  slot: 1 | 2
  descripcion: string
  cod_beneficio: string | null
  pct: number | null
  sinMapear: boolean
}

export type FlagsConsolidado = {
  cae: boolean
  ministerial: boolean
  subdere: boolean
}

function itemDesdeSlot(
  slot: 1 | 2,
  descripcion: string | null,
  pct: number | null,
  codBeneficio: string | null,
): BeneficioExcelUiItem | null {
  if (esSinBeca(descripcion)) return null
  const texto = (descripcion ?? '').trim()
  const cod = codBeneficio?.trim() || null
  return {
    slot,
    descripcion: texto,
    cod_beneficio: cod,
    pct,
    sinMapear: !cod,
  }
}

export function itemsBeneficioDesdeCartera(row: CarteraBeneficioRow | null): BeneficioExcelUiItem[] {
  if (!row) return []
  const items: BeneficioExcelUiItem[] = []
  const slot1 = itemDesdeSlot(1, row.beca_1, row.pct_1, row.cod_beneficio_1)
  if (slot1) items.push(slot1)
  const slot2 = itemDesdeSlot(2, row.beca_2, row.pct_2, row.cod_beneficio_2)
  if (slot2) items.push(slot2)
  return items
}

export function flagsConsolidado(consolidado: string | null): FlagsConsolidado {
  const text = (consolidado ?? '').trim().toUpperCase()
  if (!text) return { cae: false, ministerial: false, subdere: false }
  return {
    cae: text.includes('CAE'),
    ministerial: text.includes('MINISTERIAL'),
    subdere: text.includes('SUBDERE'),
  }
}
