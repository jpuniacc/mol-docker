import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { obtenerSesionLogId } from '@/services/molAuditContext'
import { estadoNpsRematricula, guardarNpsRematricula } from '@/services/npsRematriculaApi'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { esCalificacionNps, type CalificacionNps } from '@/utils/npsRematricula'

export const PREGUNTA_NPS =
  '¿Qué tan fácil fue rematricularte en UNIACC a través de esta plataforma?'
export const MSG_PREPARACION_NPS = 'No pudimos preparar la evaluación. Reintenta más tarde.'

function pickStr(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : null
}

export function claveOmitidoNps(codcli: string, anio: number, semestre: number): string {
  return `mol:ces-omitido:${codcli}:${anio}-${semestre}`
}

/** Estado y acciones de la encuesta CES de rematrícula (una instancia por vista). */
export function useNpsRematricula() {
  const alumnoMnp = useDatosAlumnoMnpStore()
  const periodoActivo = usePeriodoActivoStore()

  const cargando = ref(true)
  const respondio = ref(false)
  const omitido = ref(false)
  const calificacion = ref<CalificacionNps | null>(null)
  const comentario = ref('')
  const enviando = ref(false)
  const errorPreparacion = ref<string | null>(null)
  const errorGuardado = ref<string | null>(null)

  const muestraComentario = computed(() => {
    const c = calificacion.value
    return c != null && c <= 4
  })

  function identidadObligatoria() {
    const fila = alumnoMnp.primeraFila
    const rutAlumno = pickStr(fila?.rut_alumno)
    const codcli = pickStr(fila?.codcli)
    const codigoCarrera = pickStr(fila?.codigo_carrera)
    const jornada = pickStr(fila?.jornada_carrera)
    const anioPeriodo = periodoActivo.anio
    const semestrePeriodo = periodoActivo.semestre
    if (
      !rutAlumno ||
      !codcli ||
      !codigoCarrera ||
      !jornada ||
      anioPeriodo == null ||
      semestrePeriodo == null
    ) {
      return null
    }
    return { rutAlumno, codcli, codigoCarrera, jornada, anioPeriodo, semestrePeriodo }
  }

  function clave(): string | null {
    const codcli = pickStr(alumnoMnp.primeraFila?.codcli)
    const anio = periodoActivo.anio
    const semestre = periodoActivo.semestre
    if (!codcli || anio == null || semestre == null) return null
    return claveOmitidoNps(codcli, anio, semestre)
  }

  function leerOmitido(): boolean {
    const k = clave()
    if (!k) return false
    try {
      return window.localStorage.getItem(k) === '1'
    } catch {
      return false
    }
  }

  async function cargarEstado(): Promise<void> {
    cargando.value = true
    errorPreparacion.value = null
    try {
      await periodoActivo.ensureLoaded()
      const codcli = pickStr(alumnoMnp.primeraFila?.codcli)
      const anio = periodoActivo.anio
      const semestre = periodoActivo.semestre
      if (!codcli || anio == null || semestre == null) {
        errorPreparacion.value = MSG_PREPARACION_NPS
        return
      }
      const res = await estadoNpsRematricula(codcli, anio, semestre)
      if ('error' in res) {
        errorPreparacion.value = MSG_PREPARACION_NPS
        return
      }
      respondio.value = res.respondio
      if (!res.respondio && !identidadObligatoria()) {
        errorPreparacion.value = MSG_PREPARACION_NPS
      }
      omitido.value = leerOmitido()
    } catch {
      errorPreparacion.value = MSG_PREPARACION_NPS
    } finally {
      cargando.value = false
    }
  }

  function omitir(): void {
    const k = clave()
    if (k) {
      try {
        window.localStorage.setItem(k, '1')
      } catch {
        /* modo privado / storage bloqueado: solo se omite en memoria */
      }
    }
    omitido.value = true
  }

  function seleccionar(n: CalificacionNps): void {
    if (enviando.value) return
    calificacion.value = n
    errorGuardado.value = null
    if (n >= 5) comentario.value = ''
  }

  /** Devuelve true si se guardó correctamente. */
  async function enviar(): Promise<boolean> {
    if (enviando.value || calificacion.value == null) return false
    if (!esCalificacionNps(calificacion.value)) return false

    const id = identidadObligatoria()
    if (!id) {
      errorPreparacion.value = MSG_PREPARACION_NPS
      return false
    }

    enviando.value = true
    errorGuardado.value = null
    try {
      const err = await guardarNpsRematricula({
        ...id,
        calificacion: calificacion.value,
        comentario: muestraComentario.value ? comentario.value : null,
        periodoLabel: periodoActivo.label,
        sesionId: obtenerSesionLogId(),
      })
      if (err) {
        errorGuardado.value = err
        toast.error('No se pudo guardar tu evaluación. Intenta de nuevo.')
        return false
      }
      respondio.value = true
      toast.success('Evaluación registrada.')
      return true
    } catch {
      errorGuardado.value = 'error'
      toast.error('No se pudo guardar tu evaluación. Intenta de nuevo.')
      return false
    } finally {
      enviando.value = false
    }
  }

  return {
    cargando,
    respondio,
    omitido,
    calificacion,
    comentario,
    enviando,
    errorPreparacion,
    errorGuardado,
    muestraComentario,
    cargarEstado,
    omitir,
    seleccionar,
    enviar,
  }
}

export type NpsRematriculaEstado = ReturnType<typeof useNpsRematricula>
