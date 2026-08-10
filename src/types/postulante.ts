export interface EstadoPostulacion {
  CODCARR: string
  ESTADO: 'U' | 'E' | 'A' | 'M' | 'R' | null // 'U' = Pendiente actualización datos U+, 'E' = En Espera (deprecated), 'A' = Aprobado, 'M' = Matriculado, 'R' = Rechazado
  FECREG: string
  FECMOD: string
  PRIORIDAD: number
  JORNADA: string
  MATRICULADO: string
  NOMBRE_CARRERA?: string
}

export interface Postulante {
  // Identificación
  CODINT: string
  RUT: string
  DIGITO: string

  // Datos personales
  NOMBRE: string
  PATERNO: string
  MATERNO: string
  SEXO: string
  FECNAC: string
  ESTADOCIVIL: string
  NACIONALIDAD: string
  PAISORIGEN: string

  // Contacto
  DIRECCION: string
  CIUDAD: string
  COMUNA: string
  TELEFONO: string
  CELULAR: string
  EMAIL: string

  // Datos académicos
  CODCOL: string
  NOMBRECOL: string
  COMUNACOLEGIO: string
  NOTAEM: string
  ANOEGRESO: string

  // Carreras de interés
  CARRINT1: string
  NOMBRE_C?: string // Nombre de la carrera 1 (JOIN con MT_CARRER)
  CARRINT2: string
  NOMBRE_C2?: string // Nombre de la carrera 2
  CARRINT3: string
  NOMBRE_C3?: string // Nombre de la carrera 3
  CARRINT4: string
  NOMBRE_C4?: string // Nombre de la carrera 4
  CARRINT5: string
  NOMBRE_C5?: string // Nombre de la carrera 5

  // Registro
  ANO: string
  PERIODO: string
  FECREG: string
  FECMOD: string
  USUARIO: string

  // Otros datos relevantes
  OBSERVAC1: string
  OBSERVAC2: string
  OBSERVAC3: string
  OBSERVAC4: string
  OBSERVAC5: string
  CODMEDIO: string
  VIACONSULTA: string
  SEDE: string
  JORNADACARRER: string
  PASSAPORTE: string
  FECEMISIONPA: string
  FECVENPA: string
  TIPOVISA: string
  COLDEPE: string
  POST_FUAS: string
  POST_GRATUIDAD: string
  DISCAPACIDAD: string
  ETNIA_INDIGENA: string
  TIPODOCUMENTO: string
  CODMOTIVO: string
  PAISEXTRANJERO: string
  ES_EXTRANJERO: string
  ESTABLECIMIENTO: string
  ESPECIALIDAD: string
  
  // Estados de postulación
  estados?: EstadoPostulacion[]
  
  // Estado de desistimiento (desde SQLite backend)
  desistido?: boolean
  
  // Estado de seguimiento (desde SQLite backend)
  estado_seguimiento?: string | null // 'no_contesta' | 'pendiente_documentacion' | 'evaluando' | 'alumno_vigente'
  
  // Indica si el estado "alumno_vigente" fue detectado automáticamente desde MT_ALUMNO
  es_vigente_automatico?: boolean
}

export interface PostulanteResponse {
  data: Postulante[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PostulanteStats {
  total: number
  porCarrera: Array<{ carrera: string; count: number; codigos: Array<{ codigo: string; count: number }> }>
  porMes: Array<{ mes: string; count: number }>
  nuevosHoy: number
  nuevosEstaSemana: number
  matriculados: number
  matriculadosPrimeraOpcion: number
  matriculadosOtrasOpciones: number
  enEspera: number
  aprobados: number
  pendientes: number
  desistidos: number
  alumnosVigentes: number
}

export interface FiltrosPostulante {
  page?: number
  limit?: number
  search?: string
  carrera?: string
  estado?: string // 'pendiente' | 'en_espera' | 'aprobado' | 'rechazado' | 'matriculado' | 'desistido'
  estado_seguimiento?: string // 'no_contesta' | 'pendiente_documentacion' | 'evaluando' | 'alumno_vigente'
  ano?: string
  comuna?: string
  sexo?: string
  fechaDesde?: string
  fechaHasta?: string
}

// Helper para obtener nombre completo
export function getNombreCompleto(postulante: Postulante): string {
  return `${postulante.NOMBRE} ${postulante.PATERNO} ${postulante.MATERNO}`.trim()
}

// Helper para obtener RUT formateado
export function getRutCompleto(postulante: Postulante): string {
  return `${postulante.RUT}-${postulante.DIGITO}`
}

// Helper para formatear fecha
export function formatearFecha(fecha: string): string {
  if (!fecha) return ''
  const date = new Date(fecha)
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Helper para contar carreras de interés
export function contarCarreras(postulante: Postulante): number {
  let count = 0
  if (postulante.CARRINT1 && postulante.CARRINT1.trim() !== '') count++
  if (postulante.CARRINT2 && postulante.CARRINT2.trim() !== '') count++
  if (postulante.CARRINT3 && postulante.CARRINT3.trim() !== '') count++
  if (postulante.CARRINT4 && postulante.CARRINT4.trim() !== '') count++
  if (postulante.CARRINT5 && postulante.CARRINT5.trim() !== '') count++
  return count
}

// Helper para obtener todas las carreras del postulante
export function obtenerCarreras(postulante: Postulante): Array<{ numero: number; codigo: string; nombre?: string }> {
  const carreras: Array<{ numero: number; codigo: string; nombre?: string }> = []
  
  if (postulante.CARRINT1 && postulante.CARRINT1.trim() !== '') {
    carreras.push({ numero: 1, codigo: postulante.CARRINT1, nombre: postulante.NOMBRE_C })
  }
  if (postulante.CARRINT2 && postulante.CARRINT2.trim() !== '') {
    carreras.push({ numero: 2, codigo: postulante.CARRINT2, nombre: postulante.NOMBRE_C2 })
  }
  if (postulante.CARRINT3 && postulante.CARRINT3.trim() !== '') {
    carreras.push({ numero: 3, codigo: postulante.CARRINT3, nombre: postulante.NOMBRE_C3 })
  }
  if (postulante.CARRINT4 && postulante.CARRINT4.trim() !== '') {
    carreras.push({ numero: 4, codigo: postulante.CARRINT4, nombre: postulante.NOMBRE_C4 })
  }
  if (postulante.CARRINT5 && postulante.CARRINT5.trim() !== '') {
    carreras.push({ numero: 5, codigo: postulante.CARRINT5, nombre: postulante.NOMBRE_C5 })
  }
  
  return carreras
}

// Helper para obtener estado de una carrera específica
export function obtenerEstadoCarrera(
  postulante: Postulante, 
  codigoCarrera: string
): EstadoPostulacion | null {
  if (!postulante.estados || !codigoCarrera) return null
  return postulante.estados.find(e => e.CODCARR === codigoCarrera) || null
}

// Helper para calcular días hábiles transcurridos (excluyendo fines de semana)
export function calcularDiasHabiles(fechaInicio: string | Date): number {
  if (!fechaInicio) return 0
  
  const inicio = typeof fechaInicio === 'string' ? new Date(fechaInicio) : fechaInicio
  const hoy = new Date()
  
  // Si es el mismo día, retornar 0
  if (inicio.toDateString() === hoy.toDateString()) return 0
  
  let diasHabiles = 0
  const fecha = new Date(inicio)
  
  while (fecha < hoy) {
    fecha.setDate(fecha.getDate() + 1)
    const diaSemana = fecha.getDay()
    // 0 = Domingo, 6 = Sábado
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasHabiles++
    }
  }
  
  return diasHabiles
}

// Helper para verificar si hay retraso en el procesamiento
export function tieneRetraso(fechaRegistro: string | Date, estado: 'U' | 'E' | 'A' | 'M' | 'R' | null | undefined): boolean {
  // No aplicar alerta a estados finales o procesados
  // Excluir estados 'A', 'M', 'R', 'U' y null de las alertas de retraso
  if (estado === 'A' || estado === 'M' || estado === 'R' || estado === 'U' || estado === null) return false
  
  const diasHabiles = calcularDiasHabiles(fechaRegistro)
  return diasHabiles > 1 // Más de 1 día hábil
}

// Helper para obtener badge de estado
export function obtenerBadgeEstado(
  estado: 'U' | 'E' | 'A' | 'M' | 'R' | null | undefined,
  fechaRegistro?: string | Date,
  estadoSeguimiento?: string | null
): {
  texto: string
  variant: 'default' | 'secondary' | 'warning' | 'success' | 'destructive'
  descripcion: string
  tieneAlerta: boolean
  diasRetraso?: number
} {
  const diasHabiles = fechaRegistro ? calcularDiasHabiles(fechaRegistro) : 0
  const tieneAlerta = fechaRegistro ? tieneRetraso(fechaRegistro, estado) : false
  
  // Si tiene estado de seguimiento "alumno_vigente", mostrar como estado especial (tiene prioridad sobre estados de postulación)
  if (estadoSeguimiento === 'alumno_vigente') {
    return {
      texto: 'Alumno Vigente',
      variant: 'default', // Azul (default en shadcn/ui suele ser azul)
      descripcion: 'Alumno vigente en el sistema',
      tieneAlerta: false,
    }
  }
  
  if (!estado) {
    // Si tiene otro estado de seguimiento, mostrar "Gestionado" en verde
    if (estadoSeguimiento) {
      return { 
        texto: 'Gestionado', 
        variant: 'success', // Verde
        descripcion: 'Postulante con estado de seguimiento asignado',
        tieneAlerta: false,
      }
    }
    
    // Sin estado de seguimiento ni estado de postulación - mostrar como "Pendiente actualización datos U+"
    return { 
      texto: 'Pendiente actualización datos U+', 
      variant: 'warning',
      descripcion: 'Pendiente de actualización de datos en sistema U+',
      tieneAlerta: false,
    }
  }
  
  const estados: Record<'U' | 'E' | 'A' | 'M' | 'R', { texto: string; variant: 'default' | 'secondary' | 'warning' | 'success' | 'destructive'; descripcion: string }> = {
    'U': { 
      texto: 'Pendiente actualización datos U+', 
      variant: 'warning', 
      descripcion: 'Pendiente de actualización de datos en sistema U+' 
    },
    'E': { 
      texto: 'En espera de aprobación de postulación', 
      variant: tieneAlerta ? 'destructive' : 'warning', 
      descripcion: tieneAlerta 
        ? `Esperando aprobación - ${diasHabiles} día${diasHabiles > 1 ? 's' : ''} hábil${diasHabiles > 1 ? 'es' : ''} de espera`
        : 'Esperando aprobación de postulación' 
    },
    'A': { texto: 'Postulación aprobada', variant: 'success', descripcion: 'Postulación aprobada' },
    'M': { texto: 'Matriculado', variant: 'default', descripcion: 'Alumno matriculado' },
    'R': { texto: 'Rechazado', variant: 'destructive', descripcion: 'Postulación rechazada - No se sigue gestionando' }
  }
  
  return {
    ...estados[estado],
    tieneAlerta: estado === 'E' ? tieneAlerta : false, // Solo 'E' puede tener alerta
    diasRetraso: estado === 'E' && tieneAlerta ? diasHabiles : undefined
  }
}

