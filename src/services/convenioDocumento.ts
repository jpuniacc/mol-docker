import { contextoMolAuditoria, type ContextoMolAuditoriaOpciones } from '@/services/molAuditContext'
import { supabase } from '@/services/supabaseClient'

export const CONVENIO_DOC_BUCKET = 'convenio-documentos'
export const CONVENIO_DOC_MAX_BYTES = 10 * 1024 * 1024 // 10 MB
export const CONVENIO_DOC_MIMES = ['application/pdf', 'image/png', 'image/jpeg'] as const
export const CONVENIO_DOC_ACCEPT = '.pdf,.png,.jpg,.jpeg'

export type SubirDocumentoConvenioPayload = ContextoMolAuditoriaOpciones & {
  file: File
  convenioId?: string | null
  codigoBeneficio?: string | null
  codBeneficioAlumno?: string | null
  estadoConvenio?: string | null
}

export type SubirDocumentoConvenioResult = {
  id: string | null
  storagePath: string | null
  error: string | null
}

function sanitizarNombreArchivo(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
  return limpio.length > 0 ? limpio : 'documento'
}

/**
 * Sube el documento de vigencia del convenio a Storage (bucket privado) y
 * registra sus metadatos vía RPC `registrar_mnp_convenio_documento`.
 */
export async function subirDocumentoConvenio(
  payload: SubirDocumentoConvenioPayload,
): Promise<SubirDocumentoConvenioResult> {
  const { file, convenioId } = payload
  const folderId = sanitizarNombreArchivo(
    (convenioId && /^[0-9a-f-]{36}$/i.test(convenioId)
      ? convenioId
      : payload.codigoBeneficio) || 'certificado',
  )
  const convenioUuid =
    convenioId && /^[0-9a-f-]{36}$/i.test(convenioId) ? convenioId : null

  if (!file) {
    return { id: null, storagePath: null, error: 'No se seleccionó ningún archivo.' }
  }
  if (file.size > CONVENIO_DOC_MAX_BYTES) {
    return { id: null, storagePath: null, error: 'El archivo supera el máximo de 10 MB.' }
  }
  if (file.type && !CONVENIO_DOC_MIMES.includes(file.type as (typeof CONVENIO_DOC_MIMES)[number])) {
    return {
      id: null,
      storagePath: null,
      error: 'Formato no permitido. Usa PDF, PNG o JPG.',
    }
  }

  const ctx = contextoMolAuditoria(payload)
  const codcliSegmento = sanitizarNombreArchivo((ctx.codcli ?? 'sin-codcli').toString())
  const nombreArchivo = sanitizarNombreArchivo(file.name)
  const storagePath = `mock/${codcliSegmento}/${folderId}/${Date.now()}_${nombreArchivo}`

  const { error: uploadError } = await supabase.storage
    .from(CONVENIO_DOC_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  if (uploadError) {
    return { id: null, storagePath: null, error: uploadError.message }
  }

  const { data, error } = await supabase.rpc('registrar_mnp_convenio_documento', {
    p_storage_path: storagePath,
    p_convenio_id: convenioUuid,
    p_codigo_beneficio: payload.codigoBeneficio ?? null,
    p_cod_beneficio_alumno: payload.codBeneficioAlumno ?? null,
    p_estado_convenio: payload.estadoConvenio ?? null,
    p_nombre_archivo: file.name,
    p_mime: file.type || null,
    p_tamano_bytes: file.size,
    p_sesion_id: ctx.sesionId,
    p_rut_alumno: ctx.rutAlumno,
    p_codcli: ctx.codcli,
    p_nombre_alumno: ctx.nombreAlumno,
    p_anio_periodo: ctx.anioPeriodo,
    p_semestre_periodo: ctx.semestrePeriodo,
    p_periodo_label: ctx.periodoLabel,
    p_url_origen: ctx.urlOrigen,
    p_es_mock: ctx.esMock,
  })

  if (error) {
    return { id: null, storagePath, error: error.message }
  }

  return { id: (data as string) ?? null, storagePath, error: null }
}

export type EliminarDocumentoConvenioPayload = ContextoMolAuditoriaOpciones & {
  storagePath: string
}

export type EliminarDocumentoConvenioResult = {
  ok: boolean
  error: string | null
}

/**
 * Elimina el archivo del bucket privado y marca el metadato como eliminado
 * (soft delete + evento en timeline) vía RPC `eliminar_mnp_convenio_documento`.
 */
export async function eliminarDocumentoConvenio(
  payload: EliminarDocumentoConvenioPayload,
): Promise<EliminarDocumentoConvenioResult> {
  const storagePath = (payload.storagePath ?? '').trim()
  if (!storagePath) {
    return { ok: false, error: 'No hay documento para eliminar.' }
  }

  const { data: removed, error: removeError } = await supabase.storage
    .from(CONVENIO_DOC_BUCKET)
    .remove([storagePath])

  if (removeError) {
    return { ok: false, error: removeError.message }
  }

  // storage-api no arroja error si RLS impide ubicar/borrar el objeto: en ese
  // caso devuelve una lista vacía. Lo tratamos como fallo para no reportar un
  // éxito falso mientras el archivo sigue en el bucket.
  if (!removed || removed.length === 0) {
    return {
      ok: false,
      error: 'No se pudo eliminar el archivo del almacenamiento.',
    }
  }

  const ctx = contextoMolAuditoria(payload)
  const { error } = await supabase.rpc('eliminar_mnp_convenio_documento', {
    p_storage_path: storagePath,
    p_sesion_id: ctx.sesionId,
    p_rut_alumno: ctx.rutAlumno,
    p_codcli: ctx.codcli,
    p_nombre_alumno: ctx.nombreAlumno,
    p_anio_periodo: ctx.anioPeriodo,
    p_semestre_periodo: ctx.semestrePeriodo,
    p_periodo_label: ctx.periodoLabel,
    p_url_origen: ctx.urlOrigen,
    p_es_mock: ctx.esMock,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, error: null }
}
