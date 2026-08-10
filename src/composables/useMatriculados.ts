import { ref } from 'vue'

import { admisionApiBaseUrl } from '@/constants/admisionApi'

function admisionUrl(path: string): string {
  const base = admisionApiBaseUrl().replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

export interface Matriculado {
  ano_mat: number
  periodo_mat: number
  codcli: string
  codcarpr: string
  ano_ingreso: number | null
  periodo_ingr: number | null
  mat_efectiva: string | null
  fec_mat: string | null
  hora_mat: string | null
  rut: string | null
  dig: string | null
  nombre: string | null
  apellido_pat: string | null
  apellido_mat: string | null
  carrera: string | null
  codpestud: string | null
  nivel: string | null
  jornada: string | null
  tipo_carr: string | null
  facultad: string | null
  estacad: string | null
  tipositu: string | null
  descripcion_situ: string | null
  tipo_alumno: 'NUEVO' | 'ANTIGUO' | null
  categoria: string | null
  lista_mat: number | null
  ben_matr: number | null
  copago_mat: number | null
  documento_mat: string | null
  lista_arancel: number | null
  ben_aran: number | null
  copago_ara: number | null
  documento_ara: string | null
  copago_total: number | null
  cae_monto: number | null
  estado_cae: 'VIGENTE' | 'CANCELADA' | 'MOROSO' | null
  beca_ministerial: string | null
  monto_beca_minesterial: number | null
  estado_beca_mine: 'VIGENTE' | 'CANCELADA' | 'MOROSO' | null
  deuda_morosa: number | null
  num_bol_fact: string | null
  num_contrato: string | null
  estado_firma: 'SI' | 'NO' | null
  fonoact: string | null
  celularact: string | null
  mail: string | null
  mail_inst: string | null
  caja: string | null
  usuario_mat: string | null
  usuario_aprueba_post: string | null
  rut_apod: string | null
  dv_apod: string | null
  nombre_apod: string | null
  ap_paterno_apod: string | null
  ap_materno_apod: string | null
  telefono_apod: string | null
  mail_apod: string | null
  pagodoc386: number | null
  fecha_actualizacion: string | null
  sync_timestamp: string | null
}

export interface MatriculadosResponse {
  data: Matriculado[]
  total: number
  page: number
  limit: number
  totalPages: number
  lastSync: string | null
}

export interface MatriculadosStats {
  total: number
  nuevos: number
  antiguos: number
  porFacultad: Array<{ facultad: string; count: number }>
  porTipoCarrera: Array<{ tipo_carr: string; count: number }>
  conCAE: number
  conBecaMinisterial: number
  firmados: number
  pendientesFirma: number
  totalListaMatricula: number
  totalListaArancel: number
  totalCopago: number
}

export interface MatriculadosFilters {
  page?: number
  limit?: number
  search?: string
  tipo_alumno?: 'NUEVO' | 'ANTIGUO'
  facultad?: string
  carrera?: string
  estado_firma?: 'SI' | 'NO'
  estado_cae?: 'VIGENTE' | 'CANCELADA' | 'MOROSO'
  fechaDesde?: string
  fechaHasta?: string
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function rowToMatriculado(row: Record<string, unknown>): Matriculado {
  return {
    ano_mat: Number(row.ano_mat),
    periodo_mat: Number(row.periodo_mat),
    codcli: String(row.codcli ?? ''),
    codcarpr: String(row.codcarpr ?? ''),
    ano_ingreso: row.ano_ingreso != null ? Number(row.ano_ingreso) : null,
    periodo_ingr: row.periodo_ingr != null ? Number(row.periodo_ingr) : null,
    mat_efectiva: (row.mat_efectiva as string) ?? null,
    fec_mat: (row.fec_mat as string) ?? null,
    hora_mat: (row.hora_mat as string) ?? null,
    rut: (row.rut as string) ?? null,
    dig: (row.dig as string) ?? null,
    nombre: (row.nombre as string) ?? null,
    apellido_pat: (row.apellido_pat as string) ?? null,
    apellido_mat: (row.apellido_mat as string) ?? null,
    carrera: (row.carrera as string) ?? null,
    codpestud: (row.codpestud as string) ?? null,
    nivel: (row.nivel as string) ?? null,
    jornada: (row.jornada as string) ?? null,
    tipo_carr: (row.tipo_carr as string) ?? null,
    facultad: (row.facultad as string) ?? null,
    estacad: (row.estacad as string) ?? null,
    tipositu: (row.tipositu as string) ?? null,
    descripcion_situ: (row.descripcion_situ as string) ?? null,
    tipo_alumno: (row.tipo_alumno as Matriculado['tipo_alumno']) ?? null,
    categoria: (row.categoria as string) ?? null,
    lista_mat: num(row.lista_mat),
    ben_matr: num(row.ben_matr),
    copago_mat: num(row.copago_mat),
    documento_mat: (row.documento_mat as string) ?? null,
    lista_arancel: num(row.lista_arancel),
    ben_aran: num(row.ben_aran),
    copago_ara: num(row.copago_ara),
    documento_ara: (row.documento_ara as string) ?? null,
    copago_total: num(row.copago_total),
    cae_monto: num(row.cae_monto),
    estado_cae: (row.estado_cae as Matriculado['estado_cae']) ?? null,
    beca_ministerial: (row.beca_ministerial as string) ?? null,
    monto_beca_minesterial: num(row.monto_beca_minesterial),
    estado_beca_mine: (row.estado_beca_mine as Matriculado['estado_beca_mine']) ?? null,
    deuda_morosa: num(row.deuda_morosa),
    num_bol_fact: (row.num_bol_fact as string) ?? null,
    num_contrato: (row.num_contrato as string) ?? null,
    estado_firma: (row.estado_firma as Matriculado['estado_firma']) ?? null,
    fonoact: (row.fonoact as string) ?? null,
    celularact: (row.celularact as string) ?? null,
    mail: (row.mail as string) ?? null,
    mail_inst: (row.mail_inst as string) ?? null,
    caja: (row.caja as string) ?? null,
    usuario_mat: (row.usuario_mat as string) ?? null,
    usuario_aprueba_post: (row.usuario_aprueba_post as string) ?? null,
    rut_apod: (row.rut_apod as string) ?? null,
    dv_apod: (row.dv_apod as string) ?? null,
    nombre_apod: (row.nombre_apod as string) ?? null,
    ap_paterno_apod: (row.ap_paterno_apod as string) ?? null,
    ap_materno_apod: (row.ap_materno_apod as string) ?? null,
    telefono_apod: (row.telefono_apod as string) ?? null,
    mail_apod: (row.mail_apod as string) ?? null,
    pagodoc386: num(row.pagodoc386),
    fecha_actualizacion: row.fecha_actualizacion
      ? new Date(row.fecha_actualizacion as string).toISOString()
      : null,
    sync_timestamp: row.sync_timestamp ? new Date(row.sync_timestamp as string).toISOString() : null,
  }
}

function parseMatriculadosStats(raw: unknown): MatriculadosStats {
  const j = raw as Record<string, unknown>
  return {
    total: Number(j.total ?? 0),
    nuevos: Number(j.nuevos ?? 0),
    antiguos: Number(j.antiguos ?? 0),
    porFacultad: (j.porFacultad as MatriculadosStats['porFacultad']) ?? [],
    porTipoCarrera: (j.porTipoCarrera as MatriculadosStats['porTipoCarrera']) ?? [],
    conCAE: Number(j.conCAE ?? 0),
    conBecaMinisterial: Number(j.conBecaMinisterial ?? 0),
    firmados: Number(j.firmados ?? 0),
    pendientesFirma: Number(j.pendientesFirma ?? 0),
    totalListaMatricula: Number(j.totalListaMatricula ?? 0),
    totalListaArancel: Number(j.totalListaArancel ?? 0),
    totalCopago: Number(j.totalCopago ?? 0),
  }
}

export function useMatriculados() {
  const loading = ref(false)
  const syncing = ref(false)
  const hasNewData = ref(false)
  const data = ref<Matriculado[]>([])
  const total = ref(0)
  const page = ref(1)
  const limit = ref(20)
  const totalPages = ref(0)
  const lastSync = ref<string | null>(null)
  const stats = ref<MatriculadosStats | null>(null)
  const error = ref<Error | null>(null)

  async function fetchMatriculados(filters: MatriculadosFilters = {}): Promise<MatriculadosResponse | null> {
    loading.value = true
    error.value = null
    try {
      const pageNum = filters.page ?? 1
      const limitNum = Math.min(filters.limit ?? 20, 100)

      const q = new URLSearchParams({
        page: String(pageNum),
        limit: String(limitNum),
      })
      const search = filters.search?.trim()
      if (search) q.set('search', search)
      if (filters.tipo_alumno) q.set('tipo_alumno', filters.tipo_alumno)
      if (filters.facultad) q.set('facultad', filters.facultad)
      if (filters.carrera) q.set('carrera', filters.carrera)
      if (filters.estado_firma) q.set('estado_firma', filters.estado_firma)
      if (filters.estado_cae) q.set('estado_cae', filters.estado_cae)
      if (filters.fechaDesde) q.set('fechaDesde', filters.fechaDesde)
      if (filters.fechaHasta) q.set('fechaHasta', filters.fechaHasta)

      const response = await fetch(admisionUrl('/api/matriculados?' + q.toString()))
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const j = (await response.json()) as Record<string, unknown>
      const rows = (j.data as unknown[]) ?? []
      const totalCount = Number(j.total ?? 0)
      const tp = Number(j.totalPages ?? 0)
      const lastRaw = j.lastSync
      const last =
        lastRaw != null && String(lastRaw) !== 'null'
          ? new Date(String(lastRaw)).toISOString()
          : null

      const mapped = rows.map((r) => rowToMatriculado(r as Record<string, unknown>))
      data.value = mapped
      total.value = totalCount
      page.value = pageNum
      limit.value = limitNum
      totalPages.value = tp
      lastSync.value = last
      hasNewData.value = false

      return {
        data: mapped,
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: tp,
        lastSync: last,
      }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Error al obtener matriculados')
      console.error('Error al obtener matriculados:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchStats(): Promise<MatriculadosStats | null> {
    try {
      const response = await fetch(admisionUrl('/api/matriculados/stats'))
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      const raw = await response.json()
      const parsed = parseMatriculadosStats(raw)
      stats.value = parsed
      return parsed
    } catch (e) {
      console.error('Error al obtener estadísticas de matriculados:', e)
      return null
    }
  }

  async function syncMatriculadosBackground(): Promise<{
    ok: boolean
    inserted?: number
    updated?: number
    errors?: number
  }> {
    syncing.value = true
    error.value = null
    try {
      const response = await fetch(admisionUrl('/api/matriculados/sync'), {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      const json = await response.json()
      hasNewData.value = true
      return { ok: true, inserted: json.inserted, updated: json.updated, errors: json.errors }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Error al sincronizar matriculados')
      console.error('Error al sincronizar matriculados:', e)
      return { ok: false }
    } finally {
      syncing.value = false
    }
  }

  async function syncMatriculados(): Promise<{
    ok: boolean
    inserted?: number
    updated?: number
    errors?: number
  }> {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(admisionUrl('/api/matriculados/sync'), {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      const json = await response.json()
      await fetchMatriculados({ page: page.value, limit: limit.value })
      await fetchStats()
      return { ok: true, inserted: json.inserted, updated: json.updated, errors: json.errors }
    } catch (e) {
      error.value = e instanceof Error ? e : new Error('Error al sincronizar matriculados')
      console.error('Error al sincronizar matriculados:', e)
      return { ok: false }
    } finally {
      loading.value = false
    }
  }

  async function exportCSV(): Promise<void> {
    try {
      // Export en cliente de la página actual (sin endpoint Express).
      // Si se requiere export total, implementar Edge Function/worker por volumen.
      const headers = [
        'ano_mat',
        'periodo_mat',
        'codcli',
        'codcarpr',
        'rut',
        'nombre',
        'apellido_pat',
        'apellido_mat',
        'carrera',
        'facultad',
        'tipo_alumno',
        'estado_firma',
        'fec_mat',
        'hora_mat',
      ] as const

      const escapeCsv = (v: unknown) => {
        const s = v == null ? '' : String(v)
        if (/[\";\n]/.test(s)) return `"${s.replace(/\"/g, '""')}"`
        return s
      }

      const rows = [headers.join(';')]
      for (const r of data.value) {
        rows.push(headers.map((h) => escapeCsv((r as any)[h])).join(';'))
      }

      const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `matriculados_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Error al exportar CSV:', e)
      throw e
    }
  }

  return {
    data,
    total,
    page,
    limit,
    totalPages,
    lastSync,
    stats,
    loading,
    syncing,
    hasNewData,
    error,
    fetchMatriculados,
    fetchStats,
    syncMatriculados,
    syncMatriculadosBackground,
    exportCSV,
  }
}
