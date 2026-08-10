import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'

/** Fuente unificada de datos del alumno: mock plan de pagos > mnp_datos_alumnos sesión > mv_usuario. */
export function useMockAlumnoFuente() {
  const auth = useAuthStore()
  const alumnoMnp = useDatosAlumnoMnpStore()
  const mockCtx = useMockMatriculaContextStore()
  const { selectedPlanPagos } = storeToRefs(mockCtx)

  const enModoMockSeleccion = computed(() => selectedPlanPagos.value != null)

  const plan = computed(() => selectedPlanPagos.value)
  const mnpLegacy = computed(() => alumnoMnp.primeraFila)

  function pickStr(...vals: (string | null | undefined)[]): string {
    for (const v of vals) {
      const t = (v ?? '').trim()
      if (t.length > 0) return t
    }
    return '—'
  }

  const nombreMostrado = computed(() => {
    if (plan.value) return mockCtx.nombreAlumnoDisplay || pickStr(plan.value.nombre_alumno)
    if (auth.mvUsuario) return auth.displayNombreCompleto || auth.username || '—'
    return pickStr(mnpLegacy.value?.nombre_alumno, auth.displayNombreCompleto, auth.username)
  })

  const rutMostrado = computed(() => {
    if (plan.value?.rut) return plan.value.rut
    if (auth.mvUsuario) return '—'
    return pickStr(mnpLegacy.value?.rut_alumno)
  })

  const carreraMostrada = computed(() => {
    if (plan.value) return pickStr(plan.value.carrera, plan.value.nombre_carrera)
    return pickStr(mnpLegacy.value?.nombre_carrera)
  })

  const codcliMostrado = computed(() => {
    if (plan.value?.codcli) return plan.value.codcli
    return pickStr(mnpLegacy.value?.codcli)
  })

  const correoPersonalMostrado = computed(() => {
    if (plan.value) return pickStr(plan.value.mail)
    return pickStr(mnpLegacy.value?.email_personal, auth.email)
  })

  const correoInstitucionalMostrado = computed(() => {
    if (plan.value) return '—'
    return pickStr(mnpLegacy.value?.email_institucional, auth.email)
  })

  const telefonoMostrado = computed(() => {
    if (plan.value) return pickStr(plan.value.telefono)
    return pickStr(mnpLegacy.value?.telefono_actual, mnpLegacy.value?.telefono_proceso)
  })

  const rutApoderadoMostrado = computed(() => {
    if (plan.value) return pickStr(plan.value.rut_apoder)
    return pickStr(mnpLegacy.value?.rut_apoderado)
  })

  const nombreApoderadoMostrado = computed(() => {
    if (plan.value) return pickStr(plan.value.nombre_apoderado)
    return pickStr(mnpLegacy.value?.nombre_apoderado)
  })

  const direccionMostrada = computed(() => {
    if (plan.value) return pickStr(plan.value.direccion)
    return pickStr(mnpLegacy.value?.direccion)
  })

  const comunaMostrada = computed(() => {
    if (plan.value) return pickStr(plan.value.comuna)
    return pickStr(mnpLegacy.value?.comuna)
  })

  const ciudadMostrada = computed(() => {
    if (plan.value) return pickStr(plan.value.ciudad)
    return pickStr(mnpLegacy.value?.ciudad)
  })

  const campusMostrado = computed(() => pickStr(plan.value?.comuna, plan.value?.ciudad, 'Campus UNIACC'))

  const tipoCarreraMostrada = computed(() => {
    if (plan.value) return '—'
    return pickStr(mnpLegacy.value?.tipo_carrera)
  })

  const jornadaMostrada = computed(() => {
    if (plan.value) return pickStr(plan.value.jornada_carrera)
    return pickStr(mnpLegacy.value?.jornada_carrera)
  })

  const estadoAcademico = computed(() => pickStr(plan.value?.estado_academico))

  const ultimaSituacion = computed(() => pickStr(plan.value?.ultima_situacion))

  const regionMostrada = computed(() => {
    if (plan.value) return '—'
    return pickStr(mnpLegacy.value?.region)
  })

  const nacionalidadMostrada = computed(() => {
    if (plan.value) return '—'
    return pickStr(mnpLegacy.value?.nacionalidad)
  })

  const fechaNacimientoMostrada = computed(() => {
    if (plan.value) return '—'
    return pickStr(mnpLegacy.value?.fecha_nacimiento)
  })

  const generoMostrado = computed(() => {
    if (plan.value) return '—'
    return pickStr(mnpLegacy.value?.genero)
  })

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
