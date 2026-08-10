import { ref } from 'vue'
import { supabaseSimuladorClient } from '@/services/supabaseSimuladorClient'
import type { Prospecto, ProspectosResponse, FiltrosProspecto } from '@/types/prospecto'
import { limpiarRUT } from '@/types/prospecto'
import type { CarreraUniacc } from '@/types/carrera'
import type { BecaUniacc } from '@/types/beca'
import { useErrorStore } from '@/stores/error'

export function useProspectos() {
  const errorStore = useErrorStore()
  const loading = ref(false)

  /**
   * Obtener lista de prospectos con paginación y filtros
   */
  async function fetchProspectos(
    page: number = 1,
    pageSize: number = 50,
    filtros?: FiltrosProspecto
  ): Promise<ProspectosResponse> {
    loading.value = true
    try {
      let query = supabaseSimuladorClient
        .from('prospectos')
        .select('*', { count: 'exact' })
        .ilike('url_origen', 'https://simulador.uniacc.cl/simulador%')

      // Aplicar filtros
      if (filtros) {
        if (filtros.nombre) {
          query = query.or(`nombre.ilike.%${filtros.nombre}%,apellido.ilike.%${filtros.nombre}%`)
        }
        if (filtros.email) {
          query = query.ilike('email', `%${filtros.email}%`)
        }
        if (filtros.rut) {
          query = query.ilike('rut', `%${filtros.rut}%`)
        }
        if (filtros.carrera) {
          query = query.eq('carrera', filtros.carrera)
        }
        if (filtros.region) {
          query = query.eq('region', filtros.region)
        }
        if (filtros.segmentacion) {
          query = query.eq('segmentacion', filtros.segmentacion)
        }
        if (filtros.consentimiento_contacto !== undefined && filtros.consentimiento_contacto !== null) {
          query = query.eq('consentimiento_contacto', filtros.consentimiento_contacto)
        }
        if (filtros.fechaDesde) {
          query = query.gte('created_at', filtros.fechaDesde)
        }
        if (filtros.fechaHasta) {
          query = query.lte('created_at', filtros.fechaHasta)
        }
      }

      // Ordenar por fecha de creación descendente primero
      query = query.order('created_at', { ascending: false })

      // Aplicar paginación
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        throw error
      }

      // Ordenar en el cliente: primero por RUT (agrupados), luego por fecha descendente
      const prospectosOrdenados = (data as Prospecto[] || []).sort((a, b) => {
        const rutA = limpiarRUT(a.rut || a.pasaporte || '')
        const rutB = limpiarRUT(b.rut || b.pasaporte || '')
        
        // Debug: Log cuando encontramos RUTs que deberían ser iguales pero no lo son
        if (rutA && rutB && rutA !== rutB) {
          const rutAOriginal = a.rut || a.pasaporte || ''
          const rutBOriginal = b.rut || b.pasaporte || ''
          if (rutAOriginal && rutBOriginal && rutAOriginal.replace(/\s+/g, '') === rutBOriginal.replace(/\s+/g, '')) {
            console.log('⚠️ RUTs que deberían ser iguales pero no coinciden:', {
              rutA: { original: `"${rutAOriginal}"`, limpio: `"${rutA}"` },
              rutB: { original: `"${rutBOriginal}"`, limpio: `"${rutB}"` },
              nombreA: `${a.nombre} ${a.apellido}`,
              nombreB: `${b.nombre} ${b.apellido}`
            })
          }
        }
        
        // Primero ordenar por RUT
        if (rutA !== rutB) {
          return rutA.localeCompare(rutB)
        }
        
        // Si el RUT es igual, ordenar por fecha descendente
        const fechaA = new Date(a.created_at).getTime()
        const fechaB = new Date(b.created_at).getTime()
        return fechaB - fechaA
      })
      
      // Log de agrupación después del ordenamiento
      const gruposRUT: Record<string, number> = {}
      prospectosOrdenados.forEach(p => {
        const rut = limpiarRUT(p.rut || p.pasaporte || '')
        if (rut) {
          gruposRUT[rut] = (gruposRUT[rut] || 0) + 1
        }
      })
      
      const rutDuplicados = Object.entries(gruposRUT).filter(([_, count]) => count > 1)
      if (rutDuplicados.length > 0) {
        console.log('📊 RUTs agrupados después del ordenamiento:', rutDuplicados.map(([rut, count]) => ({ rut, count })))
      }

      console.log('📊 Prospectos obtenidos de la tabla prospectos:')
      console.log('  - Total de registros:', count)
      console.log('  - Registros en esta página:', prospectosOrdenados?.length || 0)
      console.log('  - Filtro aplicado: url_origen ILIKE "https://simulador.uniacc.cl/simulador%"')
      if (prospectosOrdenados && prospectosOrdenados.length > 0) {
        console.log('  - Primeros registros (url_origen):', prospectosOrdenados.slice(0, 5).map(p => ({
          id: p.id,
          nombre: `${p.nombre} ${p.apellido}`,
          url_origen: p.url_origen
        })))
      }
      console.log('  - Datos completos:', prospectosOrdenados)

      return {
        data: prospectosOrdenados,
        count: count || 0,
        error: null,
      }
    } catch (error) {
      console.error('Error al obtener prospectos:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al obtener prospectos'),
      })
      return {
        data: [],
        count: 0,
        error: error instanceof Error ? error : new Error('Error al obtener prospectos'),
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * Obtener un prospecto por ID
   */
  async function fetchProspectoPorId(id: string): Promise<Prospecto | null> {
    loading.value = true
    try {
      const { data, error } = await supabaseSimuladorClient
        .from('prospectos')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        throw error
      }

      return data as Prospecto
    } catch (error) {
      console.error('Error al obtener prospecto:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al obtener prospecto'),
      })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Obtener información de una carrera por ID
   */
  async function fetchCarreraPorId(id: number): Promise<CarreraUniacc | null> {
    try {
      const { data, error } = await supabaseSimuladorClient
        .from('carreras_uniacc')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        throw error
      }

      return data as CarreraUniacc
    } catch (error) {
      console.error('Error al obtener carrera:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al obtener carrera'),
      })
      return null
    }
  }

  /**
   * Obtener información de una beca por ID desde becas_uniacc
   */
  async function fetchBecaPorId(id: string): Promise<BecaUniacc | null> {
    try {
      const { data, error } = await supabaseSimuladorClient
        .from('becas_uniacc')
        .select('id, codigo_beca, nombre, descripcion, descuento_porcentaje')
        .eq('id', id)
        .single()

      if (error) {
        throw error
      }

      return data as BecaUniacc
    } catch (error) {
      console.error('Error al obtener beca:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al obtener beca'),
      })
      return null
    }
  }

  /**
   * Obtener todos los prospectos de un RUT específico
   */
  async function fetchProspectosPorRUT(rut: string): Promise<Prospecto[]> {
    loading.value = true
    try {
      // Limpiar el RUT antes de buscar
      const rutLimpio = limpiarRUT(rut)
      
      // Obtener todos los prospectos del simulador y filtrar en el cliente
      // Esto es necesario porque los RUTs en la BD pueden tener espacios
      const { data: todosProspectosRaw, error } = await supabaseSimuladorClient
        .from('prospectos')
        .select('*')
        .ilike('url_origen', 'https://simulador.uniacc.cl/simulador%')

      if (error) {
        throw error
      }

      const todosProspectos = (todosProspectosRaw ?? []) as Prospecto[]

      // Filtrar en el cliente comparando RUTs limpios
      const prospectosFiltrados = todosProspectos.filter((p) => {
        const rutProspecto = limpiarRUT(p.rut || p.pasaporte || '')
        return rutProspecto === rutLimpio && rutProspecto !== ''
      })

      // Eliminar duplicados por ID
      const prospectosUnicos = prospectosFiltrados.filter((p, index, self) =>
        index === self.findIndex((pr) => pr.id === p.id)
      )

      // Ordenar por fecha descendente
      const prospectosOrdenados = prospectosUnicos.sort((a, b) => {
        const fechaA = new Date(a.created_at).getTime()
        const fechaB = new Date(b.created_at).getTime()
        return fechaB - fechaA
      })

      return prospectosOrdenados as Prospecto[]
    } catch (error) {
      console.error('Error al obtener prospectos por RUT:', error)
      errorStore.setError({
        error: error instanceof Error ? error : new Error('Error al obtener prospectos por RUT'),
      })
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    fetchProspectos,
    fetchProspectoPorId,
    fetchCarreraPorId,
    fetchBecaPorId,
    fetchProspectosPorRUT,
  }
}

