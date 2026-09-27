import { computed } from 'vue'

import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'

/** Fuente unificada del alumno autenticado: mnp_datos_alumnos sesión > mv_usuario. */
export function useAlumnoRematriculaFuente() {
  const auth = useAuthStore()
  const alumnoMnp = useDatosAlumnoMnpStore()

  const enModoMockSeleccion = computed(() => false)

  const plan = computed(() => null)

  const mnpLegacy = computed(() => alumnoMnp.primeraFila)

  function pickStr(...vals: (string | null | undefined)[]): string {
    for (const v of vals) {
      const t = (v ?? '').trim()
      if (t.length > 0) return t
    }
    return '—'
  }

  const nombreMostrado = computed(() => {
    if (auth.mvUsuario) return auth.displayNombreCompleto || auth.username || '—'
    return pickStr(mnpLegacy.value?.nombre_alumno, auth.displayNombreCompleto, auth.username)
  })

  const rutMostrado = computed(() => {
    if (auth.mvUsuario) return '—'
    return pickStr(mnpLegacy.value?.rut_alumno)
  })

  const carreraMostrada = computed(() => pickStr(mnpLegacy.value?.nombre_carrera))

  const codcliMostrado = computed(() => pickStr(mnpLegacy.value?.codcli))

  const correoPersonalMostrado = computed(() =>
    pickStr(mnpLegacy.value?.email_personal, auth.email),
  )

  const correoInstitucionalMostrado = computed(() =>
    pickStr(mnpLegacy.value?.email_institucional, auth.email),
  )

  const telefonoMostrado = computed(() =>
    pickStr(mnpLegacy.value?.telefono_actual, mnpLegacy.value?.telefono_proceso),
  )

  const rutApoderadoMostrado = computed(() => pickStr(mnpLegacy.value?.rut_apoderado))

  const nombreApoderadoMostrado = computed(() => pickStr(mnpLegacy.value?.nombre_apoderado))

  const mailApoderadoMostrado = computed(() => '—')

  const direccionMostrada = computed(() => pickStr(mnpLegacy.value?.direccion))

  const comunaMostrada = computed(() => pickStr(mnpLegacy.value?.comuna))

  const ciudadMostrada = computed(() => pickStr(mnpLegacy.value?.ciudad))

  const campusMostrado = computed(() =>
    pickStr(mnpLegacy.value?.comuna, mnpLegacy.value?.ciudad, 'Campus UNIACC'),
  )

  const tipoCarreraMostrada = computed(() => pickStr(mnpLegacy.value?.tipo_carrera))

  const jornadaMostrada = computed(() => pickStr(mnpLegacy.value?.jornada_carrera))

  const estadoAcademico = computed(() => pickStr(mnpLegacy.value?.estado_academico))

  const ultimaSituacion = computed(() => '—')

  const regionMostrada = computed(() => pickStr(mnpLegacy.value?.region))

  const nacionalidadMostrada = computed(() => pickStr(mnpLegacy.value?.nacionalidad))

  const fechaNacimientoMostrada = computed(() => pickStr(mnpLegacy.value?.fecha_nacimiento))

  const generoMostrado = computed(() => pickStr(mnpLegacy.value?.genero))

  const rutAlumnoMostrado = computed(() => rutMostrado.value)

  return {
    enModoMockSeleccion,
    plan,
    nombreMostrado,
    rutMostrado,
    carreraMostrada,
    codcliMostrado,
    correoPersonalMostrado,
    correoInstitucionalMostrado,
    telefonoMostrado,
    rutApoderadoMostrado,
    nombreApoderadoMostrado,
    mailApoderadoMostrado,
    direccionMostrada,
    comunaMostrada,
    ciudadMostrada,
    campusMostrado,
    tipoCarreraMostrada,
    jornadaMostrada,
    estadoAcademico,
    ultimaSituacion,
    regionMostrada,
    nacionalidadMostrada,
    fechaNacimientoMostrada,
    generoMostrado,
    rutAlumnoMostrado,
  }
}
