import * as XLSX from 'xlsx'

import {
  CONVENIO_ESTADOS,
  CONVENIO_OFERTAS,
  type ConvenioEstado,
  type ConvenioOfertaCodigo,
} from '@/constants/convenioInstitucional'
import {
  defaultDescuentos,
  type ConvenioDescuentoInput,
  type ConvenioPeriodoInput,
  type ConvenioUpsertInput,
} from '@/services/convenioInstitucional'

export type ParseConveniosResult = {
  rows: ConvenioUpsertInput[]
  errors: string[]
}

function cellStr(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function normalizeEstado(raw: string): ConvenioEstado {
  const u = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '_')
  if (u === 'EN_TRAMITE' || u === 'ENTRAMITE') return 'EN_TRAMITE'
  if (u === 'NO_VIGENTE' || u === 'NOVIGENTE') return 'NO_VIGENTE'
  if (u === 'VIGENTE') return 'VIGENTE'
  if ((CONVENIO_ESTADOS as readonly string[]).includes(u)) return u as ConvenioEstado
  return 'VIGENTE'
}

function normalizeCodigoBeneficio(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const upper = s.toUpperCase()
  if (upper === 'PENDIENTE' || upper === 'EN TRAMITE' || upper === 'EN_TRAMITE') return null
  return s
}

function parsePorcentajeCell(raw: unknown): { aplica: boolean; porcentaje: number | null } {
  if (raw == null || raw === '') return { aplica: false, porcentaje: null }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const porcentaje = raw > 1 ? raw / 100 : raw
    if (porcentaje < 0 || porcentaje > 1) return { aplica: false, porcentaje: null }
    return { aplica: true, porcentaje }
  }
  const s = String(raw).trim()
  if (!s) return { aplica: false, porcentaje: null }
  const lower = s.toLowerCase()
  if (lower === 'no aplica' || lower === 'n/a' || lower === '-') {
    return { aplica: false, porcentaje: null }
  }
  // Excel a veces exporta "30%" cuando raw=false
  const pctMatch = s.match(/^(-?\d+(?:[.,]\d+)?)\s*%$/)
  if (pctMatch) {
    const n = Number(pctMatch[1].replace(',', '.'))
    if (!Number.isFinite(n)) return { aplica: false, porcentaje: null }
    const porcentaje = n / 100
    if (porcentaje < 0 || porcentaje > 1) return { aplica: false, porcentaje: null }
    return { aplica: true, porcentaje }
  }
  const n = Number(String(s).replace(',', '.'))
  if (!Number.isFinite(n)) return { aplica: false, porcentaje: null }
  const porcentaje = n > 1 ? n / 100 : n
  if (porcentaje < 0 || porcentaje > 1) return { aplica: false, porcentaje: null }
  return { aplica: true, porcentaje }
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const norm = (h: string) =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
  const normalizedHeaders = headers.map(norm)
  for (const c of candidates) {
    const nc = norm(c)
    const idx = normalizedHeaders.findIndex((h) => h === nc || h.includes(nc))
    if (idx >= 0) return idx
  }
  return -1
}

function descuentosFromRow(
  headers: string[],
  values: unknown[],
): ConvenioDescuentoInput[] {
  const base = defaultDescuentos()
  const byCodigo = new Map<ConvenioOfertaCodigo, ConvenioDescuentoInput>()
  for (const d of base) byCodigo.set(d.oferta_codigo, d)

  for (const oferta of CONVENIO_OFERTAS) {
    const idx = findHeaderIndex(headers, [oferta.excelHeader, oferta.label, oferta.codigo])
    if (idx < 0) continue
    const parsed = parsePorcentajeCell(values[idx])
    byCodigo.set(oferta.codigo, {
      oferta_codigo: oferta.codigo,
      aplica: parsed.aplica,
      porcentaje: parsed.porcentaje,
    })
  }

  return CONVENIO_OFERTAS.map((o) => byCodigo.get(o.codigo)!)
}

/**
 * Parsea un ArrayBuffer de .xlsx/.xls/.csv a filas de upsert.
 * Los periodos destino se inyectan aparte (no se toman del Excel como fuente de verdad).
 */
export function parseConveniosExcel(
  buffer: ArrayBuffer,
  periodosDestino: ConvenioPeriodoInput[],
): ParseConveniosResult {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { rows: [], errors: ['El archivo no tiene hojas'] }

  const sheet = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][]

  if (matrix.length < 2) {
    return { rows: [], errors: ['El archivo no tiene filas de datos'] }
  }

  const headers = (matrix[0] ?? []).map((h) => cellStr(h))
  const idxInstitucion = findHeaderIndex(headers, ['Institución', 'Institucion', 'institucion'])
  const idxCodBen = findHeaderIndex(headers, ['CodBen', 'Cod Ben', 'codigo_beneficio', 'Código'])
  const idxBenef = findHeaderIndex(headers, ['Beneficiarios'])
  const idxEstado = findHeaderIndex(headers, ['Estado'])
  const idxObs1 = findHeaderIndex(headers, ['OBS 1', 'Obs 1', 'Observacion 1', 'Observación 1'])
  const idxObs2 = findHeaderIndex(headers, ['OBS 2', 'Obs 2', 'Observacion 2', 'Observación 2'])

  if (idxInstitucion < 0) {
    return { rows: [], errors: ['No se encontró la columna Institución'] }
  }

  const rows: ConvenioUpsertInput[] = []
  const errors: string[] = []

  for (let i = 1; i < matrix.length; i++) {
    const values = matrix[i] ?? []
    const institucion = cellStr(values[idxInstitucion])
    if (!institucion) continue

    try {
      rows.push({
        codigo_beneficio:
          idxCodBen >= 0 ? normalizeCodigoBeneficio(cellStr(values[idxCodBen])) : null,
        institucion,
        beneficiarios: idxBenef >= 0 ? cellStr(values[idxBenef]) || null : null,
        estado: idxEstado >= 0 ? normalizeEstado(cellStr(values[idxEstado])) : 'VIGENTE',
        obs_1: idxObs1 >= 0 ? cellStr(values[idxObs1]) || null : null,
        obs_2: idxObs2 >= 0 ? cellStr(values[idxObs2]) || null : null,
        concepto: 'ARANCEL',
        activo: true,
        descuentos: descuentosFromRow(headers, values),
        periodos: periodosDestino.map((p) => ({ ...p, activo: true })),
      })
    } catch (e) {
      errors.push(`Fila ${i + 1}: ${e instanceof Error ? e.message : 'error de parseo'}`)
    }
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('No se encontraron filas válidas con institución')
  }

  return { rows, errors }
}
