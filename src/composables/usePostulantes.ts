import { ref } from 'vue'
import type {
  Postulante,
  PostulanteResponse,
  PostulanteStats,
  FiltrosPostulante,
} from '@/types/postulante'
import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { useErrorStore } from '@/stores/error'

/** URL absoluta o relativa al origen del front (mismo host que sirve el SPA si VITE_API_URL está vacío). */
function admisionUrl(path: string): string {
  const base = admisionApiBaseUrl().replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(admisionUrl(path))
  const json = (await res.json()) as T & { error?: string; message?: string }
  if (!res.ok) {
    const msg =
      (json as { message?: string }).message ||
      (json as { error?: string }).error ||
      `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json as T
}

function parsePostulanteStats(raw: unknown): PostulanteStats {
  const j = raw as Record<string, unknown>
  return {
    total: Number(j.total ?? 0),
    porCarrera: (j.porCarrera as PostulanteStats['porCarrera']) ?? [],
    porMes: (j.porMes as PostulanteStats['porMes']) ?? [],
    nuevosHoy: Number(j.nuevosHoy ?? 0),
    nuevosEstaSemana: Number(j.nuevosEstaSemana ?? 0),
    matriculados: Number(j.matriculados ?? 0),
    matriculadosPrimeraOpcion: Number(j.matriculadosPrimeraOpcion ?? 0),
    matriculadosOtrasOpciones: Number(j.matriculadosOtrasOpciones ?? 0),
    enEspera: Number(j.enEspera ?? 0),
    aprobados: Number(j.aprobados ?? 0),
    pendientes: Number(j.pendientes ?? 0),
    desistidos: Number(j.desistidos ?? 0),
    alumnosVigentes: Number(j.alumnosVigentes ?? 0),
  }
}

export function usePostulantes() {
  const errorStore = useErrorStore()
  const loading = ref(false)

  async function fetchPostulantes(): Promise<PostulanteResponse | null> {
    loading.value = true
    try {
      const data = await getJson<PostulanteResponse>('/api/postulantes')
      return data
    } catch (error) {
      console.error('Error al obtener postulantes:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al obtener postulantes'),
      })
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchPostulantesComparacion(): Promise<PostulanteResponse | null> {
    loading.value = true
    try {
      const data = await getJson<PostulanteResponse>('/api/postulantes/comparacion')
      return data
    } catch (error) {
      console.error('Error al obtener postulantes de comparación:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al obtener postulantes de comparación'),
      })
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchPostulanteById(codint: string): Promise<Postulante | null> {
    loading.value = true
    try {
      const res = await fetch(admisionUrl(`/api/postulantes/${encodeURIComponent(codint)}`))
      if (res.status === 404) return null
      const json = (await res.json()) as Postulante & { error?: string; message?: string }
      if (!res.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`)
      }
      return json as Postulante
    } catch (error) {
      console.error('Error al obtener detalle del postulante:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al obtener detalle del postulante'),
      })
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchStats(): Promise<PostulanteStats | null> {
    loading.value = true
    try {
      const raw = await getJson<unknown>('/api/postulantes/stats')
      return parsePostulanteStats(raw)
    } catch (error) {
      console.error('Error al obtener estadísticas:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al obtener estadísticas'),
      })
      return null
    } finally {
      loading.value = false
    }
  }

  async function exportPostulantes(
    filtros: FiltrosPostulante = {},
    format: 'csv' | 'json' = 'csv',
  ): Promise<void> {
    loading.value = true
    try {
      const resp = await fetchPostulantes()
      const all = resp?.data ?? []

      const search = filtros.search?.trim().toLowerCase()
      const carrera = filtros.carrera?.trim().toLowerCase()
      const comuna = filtros.comuna?.trim().toLowerCase()
      const sexo = filtros.sexo?.trim().toLowerCase()
      const desde = filtros.fechaDesde ? new Date(filtros.fechaDesde) : null
      const hasta = filtros.fechaHasta ? new Date(filtros.fechaHasta) : null

      const filtered = all.filter((p) => {
        if (search) {
          const hay = [
            p.RUT,
            p.NOMBRE,
            p.PATERNO,
            p.MATERNO,
            p.EMAIL,
            p.CELULAR,
            p.TELEFONO,
            p.CARRINT1,
            p.CARRINT2,
            p.CARRINT3,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (!hay.includes(search)) return false
        }
        if (carrera) {
          const hay = [p.CARRINT1, p.CARRINT2, p.CARRINT3, p.CARRINT4, p.CARRINT5, p.NOMBRE_C]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          if (!hay.includes(carrera)) return false
        }
        if (comuna && !String(p.COMUNA || '').toLowerCase().includes(comuna)) return false
        if (sexo && !String(p.SEXO || '').toLowerCase().includes(sexo)) return false
        if (desde || hasta) {
          const d = p.FECREG ? new Date(p.FECREG) : null
          if (desde && d && d < desde) return false
          if (hasta && d && d > hasta) return false
        }
        return true
      })

      const today = new Date().toISOString().split('T')[0]
      const filename = `postulantes_${today}.${format}`

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json;charset=utf-8' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        return
      }

      const headers = [
        'CODINT',
        'RUT',
        'DIGITO',
        'NOMBRE',
        'PATERNO',
        'MATERNO',
        'EMAIL',
        'CELULAR',
        'CARRINT1',
        'CARRINT2',
        'NOMBRECOL',
        'FECREG',
        'DIRECCION',
        'COMUNA',
        'CIUDAD',
      ] as const

      const escapeCsv = (v: unknown) => {
        const s = v == null ? '' : String(v)
        if (/[\";\n]/.test(s)) return `"${s.replace(/\"/g, '""')}"`
        return s
      }

      const rows = [headers.join(';')]
      for (const p of filtered) {
        const row = p as unknown as Record<string, unknown>
        rows.push(
          headers
            .map((h) => escapeCsv(row[h]))
            .join(';'),
        )
      }

      const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al exportar postulantes:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al exportar postulantes'),
      })
    } finally {
      loading.value = false
    }
  }

  async function fetchRefresh(): Promise<boolean> {
    loading.value = true
    try {
      const response = await fetch(admisionUrl('/api/postulantes/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const j = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(j.message || `Error ${response.status}: ${response.statusText}`)
      }

      const data = (await response.json()) as { success?: boolean }
      return data.success === true
    } catch (error) {
      console.error('Error al actualizar datos:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al actualizar datos'),
      })
      return false
    } finally {
      loading.value = false
    }
  }

  async function fetchNotificar(codint: string): Promise<boolean> {
    loading.value = true
    try {
      const response = await fetch(admisionUrl(`/api/postulantes/${encodeURIComponent(codint)}/notificar`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const j = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(j.message || `Error ${response.status}: ${response.statusText}`)
      }

      const data = (await response.json()) as { success?: boolean }
      return data.success === true
    } catch (error) {
      console.error('Error al enviar notificación:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al enviar notificación'),
      })
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    fetchPostulantes,
    fetchPostulantesComparacion,
    fetchPostulanteById,
    fetchStats,
    exportPostulantes,
    fetchRefresh,
    fetchNotificar,
  }
}
