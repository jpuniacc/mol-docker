import type { EstadoPostulacion, Postulante } from '@/types/postulante'

type MvRow = Record<string, unknown>

/**
 * Convierte fila snake_case de `mv_postulantes_sync` al shape Postulante (mayúsculas) usado en la UI.
 */
export function rowToPostulante(row: MvRow): Postulante {
  let estados: EstadoPostulacion[] = []
  if (row.estados != null) {
    try {
      estados =
        typeof row.estados === 'string' ? JSON.parse(row.estados as string) : (row.estados as EstadoPostulacion[])
    } catch {
      estados = []
    }
  }

  return {
    CODINT: String(row.codint ?? ''),
    RUT: (row.rut as string) || '',
    DIGITO: (row.digito as string) || '',
    NOMBRE: (row.nombre as string) || '',
    PATERNO: (row.paterno as string) || '',
    MATERNO: (row.materno as string) || '',
    SEXO: (row.sexo as string) || '',
    FECNAC: row.fecnac ? new Date(row.fecnac as string).toISOString() : '',
    ESTADOCIVIL: (row.estadocivil as string) || '',
    NACIONALIDAD: (row.nacionalidad as string) || '',
    PAISORIGEN: (row.paisorigen as string) || '',
    DIRECCION: (row.direccion as string) || '',
    CIUDAD: (row.ciudad as string) || '',
    COMUNA: (row.comuna as string) || '',
    TELEFONO: (row.telefono as string) || '',
    CELULAR: (row.celular as string) || '',
    EMAIL: (row.email as string) || '',
    CODCOL: (row.codcol as string) || '',
    NOMBRECOL: (row.nombrecol as string) || '',
    COMUNACOLEGIO: (row.comunacolegio as string) || '',
    NOTAEM: (row.notaem as string) || '',
    ANOEGRESO: (row.anoegreso as string) || '',
    CARRINT1: (row.carrint1 as string) || '',
    CARRINT2: (row.carrint2 as string) || '',
    CARRINT3: (row.carrint3 as string) || '',
    CARRINT4: (row.carrint4 as string) || '',
    CARRINT5: (row.carrint5 as string) || '',
    NOMBRE_C: (row.nombre_c as string) || '',
    NOMBRE_C2: (row.nombre_c2 as string) || '',
    NOMBRE_C3: (row.nombre_c3 as string) || '',
    NOMBRE_C4: (row.nombre_c4 as string) || '',
    NOMBRE_C5: (row.nombre_c5 as string) || '',
    ANO: String(row.ano ?? ''),
    PERIODO: (row.periodo as string) || '',
    FECREG: row.fecreg ? new Date(row.fecreg as string).toISOString() : '',
    FECMOD: row.fecmod ? new Date(row.fecmod as string).toISOString() : '',
    USUARIO: (row.usuario as string) || '',
    OBSERVAC1: (row.observac1 as string) || '',
    OBSERVAC2: (row.observac2 as string) || '',
    OBSERVAC3: (row.observac3 as string) || '',
    OBSERVAC4: (row.observac4 as string) || '',
    OBSERVAC5: (row.observac5 as string) || '',
    CODMEDIO: (row.codmedio as string) || '',
    VIACONSULTA: (row.viaconsulta as string) || '',
    SEDE: (row.sede as string) || '',
    JORNADACARRER: (row.jornadacarrer as string) || '',
    PASSAPORTE: (row.passaporte as string) || '',
    FECEMISIONPA: row.fecemisionpa ? new Date(row.fecemisionpa as string).toISOString() : '',
    FECVENPA: row.fecvenpa ? new Date(row.fecvenpa as string).toISOString() : '',
    TIPOVISA: (row.tipovisa as string) || '',
    COLDEPE: (row.coldep as string) || '',
    POST_FUAS: (row.post_fuas as string) || '',
    POST_GRATUIDAD: (row.post_gratuidad as string) || '',
    DISCAPACIDAD: (row.discapacidad as string) || '',
    ETNIA_INDIGENA: (row.etnia_indigena as string) || '',
    TIPODOCUMENTO: (row.tipodocumento as string) || '',
    CODMOTIVO: (row.codmotivo as string) || '',
    PAISEXTRANJERO: (row.paisextranjero as string) || '',
    ES_EXTRANJERO: (row.es_extranjero as string) || '',
    ESTABLECIMIENTO: (row.establecimiento as string) || '',
    ESPECIALIDAD: (row.especialidad as string) || '',
    estados,
    es_vigente_automatico: Boolean(row.es_vigente),
  }
}

/** Igual que en uniacc-api PostulantesService.procesarEstadosPostulacion */
export function procesarEstadosPostulacion(postulante: Postulante): void {
  if (!postulante.estados) {
    postulante.estados = []
  }
  const carrerasInteres = [
    { codigo: postulante.CARRINT1, nombre: postulante.NOMBRE_C },
    { codigo: postulante.CARRINT2, nombre: postulante.NOMBRE_C2 },
    { codigo: postulante.CARRINT3, nombre: postulante.NOMBRE_C3 },
    { codigo: postulante.CARRINT4, nombre: postulante.NOMBRE_C4 },
    { codigo: postulante.CARRINT5, nombre: postulante.NOMBRE_C5 },
  ].filter((c) => c.codigo && String(c.codigo).trim() !== '')

  carrerasInteres.forEach((carrera) => {
    const estadoEnPoscar = postulante.estados!.find((e) => e.CODCARR === carrera.codigo)
    if (!estadoEnPoscar) {
      postulante.estados!.push({
        CODCARR: carrera.codigo,
        ESTADO: 'U',
        FECREG: postulante.FECREG,
        FECMOD: postulante.FECREG,
        PRIORIDAD: 0,
        JORNADA: postulante.JORNADACARRER || '',
        MATRICULADO: 'N',
        NOMBRE_CARRERA: carrera.nombre,
      })
    }
  })
}

export function mergePostulanteTracking(
  postulante: Postulante,
  desistidos: Set<string>,
  estadosSeguimiento: Record<string, string>,
  options?: { comparacion?: boolean },
): Postulante {
  if (options?.comparacion) {
    procesarEstadosPostulacion(postulante)
  }

  postulante.desistido = desistidos.has(String(postulante.CODINT))

  const estadoSeguimientoManual = estadosSeguimiento[String(postulante.CODINT)] ?? null
  const esVigenteAutomatico = postulante.es_vigente_automatico || false

  if (estadoSeguimientoManual === 'alumno_vigente') {
    postulante.estado_seguimiento = 'alumno_vigente'
    postulante.es_vigente_automatico = esVigenteAutomatico
  } else if (esVigenteAutomatico) {
    postulante.estado_seguimiento = 'alumno_vigente'
    postulante.es_vigente_automatico = true
  } else {
    postulante.estado_seguimiento = estadoSeguimientoManual
    postulante.es_vigente_automatico = false
  }

  return postulante
}
