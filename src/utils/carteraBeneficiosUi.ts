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

export type CatalogoBeneficioAplica = {
  codigo_beneficio: string
  flujo: string
  aplica: boolean
}

export type BeneficioDetalleMonto = {
  cod_beneficio: string | null
  monto: number | null
  monto_aprobado?: number | null
}

export type BeneficioExcelUiItem = {
  slot: 1 | 2
  descripcion: string
  cod_beneficio: string | null
  pct: number | null
  sinMapear: boolean
  /** null si el código no está en el catálogo del periodo. */
  aplica: boolean | null
  flujo: string | null
}

export type FlagsConsolidado = {
  cae: boolean
  ministerial: boolean
  subdere: boolean
}

function catalogoDe(
  cod: string | null,
  catalogo: CatalogoBeneficioAplica[],
): CatalogoBeneficioAplica | null {
  if (!cod) return null
  return catalogo.find((c) => c.codigo_beneficio.trim() === cod) ?? null
}

function itemDesdeSlot(
  slot: 1 | 2,
  descripcion: string | null,
  pct: number | null,
  codBeneficio: string | null,
  catalogo: CatalogoBeneficioAplica[],
): BeneficioExcelUiItem | null {
  if (esSinBeca(descripcion)) return null
  const texto = (descripcion ?? '').trim()
  const cod = codBeneficio?.trim() || null
  const cat = catalogoDe(cod, catalogo)
  return {
    slot,
    descripcion: texto,
    cod_beneficio: cod,
    pct,
    sinMapear: !cod,
    aplica: cat ? cat.aplica : null,
    flujo: cat?.flujo ?? null,
  }
}

export function itemsBeneficioDesdeCartera(
  row: CarteraBeneficioRow | null,
  catalogo: CatalogoBeneficioAplica[] = [],
): BeneficioExcelUiItem[] {
  if (!row) return []
  const items: BeneficioExcelUiItem[] = []
  const slot1 = itemDesdeSlot(1, row.beca_1, row.pct_1, row.cod_beneficio_1, catalogo)
  if (slot1) items.push(slot1)
  const slot2 = itemDesdeSlot(2, row.beca_2, row.pct_2, row.cod_beneficio_2, catalogo)
  if (slot2) items.push(slot2)
  return items
}

/** El catálogo 2027-01 manda: un código con aplica=false no entra al cálculo aunque U+ lo tenga vigente. */
export function beneficioSeleccionable(item: BeneficioExcelUiItem): boolean {
  return !item.sinMapear && item.aplica !== false
}

export function etiquetaNoAplica(flujo: string | null): string {
  if (flujo === 'NO_VIGENTE') return 'No vigente'
  if (flujo === 'EN_REVISION') return 'En revisión'
  if (flujo === 'NO_RENOVABLE') return 'No renovable'
  return 'No aplica'
}

export function montoUplusTrasCatalogo(
  montoUplus: number,
  detalle: BeneficioDetalleMonto[],
  catalogo: CatalogoBeneficioAplica[],
): number {
  const caidos = new Set(
    catalogo.filter((c) => c.aplica === false).map((c) => c.codigo_beneficio.trim()),
  )
  if (caidos.size === 0) return Math.max(0, montoUplus)
  let resta = 0
  for (const b of detalle) {
    const cod = (b.cod_beneficio ?? '').trim()
    if (!caidos.has(cod)) continue
    const raw = b.monto ?? b.monto_aprobado ?? 0
    const n = Number(raw)
    if (Number.isFinite(n)) resta += n
  }
  return Math.max(0, montoUplus - resta)
}

/** Monto a descontar del arancel por un beneficio seleccionable (detalle ERP o % del bruto). */
export function montoDescuentoBeneficio(input: {
  item: BeneficioExcelUiItem
  detalle: BeneficioDetalleMonto[]
  arancelBruto: number
}): number {
  if (!beneficioSeleccionable(input.item)) return 0
  const cod = (input.item.cod_beneficio ?? '').trim()
  const det = input.detalle.find((d) => (d.cod_beneficio ?? '').trim() === cod)
  if (det) {
    const raw = Number(det.monto ?? det.monto_aprobado ?? Number.NaN)
    if (Number.isFinite(raw) && raw > 0) return Math.round(raw)
  }
  if (input.item.pct != null && input.arancelBruto > 0) {
    return Math.round((input.arancelBruto * input.item.pct) / 100)
  }
  return 0
}

export type LineaDescuentoBeneficio = {
  slot: 1 | 2
  descripcion: string
  monto: number
}

/** Solo los beneficios marcados. El total no supera el arancel bruto. */
export function lineasDescuentoSeleccion(input: {
  items: BeneficioExcelUiItem[]
  seleccionados: Record<number, boolean>
  detalle: BeneficioDetalleMonto[]
  arancelBruto: number
}): LineaDescuentoBeneficio[] {
  const bruto = Math.max(0, input.arancelBruto)
  let restante = bruto
  const lineas: LineaDescuentoBeneficio[] = []
  for (const item of input.items) {
    if (!beneficioSeleccionable(item) || input.seleccionados[item.slot] !== true) continue
    const pedido = montoDescuentoBeneficio({
      item,
      detalle: input.detalle,
      arancelBruto: bruto,
    })
    const monto = Math.min(pedido, restante)
    restante -= monto
    lineas.push({
      slot: item.slot,
      descripcion: item.descripcion || 'Beneficio',
      monto,
    })
  }
  return lineas
}

/** Sí solo si queda un código que el catálogo no marcó como no aplicable. */
export function tieneBeneficioAplicable(
  detalle: BeneficioDetalleMonto[],
  catalogo: CatalogoBeneficioAplica[],
): boolean {
  const caidos = new Set(
    catalogo.filter((c) => c.aplica === false).map((c) => c.codigo_beneficio.trim()),
  )
  return detalle.some((b) => {
    const cod = (b.cod_beneficio ?? '').trim()
    return cod.length > 0 && !caidos.has(cod)
  })
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
