import JSZip from 'jszip'

import {
  crearFormDesdeRow,
  calcularDesdeForm,
  fetchSimulacionesPorCodcli,
  fetchSimulacionDetalle,
  fetchSimuladorCatalogos,
} from '@/services/simuladorPlanPago'
import type { PlanPagosMvRow } from '@/types/supabase'
import type {
  SimulacionPlanPagoRow,
  SimuladorCatalogos,
} from '@/types/simuladorPlanPago'
import {
  buildPlanPagoPdfData,
  buildPlanPagoPdfDataFromSaved,
  downloadBlob,
  downloadPdfBytes,
  filenamePlanPago,
  generatePlanPagoMultiPdf,
  generatePlanPagoPdf,
  openPdfBytes,
  type PlanPagoPdfData,
} from '@/utils/planPagoPdf'

const CHUNK_SIZE = 25
const WARN_THRESHOLD = 500

export type BatchProgress = {
  current: number
  total: number
  codcli?: string
}

async function yieldToUi(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0))
}

async function fetchUltimasSimulacionesPorCodclis(
  codclis: string[],
): Promise<Map<string, SimulacionPlanPagoRow>> {
  const map = new Map<string, SimulacionPlanPagoRow>()
  const unique = [...new Set(codclis.filter(Boolean))]
  for (const codcli of unique) {
    const { data } = await fetchSimulacionesPorCodcli(codcli)
    if (data[0]) map.set(codcli, data[0])
  }
  return map
}

export async function resolvePdfDataForRow(
  row: PlanPagosMvRow,
  catalogos: SimuladorCatalogos,
  ultimaSim?: SimulacionPlanPagoRow | null,
): Promise<PlanPagoPdfData | null> {
  if (ultimaSim) {
    const { data: detalle } = await fetchSimulacionDetalle(ultimaSim.id)
    const fromSaved = buildPlanPagoPdfDataFromSaved(ultimaSim, detalle, row)
    if (fromSaved) return fromSaved
  }

  const form = crearFormDesdeRow(row, catalogos)
  const resultado = calcularDesdeForm(row, form, catalogos)
  if (resultado.errores.length > 0 && !row.monto_matricula && !row.monto_arancel) {
    return null
  }

  return buildPlanPagoPdfData({
    row,
    resultado,
    form,
    modo: 'automatico',
  })
}

export async function buildPdfDataBatch(
  rows: PlanPagosMvRow[],
  onProgress?: (p: BatchProgress) => void,
): Promise<{ data: PlanPagoPdfData[]; warnings: string[] }> {
  const warnings: string[] = []
  if (rows.length > WARN_THRESHOLD) {
    warnings.push(
      `Se generarán ${rows.length} PDFs. Puede tardar varios minutos.`,
    )
  }

  const { data: catalogos, error } = await fetchSimuladorCatalogos()
  if (error || !catalogos) {
    return { data: [], warnings: [`Error catálogos: ${error}`] }
  }

  const codclis = rows.map((r) => r.codcli ?? '').filter(Boolean)
  const simMap = await fetchUltimasSimulacionesPorCodclis(codclis)

  const out: PlanPagoPdfData[] = []
  const total = rows.length

  let processed = 0
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    for (const row of chunk) {
      processed += 1
      const codcli = row.codcli ?? ''
      onProgress?.({ current: processed, total, codcli })
      const pdfData = await resolvePdfDataForRow(
        row,
        catalogos,
        codcli ? simMap.get(codcli) : null,
      )
      if (pdfData) out.push(pdfData)
      await yieldToUi()
    }
  }

  onProgress?.({ current: total, total })
  return { data: out, warnings }
}

export async function downloadAlumnoPdfBorrador(params: {
  row: PlanPagosMvRow
  resultado: import('@/types/simuladorPlanPago').SimuladorResultado
  form: import('@/types/simuladorPlanPago').SimuladorFormState
  createdBy?: string | null
}): Promise<{ error: string | null }> {
  const data = buildPlanPagoPdfData({
    row: params.row,
    resultado: params.resultado,
    form: params.form,
    modo: 'borrador',
    createdBy: params.createdBy,
  })
  const bytes = generatePlanPagoPdf(data)
  downloadPdfBytes(bytes, filenamePlanPago(data))
  return { error: null }
}

export async function previewAlumnoPdfBorrador(params: {
  row: PlanPagosMvRow
  resultado: import('@/types/simuladorPlanPago').SimuladorResultado
  form: import('@/types/simuladorPlanPago').SimuladorFormState
  createdBy?: string | null
}): Promise<{ error: string | null }> {
  const data = buildPlanPagoPdfData({
    row: params.row,
    resultado: params.resultado,
    form: params.form,
    modo: 'borrador',
    createdBy: params.createdBy,
  })
  const bytes = generatePlanPagoPdf(data)
  const opened = openPdfBytes(bytes)
  return {
    error: opened
      ? null
      : 'El navegador bloqueó la ventana emergente del PDF.',
  }
}

export async function downloadAlumnoPdfOficial(
  sim: SimulacionPlanPagoRow,
  row?: PlanPagosMvRow | null,
): Promise<{ error: string | null }> {
  const { data: detalle, error } = await fetchSimulacionDetalle(sim.id)
  if (error) return { error }
  const data = buildPlanPagoPdfDataFromSaved(sim, detalle, row)
  if (!data) return { error: 'Simulación sin detalle de matrícula/arancel' }
  const bytes = generatePlanPagoPdf(data)
  downloadPdfBytes(bytes, filenamePlanPago(data))
  return { error: null }
}

export async function downloadMultiPlanPagosPdf(
  rows: PlanPagosMvRow[],
  onProgress?: (p: BatchProgress) => void,
): Promise<{ error: string | null; warnings: string[] }> {
  const { data, warnings } = await buildPdfDataBatch(rows, onProgress)
  if (data.length === 0) {
    return { error: 'No hay datos para generar PDF', warnings }
  }
  const bytes = generatePlanPagoMultiPdf(data)
  const stamp = new Date().toISOString().slice(0, 10)
  downloadPdfBytes(bytes, `planes_pago_${stamp}_${data.length}.pdf`)
  return { error: null, warnings }
}

export async function downloadZipPlanPagos(
  rows: PlanPagosMvRow[],
  onProgress?: (p: BatchProgress) => void,
): Promise<{ error: string | null; warnings: string[] }> {
  const { data, warnings } = await buildPdfDataBatch(rows, onProgress)
  if (data.length === 0) {
    return { error: 'No hay datos para generar ZIP', warnings }
  }

  const zip = new JSZip()
  const used = new Set<string>()

  for (const item of data) {
    let name = filenamePlanPago(item)
    if (used.has(name)) {
      name = name.replace('.pdf', `_${item.codcli.slice(-6)}.pdf`)
    }
    used.add(name)
    zip.file(name, generatePlanPagoPdf(item))
  }

  onProgress?.({ current: data.length, total: data.length })
  const blob = await zip.generateAsync({ type: 'uint8array' })
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(
    blob,
    `planes_pago_${stamp}_${data.length}.zip`,
    'application/zip',
  )
  return { error: null, warnings }
}
