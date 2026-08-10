import { defineStore, acceptHMRUpdate } from 'pinia'
import type {
  Postulante,
  PostulanteStats,
  FiltrosPostulante,
} from '@/types/postulante'
import { usePostulantes } from '@/composables/usePostulantes'

export const usePostulantesStore = defineStore('postulantes-store', () => {
  const { fetchPostulantes, fetchPostulanteById, fetchStats, exportPostulantes, fetchRefresh } = usePostulantes()

  // Estado
  const todosLosPostulantes = ref<Postulante[]>([]) // Cache completo de todos los registros
  const postulanteSeleccionado = ref<Postulante | null>(null)
  const stats = ref<PostulanteStats | null>(null)
  const filtros = ref<FiltrosPostulante>({
    page: 1,
    limit: 20,
    search: '',
    carrera: '',
    estado: '',
    estado_seguimiento: '',
    ano: '',
    sexo: '',
  })
  const isLoading = ref(false)

    // Computed: Aplicar TODOS los filtros
    const postulantesFiltrados = computed(() => {
      let filtered = todosLosPostulantes.value

      // Filtro por estado (pendiente, en_espera, aprobado, rechazado, matriculado, desistido)
      if (filtros.value.estado) {
        filtered = filtered.filter(p => {
          // Filtro por desistido
          if (filtros.value.estado === 'desistido') {
            // Excluir alumnos vigentes del filtro de desistidos
            // Un alumno vigente no puede estar desistido
            if (p.estado_seguimiento === 'alumno_vigente') {
              return false
            }
            return p.desistido === true
          }
          
          // Los demás filtros excluyen desistidos (pero no alumnos vigentes)
          if (p.desistido && p.estado_seguimiento !== 'alumno_vigente') {
            return false
          }
          
          // Filtro especial para MATRICULADO: buscar en CUALQUIER carrera
          if (filtros.value.estado === 'matriculado') {
            return p.estados?.some(e => e.ESTADO === 'M') || false
          }
          
          // Filtro especial para RECHAZADO: buscar en CUALQUIER carrera
          if (filtros.value.estado === 'rechazado') {
            return p.estados?.some(e => e.ESTADO === 'R') || false
          }
          
          // Para los demás estados (pendiente, en_espera, aprobado):
          // Primero excluir a los matriculados y rechazados en CUALQUIER carrera
          const tieneMatricula = p.estados?.some(e => e.ESTADO === 'M') || false
          const tieneRechazado = p.estados?.some(e => e.ESTADO === 'R') || false
          if (tieneMatricula || tieneRechazado) {
            return false // Los matriculados y rechazados solo aparecen en sus filtros respectivos
          }
          
          // Ahora buscar en carrera principal (solo para no matriculados ni rechazados)
          const estadoCarreraPrincipal = p.estados?.find(
            e => e.CODCARR === p.CARRINT1 && e.JORNADA === p.JORNADACARRER
          )
          
          if (filtros.value.estado === 'pendiente') {
            return !estadoCarreraPrincipal
          }
          
          if (!estadoCarreraPrincipal) {
            return false
          }
          
          // Mapear el estado
          if (filtros.value.estado === 'en_espera') return estadoCarreraPrincipal.ESTADO === 'E'
          if (filtros.value.estado === 'aprobado') return estadoCarreraPrincipal.ESTADO === 'A'
          
          return false
        })
      } else {
        // Sin filtro: ocultar desistidos por defecto (pero mostrar alumnos vigentes aunque estén marcados como desistidos)
        filtered = filtered.filter(p => {
          // Si es alumno vigente, mostrarlo aunque esté marcado como desistido
          if (p.estado_seguimiento === 'alumno_vigente') {
            return true
          }
          // Si no es alumno vigente, ocultarlo si está desistido
          return !p.desistido
        })
      }

    // Filtro por estado de seguimiento (no_contesta, pendiente_documentacion, evaluando, alumno_vigente)
    // Se combina con el filtro de estado de postulación (AND lógico)
    if (filtros.value.estado_seguimiento) {
      filtered = filtered.filter(p => {
        // Verificar que el postulante tenga el estado de seguimiento seleccionado
        return p.estado_seguimiento === filtros.value.estado_seguimiento
      })
    }

    // Filtro por búsqueda (RUT, nombre, apellidos)
    if (filtros.value.search) {
      const q = filtros.value.search
      const searchLower = q.toLowerCase()
      filtered = filtered.filter(p => 
        p.RUT.includes(q) ||
        p.NOMBRE.toLowerCase().includes(searchLower) ||
        p.PATERNO.toLowerCase().includes(searchLower) ||
        p.MATERNO.toLowerCase().includes(searchLower)
      )
    }

    // Filtro por carrera (por código)
    if (filtros.value.carrera) {
      filtered = filtered.filter(p =>
        p.CARRINT1 === filtros.value.carrera ||
        p.CARRINT2 === filtros.value.carrera ||
        p.CARRINT3 === filtros.value.carrera ||
        p.CARRINT4 === filtros.value.carrera ||
        p.CARRINT5 === filtros.value.carrera
      )
    }

    // Filtro por año de postulación
    if (filtros.value.ano) {
      filtered = filtered.filter(p => p.ANO?.toString() === filtros.value.ano)
    }

    // Filtro por sexo
    if (filtros.value.sexo) {
      filtered = filtered.filter(p => p.SEXO === filtros.value.sexo)
    }

    return filtered
  })

  // Computed: Paginación sobre datos filtrados
  const postulantesPaginados = computed(() => {
    const page = filtros.value.page ?? 1
    const limit = filtros.value.limit ?? 20
    const start = (page - 1) * limit
    const end = start + limit
    return postulantesFiltrados.value.slice(start, end)
  })

  // Computed: Datos de paginación
  const paginacion = computed(() => {
    const page = filtros.value.page ?? 1
    const limit = filtros.value.limit ?? 20
    return {
      total: postulantesFiltrados.value.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(postulantesFiltrados.value.length / limit)),
    }
  })

  // Computed: Postulantes para mostrar (alias para compatibilidad)
  const postulantes = computed(() => postulantesPaginados.value)

  // Computed: Lista de carreras únicas disponibles
  const carrerasDisponibles = computed(() => {
    const carrerasMap = new Map<string, { codigo: string; nombre: string | null }>()
    
    todosLosPostulantes.value.forEach(postulante => {
      // Agregar CARRINT1
      if (postulante.CARRINT1 && postulante.CARRINT1.trim() !== '') {
        if (!carrerasMap.has(postulante.CARRINT1)) {
          carrerasMap.set(postulante.CARRINT1, {
            codigo: postulante.CARRINT1,
            nombre: postulante.NOMBRE_C || null
          })
        }
      }
      // Agregar CARRINT2
      if (postulante.CARRINT2 && postulante.CARRINT2.trim() !== '') {
        if (!carrerasMap.has(postulante.CARRINT2)) {
          carrerasMap.set(postulante.CARRINT2, {
            codigo: postulante.CARRINT2,
            nombre: postulante.NOMBRE_C2 || null
          })
        }
      }
      // Agregar CARRINT3
      if (postulante.CARRINT3 && postulante.CARRINT3.trim() !== '') {
        if (!carrerasMap.has(postulante.CARRINT3)) {
          carrerasMap.set(postulante.CARRINT3, {
            codigo: postulante.CARRINT3,
            nombre: postulante.NOMBRE_C3 || null
          })
        }
      }
      // Agregar CARRINT4
      if (postulante.CARRINT4 && postulante.CARRINT4.trim() !== '') {
        if (!carrerasMap.has(postulante.CARRINT4)) {
          carrerasMap.set(postulante.CARRINT4, {
            codigo: postulante.CARRINT4,
            nombre: postulante.NOMBRE_C4 || null
          })
        }
      }
      // Agregar CARRINT5
      if (postulante.CARRINT5 && postulante.CARRINT5.trim() !== '') {
        if (!carrerasMap.has(postulante.CARRINT5)) {
          carrerasMap.set(postulante.CARRINT5, {
            codigo: postulante.CARRINT5,
            nombre: postulante.NOMBRE_C5 || null
          })
        }
      }
    })
    
    // Convertir a array y ordenar por nombre
    return Array.from(carrerasMap.values()).sort((a, b) => {
      const nombreA = a.nombre || a.codigo
      const nombreB = b.nombre || b.codigo
      return nombreA.localeCompare(nombreB)
    })
  })

  // Acciones
  async function cargarPostulantes() {
    isLoading.value = true
    try {
      const response = await fetchPostulantes()
      if (response) {
        // Cachear TODOS los datos
        todosLosPostulantes.value = response.data
        // Los computed properties se actualizarán automáticamente
      }
    } finally {
      isLoading.value = false
    }
  }

  async function cargarPostulante(codint: string) {
    isLoading.value = true
    try {
      const postulante = await fetchPostulanteById(codint)
      if (postulante) {
        postulanteSeleccionado.value = postulante
      }
    } finally {
      isLoading.value = false
    }
  }

  async function cargarStats() {
    isLoading.value = true
    try {
      const estadisticas = await fetchStats()
      if (estadisticas) {
        stats.value = estadisticas
      }
    } finally {
      isLoading.value = false
    }
  }

  async function exportar(format: 'csv' | 'json' = 'csv') {
    await exportPostulantes(filtros.value, format)
  }

  function actualizarFiltros(nuevosFiltros: Partial<FiltrosPostulante>) {
    filtros.value = { ...filtros.value, ...nuevosFiltros }
    // Resetear a la primera página cuando cambian los filtros
    if (nuevosFiltros.search !== undefined || 
        nuevosFiltros.carrera !== undefined || 
        nuevosFiltros.estado !== undefined ||
        nuevosFiltros.ano !== undefined ||
        nuevosFiltros.sexo !== undefined) {
      filtros.value.page = 1
    }
    // Ya NO necesitamos recargar desde el backend, los computed se actualizan automáticamente
  }

  function limpiarFiltros() {
    filtros.value = {
      page: 1,
      limit: 20,
      search: '',
      carrera: '',
      estado: '',
      estado_seguimiento: '',
      ano: '',
      sexo: '',
    }
  }

  function cambiarPagina(page: number) {
    filtros.value.page = page
    // Ya NO necesitamos recargar, el computed se actualiza automáticamente
  }

  function cambiarLimitePorPagina(limit: number) {
    filtros.value.limit = limit
    filtros.value.page = 1 // Volver a la primera página
    // Ya NO necesitamos recargar, el computed se actualiza automáticamente
  }

  function limpiarPostulanteSeleccionado() {
    postulanteSeleccionado.value = null
  }

  /**
   * Actualizar datos manualmente
   * Llama al endpoint de refresh y luego recarga los datos
   */
  async function refreshData() {
    isLoading.value = true
    try {
      // Primero ejecutar el refresh en el backend
      const success = await fetchRefresh()
      if (success) {
        // Luego recargar los datos
        await Promise.all([
          cargarPostulantes(),
          cargarStats(),
        ])
      }
    } finally {
      isLoading.value = false
    }
  }

  return {
    // Estado
    postulantes,
    postulanteSeleccionado,
    stats,
    filtros,
    paginacion,
    isLoading,
    carrerasDisponibles,
    // Acciones
    cargarPostulantes,
    cargarPostulante,
    cargarStats,
    exportar,
    actualizarFiltros,
    limpiarFiltros,
    cambiarPagina,
    cambiarLimitePorPagina,
    limpiarPostulanteSeleccionado,
    refreshData,
  }
})

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePostulantesStore, import.meta.hot))
}

