import { jsPDF } from 'jspdf'

import { fmtMontoClp } from '@/services/fetchPlanPagosMv'
import type { PlanPagosMvRow } from '@/types/supabase'
import type {
  SimulacionPlanPagoDetalleRow,
  SimulacionPlanPagoRow,
  SimuladorConceptoCalculo,
  SimuladorFormState,
  SimuladorResultado,
  SimuladorTotalesJson,
} from '@/types/simuladorPlanPago'

export type PlanPagoPdfModo = 'borrador' | 'oficial' | 'automatico'

export type PlanPagoPdfConceptoLinea = {
  concepto: string
  bruto: number
  beneficio_erp: number
  beca_estado: number
  convenio: number
  abono: number
  cae: number
  beneficio_adicional: number
  neto: number
  n_cuotas: number
  valor_cuota: number | null
  tipo_pago: string | null
}

export type PlanPagoPdfData = {
  modo: PlanPagoPdfModo
  nombre_alumno: string
  rut: string
  codcli: string
  carrera: string
  cod_carrera: string
  periodo: string
  validez_propuesta: string | null
  alumno_cae: string
  arancel_un_semestre: boolean
  matricula: PlanPagoPdfConceptoLinea
  arancel: PlanPagoPdfConceptoLinea
  totales: SimuladorTotalesJson
  emitido_en: string
  created_by: string | null
  simulacion_id: string | null
}

const ORANGE: [number, number, number] = [230, 120, 40]
const MARGIN = 14
const PAGE_W = 210
const LINE = 6

function fmt(n: number | null | undefined): string {
  return fmtMontoClp(n)
}

function nombreCompleto(row: PlanPagosMvRow): string {
  const p = [
    row.nombre_alumno,
    row.apellido_paterno_alumno,
    row.apellido_materno_alumno,
  ]
    .filter(Boolean)
    .join(' ')
  return p.trim() || row.nombre_alumno || '—'
}

function conceptoFromCalculo(c: SimuladorConceptoCalculo): PlanPagoPdfConceptoLinea {
  return {
    concepto: c.concepto === 'MATRICULA' ? 'Matrícula' : 'Arancel',
    bruto: c.bruto,
    beneficio_erp: c.beneficio_erp,
    beca_estado: c.beca_estado,
    convenio: c.convenio,
    abono: c.abono,
    cae: c.cae,
    beneficio_adicional: c.beneficio_adicional,
    neto: c.neto,
    n_cuotas: c.n_cuotas,
    valor_cuota: c.valor_cuota,
    tipo_pago: c.tipo_pago_nombre,
  }
}

function conceptoFromDetalle(d: SimulacionPlanPagoDetalleRow): PlanPagoPdfConceptoLinea {
  return {
    concepto: d.concepto === 'MATRICULA' ? 'Matrícula' : 'Arancel',
    bruto: Number(d.bruto),
    beneficio_erp: Number(d.beneficio_erp),
    beca_estado: Number(d.beca_estado),
    convenio: Number(d.convenio),
    abono: Number(d.abono),
    cae: Number(d.cae),
    beneficio_adicional: Number(d.beneficio_adicional),
    neto: Number(d.neto),
    n_cuotas: Number(d.n_cuotas),
    valor_cuota: d.valor_cuota != null ? Number(d.valor_cuota) : null,
    tipo_pago: d.tipo_pago_nombre,
  }
}

export function buildPlanPagoPdfData(params: {
  row: PlanPagosMvRow
  resultado: SimuladorResultado
  form?: SimuladorFormState | null
  modo: PlanPagoPdfModo
  createdBy?: string | null
  simulacionId?: string | null
}): PlanPagoPdfData {
  const { row, resultado, form, modo, createdBy, simulacionId } = params
  return {
    modo,
    nombre_alumno: nombreCompleto(row),
    rut: row.rut ?? '—',
    codcli: row.codcli ?? '—',
    carrera: row.nombre_carrera ?? row.carrera ?? '—',
    cod_carrera: row.cod_carrera ?? '—',
    periodo: row.periodo ?? '—',
    validez_propuesta: form?.validez_propuesta ?? null,
    alumno_cae: row.alumno_cae ?? 'No',
    arancel_un_semestre: form?.arancel_un_semestre ?? false,
    matricula: conceptoFromCalculo(resultado.matricula),
    arancel: conceptoFromCalculo(resultado.arancel),
    totales: resultado.totales,
    emitido_en: new Date().toLocaleString('es-CL'),
    created_by: createdBy ?? null,
    simulacion_id: simulacionId ?? null,
  }
}

export function buildPlanPagoPdfDataFromSaved(
  sim: SimulacionPlanPagoRow,
  detalle: SimulacionPlanPagoDetalleRow[],
  row?: PlanPagosMvRow | null,
): PlanPagoPdfData | null {
  const mat = detalle.find((d) => d.concepto === 'MATRICULA')
  const ara = detalle.find((d) => d.concepto === 'ARANCEL')
  if (!mat || !ara) return null

  const totales = (sim.totales_json ?? {}) as SimuladorTotalesJson
  return {
    modo: 'oficial',
    nombre_alumno: sim.nombre_alumno ?? row?.nombre_alumno ?? '—',
    rut: sim.rut ?? row?.rut ?? '—',
    codcli: sim.codcli,
    carrera: sim.nombre_carrera ?? row?.nombre_carrera ?? '—',
    cod_carrera: sim.cod_carrera ?? row?.cod_carrera ?? '—',
    periodo: sim.periodo_label ?? row?.periodo ?? '—',
    validez_propuesta: sim.validez_propuesta,
    alumno_cae: row?.alumno_cae ?? (sim.marca_cae ? 'Si' : 'No'),
    arancel_un_semestre: sim.arancel_un_semestre,
    matricula: conceptoFromDetalle(mat),
    arancel: conceptoFromDetalle(ara),
    totales: {
      total_beca_estado: totales.total_beca_estado ?? 0,
      total_beca_arancel_pct: totales.total_beca_arancel_pct ?? 0,
      monto_financiar_becas: totales.monto_financiar_becas ?? 0,
      monto_financiar_cae: totales.monto_financiar_cae ?? sim.monto_cae ?? 0,
      monto_arancel_financiar: totales.monto_arancel_financiar ?? ara.neto,
      monto_arancel_mas_matricula:
        totales.monto_arancel_mas_matricula ?? mat.neto + ara.neto,
      monto_neto_financiar:
        totales.monto_neto_financiar ?? sim.monto_neto_financiar ?? 0,
    },
    emitido_en: new Date(sim.created_at).toLocaleString('es-CL'),
    created_by: sim.created_by,
    simulacion_id: sim.id,
  }
}

export function filenamePlanPago(data: PlanPagoPdfData): string {
  const rut = (data.rut ?? 'sin-rut').replace(/\./g, '').replace(/-/g, '')
  const cod = (data.codcli ?? 'sin-codcli').replace(/[^\w-]+/g, '_')
  const modo =
    data.modo === 'oficial' ? 'oficial' : data.modo === 'borrador' ? 'borrador' : 'auto'
  return `plan_pago_${modo}_${cod}_${rut}.pdf`
}

function drawRow(
  doc: jsPDF,
  y: number,
  label: string,
  value: string,
  bold = false,
): number {
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text(label, MARGIN, y)
  doc.setTextColor(20, 20, 20)
  doc.text(value, PAGE_W - MARGIN, y, { align: 'right' })
  return y + LINE
}

function drawConceptoBlock(
  doc: jsPDF,
  y: number,
  linea: PlanPagoPdfConceptoLinea,
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.text(linea.concepto, MARGIN, y)
  y += LINE + 1
  y = drawRow(doc, y, 'Valor bruto', fmt(linea.bruto))
  y = drawRow(doc, y, 'Beneficio ERP', `− ${fmt(linea.beneficio_erp)}`)
  if (linea.beca_estado > 0)
    y = drawRow(doc, y, 'Beca estado', `− ${fmt(linea.beca_estado)}`)
  if (linea.convenio > 0)
    y = drawRow(doc, y, 'Convenio', `− ${fmt(linea.convenio)}`)
  if (linea.abono > 0) y = drawRow(doc, y, 'Abonos', `− ${fmt(linea.abono)}`)
  if (linea.cae > 0) y = drawRow(doc, y, 'CAE', `− ${fmt(linea.cae)}`)
  if (linea.beneficio_adicional > 0)
    y = drawRow(doc, y, 'Beneficio adicional', `− ${fmt(linea.beneficio_adicional)}`)
  y = drawRow(doc, y, 'Cuotas', String(linea.n_cuotas))
  y = drawRow(doc, y, 'Valor cuota', fmt(linea.valor_cuota))
  if (linea.tipo_pago) y = drawRow(doc, y, 'Tipo de pago', linea.tipo_pago)
  y = drawRow(doc, y, 'Neto', fmt(linea.neto), true)
  return y + 4
}

function renderPlanPagoPage(doc: jsPDF, data: PlanPagoPdfData, pageIndex = 0): void {
  if (pageIndex > 0) doc.addPage()

  let y = MARGIN

  doc.setFillColor(...ORANGE)
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('UNIACC — Plan de Pago', MARGIN, 14)

  if (data.modo === 'borrador') {
    doc.setFontSize(9)
    doc.text('BORRADOR', PAGE_W - MARGIN, 14, { align: 'right' })
  } else if (data.modo === 'oficial') {
    doc.setFontSize(9)
    doc.text('OFICIAL', PAGE_W - MARGIN, 14, { align: 'right' })
  }

  y = 30
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 20, 20)
  doc.text(data.nombre_alumno.toUpperCase(), MARGIN, y)
  y += LINE + 2

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  y = drawRow(doc, y, 'RUT', data.rut)
  y = drawRow(doc, y, 'Cod. cliente', data.codcli)
  y = drawRow(doc, y, 'Carrera', data.carrera)
  y = drawRow(doc, y, 'Cod. carrera', data.cod_carrera)
  y = drawRow(doc, y, 'Período', data.periodo)
  y = drawRow(doc, y, 'CAE', data.alumno_cae)
  if (data.validez_propuesta)
    y = drawRow(doc, y, 'Validez propuesta', data.validez_propuesta)
  if (data.arancel_un_semestre)
    y = drawRow(doc, y, 'Arancel', 'Un semestre')
  y = drawRow(doc, y, 'Emitido', data.emitido_en)
  if (data.created_by) y = drawRow(doc, y, 'Usuario', data.created_by)

  y += 4
  doc.setDrawColor(220, 220, 220)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 8

  y = drawConceptoBlock(doc, y, data.matricula)
  y = drawConceptoBlock(doc, y, data.arancel)

  doc.setFillColor(245, 245, 245)
  doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, 14, 'F')
  y += 9
  y = drawRow(doc, y, 'Monto neto a financiar', fmt(data.totales.monto_neto_financiar), true)
  y = drawRow(doc, y, 'Monto a financiar con becas', fmt(data.totales.monto_financiar_becas))
  y = drawRow(doc, y, 'Monto a financiar con CAE', fmt(data.totales.monto_financiar_cae))

  if (data.simulacion_id) {
    y += 4
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(`ID simulación: ${data.simulacion_id}`, MARGIN, y)
  }
}

export function generatePlanPagoPdf(data: PlanPagoPdfData): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  renderPlanPagoPage(doc, data, 0)
  const buf = doc.output('arraybuffer')
  return new Uint8Array(buf)
}

export function generatePlanPagoMultiPdf(items: PlanPagoPdfData[]): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  items.forEach((item, i) => renderPlanPagoPage(doc, item, i))
  return new Uint8Array(doc.output('arraybuffer'))
}

export function downloadBlob(
  bytes: Uint8Array,
  filename: string,
  mime = 'application/pdf',
): void {
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  downloadBlob(bytes, filename, 'application/pdf')
}

export function openPdfBytes(bytes: Uint8Array): boolean {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer')

  if (!win) {
    URL.revokeObjectURL(url)
    return false
  }

  // Give the browser PDF viewer time to read the object URL before cleanup.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}
