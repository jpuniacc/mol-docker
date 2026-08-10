import { ref } from 'vue'

import { supabase } from '@/services/supabaseClient'

export function useDesistimiento() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function marcarDesistido(codint: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const { error: e1 } = await supabase.rpc('uniacc_marcar_desistido', { p_codint: codint })
      if (e1) {
        error.value = e1.message
        return false
      }
      return true
    } catch (err) {
      console.error('Error al marcar desistido:', err)
      error.value = 'Error de conexión al marcar como desistido'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function desmarcarDesistido(codint: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const { error: e1 } = await supabase.rpc('uniacc_desmarcar_desistido', { p_codint: codint })
      if (e1) {
        error.value = e1.message
        return false
      }
      return true
    } catch (err) {
      console.error('Error al desmarcar desistido:', err)
      error.value = 'Error de conexión al reactivar postulante'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function actualizarEstadoSeguimiento(codint: string, estado: string | null): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const { error: e1 } = await supabase.rpc('uniacc_set_estado_seguimiento', {
        p_codint: codint,
        p_estado: estado,
      })
      if (e1) {
        error.value = e1.message
        return false
      }
      return true
    } catch (err) {
      console.error('Error al actualizar estado de seguimiento:', err)
      error.value = 'Error de conexión al actualizar estado de seguimiento'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function obtenerHistorialEstados(codint: string): Promise<
    Array<{
      id: number
      estado_anterior: string | null
      estado_nuevo: string | null
      fecha_cambio: string
    }> | null
  > {
    isLoading.value = true
    error.value = null

    try {
      const { data: rows, error: e1 } = await supabase
        .from('mv_historial_estados_seguimiento')
        .select('id, estado_anterior, estado_nuevo, fecha_cambio')
        .eq('codint', codint)
        .order('fecha_cambio', { ascending: false })

      if (e1) {
        error.value = e1.message
        return null
      }

      return (rows ?? []).map((r) => ({
        id: Number(r.id),
        estado_anterior: r.estado_anterior != null ? String(r.estado_anterior) : null,
        estado_nuevo: r.estado_nuevo != null ? String(r.estado_nuevo) : null,
        fecha_cambio: r.fecha_cambio ? new Date(r.fecha_cambio as string).toISOString() : new Date().toISOString(),
      }))
    } catch (err) {
      console.error('Error al obtener historial de estados:', err)
      error.value = 'Error de conexión al obtener historial de estados'
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    marcarDesistido,
    desmarcarDesistido,
    actualizarEstadoSeguimiento,
    obtenerHistorialEstados,
    isLoading,
    error,
  }
}
