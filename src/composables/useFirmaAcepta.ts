import { ref } from 'vue'

import { admisionApiBaseUrl } from '@/constants/admisionApi'

export interface FirmaAceptaRow {
  ano_mat: number
  periodo_mat: number
  codcli: string
  estado_traspaso_umas: string | null
  descripcion_estado_solicitud: string | null
  rut: string | null
  paterno: string | null
  materno: string | null
  nombre: string | null
  contrato_id_documento_acepta: string | null
  contrato_fecha_envio_acepta: string | null
  contrato_fecha_recepcion_acepta: string | null
  usuario_recepcion_contrato: string | null
  contrato_ruta_documento_firmado: string | null
  mandato_id_documento_acepta: string | null
  mandato_fecha_envio_acepta: string | null
  mandato_fecha_recepcion_acepta: string | null
  usuario_recepcion_mandato: string | null
  mandato_ruta_documento_firmado: string | null
  pendiente_contrato: number | null
  pendiente_mandato: number | null
  firma_faltante: string | null
  tipo_programa: string | null
  cod_facultad: string | null
  facultad: string | null
  nombre_jornada: string | null
  mail: string | null
  mail_inst: string | null
  apod_nombre: string | null
  apod_paterno: string | null
  apod_materno: string | null
  apod_mail: string | null
  apod_celular: string | null
  sync_timestamp: string | null
}

export interface FirmaAceptaResponse {
  data: FirmaAceptaRow[]
  total: number
  lastSync: string | null
}

function mapFirmaRow(row: Record<string, unknown>): FirmaAceptaRow {
  return {
    ano_mat: Number(row.ano_mat),
    periodo_mat: Number(row.periodo_mat),
    codcli: String(row.codcli ?? ''),
    estado_traspaso_umas: (row.estado_traspaso_umas as string) ?? null,
    descripcion_estado_solicitud: (row.descripcion_estado_solicitud as string) ?? null,
    rut: (row.rut as string) ?? null,
    paterno: (row.paterno as string) ?? null,
    materno: (row.materno as string) ?? null,
    nombre: (row.nombre as string) ?? null,
    contrato_id_documento_acepta: (row.contrato_id_documento_acepta as string) ?? null,
    contrato_fecha_envio_acepta: row.contrato_fecha_envio_acepta
      ? new Date(row.contrato_fecha_envio_acepta as string).toISOString()
      : null,
    contrato_fecha_recepcion_acepta: row.contrato_fecha_recepcion_acepta
      ? new Date(row.contrato_fecha_recepcion_acepta as string).toISOString()
      : null,
    usuario_recepcion_contrato: (row.usuario_recepcion_contrato as string) ?? null,
    contrato_ruta_documento_firmado: (row.contrato_ruta_documento_firmado as string) ?? null,
    mandato_id_documento_acepta: (row.mandato_id_documento_acepta as string) ?? null,
    mandato_fecha_envio_acepta: row.mandato_fecha_envio_acepta
      ? new Date(row.mandato_fecha_envio_acepta as string).toISOString()
      : null,
    mandato_fecha_recepcion_acepta: row.mandato_fecha_recepcion_acepta
      ? new Date(row.mandato_fecha_recepcion_acepta as string).toISOString()
      : null,
    usuario_recepcion_mandato: (row.usuario_recepcion_mandato as string) ?? null,
    mandato_ruta_documento_firmado: (row.mandato_ruta_documento_firmado as string) ?? null,
    pendiente_contrato: row.pendiente_contrato != null ? Number(row.pendiente_contrato) : null,
    pendiente_mandato: row.pendiente_mandato != null ? Number(row.pendiente_mandato) : null,
    firma_faltante: (row.firma_faltante as string) ?? null,
    tipo_programa: (row.tipo_programa as string) ?? null,
    cod_facultad: (row.cod_facultad as string) ?? null,
    facultad: (row.facultad as string) ?? null,
    nombre_jornada: (row.nombre_jornada as string) ?? null,
    mail: (row.mail as string) ?? null,
    mail_inst: (row.mail_inst as string) ?? null,
    apod_nombre: (row.apod_nombre as string) ?? null,
    apod_paterno: (row.apod_paterno as string) ?? null,
    apod_materno: (row.apod_materno as string) ?? null,
    apod_mail: (row.apod_mail as string) ?? null,
    apod_celular: (row.apod_celular as string) ?? null,
    sync_timestamp: row.sync_timestamp ? new Date(row.sync_timestamp as string).toISOString() : null,
  }
}

export function useFirmaAcepta() {
  const loading = ref(false)
  const syncing = ref(false)
  const hasNewData = ref(false)
  const data = ref<FirmaAceptaRow[]>([])
  const total = ref(0)
  const lastSync = ref<string | null>(null)
  const error = ref<Error | null>(null)

  async function fetchFirmaAcepta(): Promise<FirmaAceptaResponse | null> {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${admisionApiBaseUrl()}/api/firma-acepta`)
      const json = (await response.json()) as {
        data?: unknown[]
        total?: number
        lastSync?: string | null
        error?: string
        message?: string
      }

      if (!response.ok) {
        throw new Error(json.message || json.error || `Error ${response.status}`)
      }

      const rows = json.data ?? []
      const mapped = rows.map((r) => mapFirmaRow(r as Record<string, unknown>))
      const last = json.lastSync ?? null

      data.value = mapped
      total.value = json.total ?? mapped.length
      lastSync.value = last
      hasNewData.value = false

      return { data: mapped, total: json.total ?? mapped.length, lastSync: last }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Error al obtener estado firma contrato')
      console.error('Error al obtener firma-acepta:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function syncFirmaAceptaBackground(): Promise<{
    ok: boolean
    inserted?: number
    updated?: number
    errors?: number
  }> {
    syncing.value = true
    error.value = null
    try {
      const response = await fetch(`${admisionApiBaseUrl()}/api/firma-acepta/sync`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      const json = await response.json()
      hasNewData.value = true
      return { ok: true, inserted: json.inserted, updated: json.updated, errors: json.errors }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Error al sincronizar firma contrato')
      console.error('Error al sincronizar firma-acepta:', e)
      return { ok: false }
    } finally {
      syncing.value = false
    }
  }

  async function syncFirmaAcepta(): Promise<{ ok: boolean; inserted?: number; errors?: number }> {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(`${admisionApiBaseUrl()}/api/firma-acepta/sync`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      const json = await response.json()
      await fetchFirmaAcepta()
      return { ok: true, inserted: json.inserted, errors: json.errors }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Error al sincronizar firma contrato')
      console.error('Error al sincronizar firma-acepta:', e)
      return { ok: false }
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    total,
    lastSync,
    loading,
    syncing,
    hasNewData,
    error,
    fetchFirmaAcepta,
    syncFirmaAcepta,
    syncFirmaAceptaBackground,
  }
}
