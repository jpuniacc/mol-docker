import type { MnpCasoRematriculaEstado, MnpCasoRematriculaRow } from '@/types/supabase'

export type ConvenioGateRef = {
  id: string
  codigoBeneficio: string | null
}

export type DocLocalRef = {
  storagePath: string
  nombreArchivo: string
}

export type GateMatriculaConvenioResult = {
  puedePagarPorConvenio: boolean
  motivo: 'ok' | 'sin_documento' | 'en_revision' | 'rechazado' | 'sin_caso'
  mensaje: string | null
  motivoRechazo: string | null
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toUpperCase()
}

function payloadStr(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key]
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t || null
}

export function matchCasoConvenioCertificado(
  caso: MnpCasoRematriculaRow,
  convenio: ConvenioGateRef,
  storagePathDoc?: string | null,
): boolean {
  if (caso.tipo !== 'CONVENIO_CERTIFICADO') return false
  const payload = (caso.payload ?? {}) as Record<string, unknown>
  const convId = payloadStr(payload, 'convenio_id')
  if (convId && convId === convenio.id) return true
  const ref = (caso.ref_id ?? '').trim()
  const path = (storagePathDoc ?? '').trim()
  if (ref && path && ref === path) return true
  const cod = payloadStr(payload, 'codigo_beneficio')
  if (cod && norm(cod) === norm(convenio.codigoBeneficio)) return true
  return false
}

export function estadoCertificadoConvenio(
  casos: MnpCasoRematriculaRow[],
  convenio: ConvenioGateRef,
  storagePathDoc?: string | null,
): MnpCasoRematriculaEstado | null {
  const matches = casos.filter((c) =>
    matchCasoConvenioCertificado(c, convenio, storagePathDoc),
  )
  if (matches.length === 0) return null
  const sorted = [...matches].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  return sorted[0]!.estado
}

export function casoCertificadoConvenio(
  casos: MnpCasoRematriculaRow[],
  convenio: ConvenioGateRef,
  storagePathDoc?: string | null,
): MnpCasoRematriculaRow | null {
  const matches = casos.filter((c) =>
    matchCasoConvenioCertificado(c, convenio, storagePathDoc),
  )
  if (matches.length === 0) return null
  const sorted = [...matches].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  return sorted[0] ?? null
}

export function evaluarGateMatriculaConvenios(input: {
  vigentes: ConvenioGateRef[]
  casos: MnpCasoRematriculaRow[]
  docsByConvenioId: Record<string, DocLocalRef | undefined>
}): GateMatriculaConvenioResult {
  if (input.vigentes.length === 0) {
    return { puedePagarPorConvenio: true, motivo: 'ok', mensaje: null, motivoRechazo: null }
  }

  for (const v of input.vigentes) {
    const doc = input.docsByConvenioId[v.id]
    if (!doc) {
      return {
        puedePagarPorConvenio: false,
        motivo: 'sin_documento',
        mensaje: 'Sube el documento del convenio vigente para poder pagar.',
        motivoRechazo: null,
      }
    }
    const row = casoCertificadoConvenio(input.casos, v, doc.storagePath)
    if (!row) {
      return {
        puedePagarPorConvenio: false,
        motivo: 'sin_caso',
        mensaje:
          'No encontramos el caso de revisión del documento. Contacta a tu consejero o vuelve a subir el archivo.',
        motivoRechazo: null,
      }
    }
    if (row.estado === 'EN_REVISION' || row.estado === 'ABIERTO') {
      return {
        puedePagarPorConvenio: false,
        motivo: 'en_revision',
        mensaje: 'Documento en revisión por tu consejero. Podrás pagar cuando lo aprueben.',
        motivoRechazo: null,
      }
    }
    if (row.estado === 'RECHAZADO') {
      const motivo = (row.motivo ?? '').trim() || null
      return {
        puedePagarPorConvenio: false,
        motivo: 'rechazado',
        mensaje: motivo
          ? `${motivo}. Vuelve a subir el documento.`
          : 'El documento fue rechazado. Vuelve a subir el documento.',
        motivoRechazo: motivo,
      }
    }
    if (row.estado !== 'APROBADO') {
      return {
        puedePagarPorConvenio: false,
        motivo: 'en_revision',
        mensaje: 'Documento en revisión por tu consejero. Podrás pagar cuando lo aprueben.',
        motivoRechazo: null,
      }
    }
  }

  return { puedePagarPorConvenio: true, motivo: 'ok', mensaje: null, motivoRechazo: null }
}
