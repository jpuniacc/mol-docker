<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { AlertTriangle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { useContactoOtpConfigStore } from '@/stores/contactoOtpConfig'
import { emailInstitucionalDesdeUsername, useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { useMockContactoOtpUiStore } from '@/stores/mockContactoOtpUi'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/composables/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AccionesFlujo from '@/components/rematricula/AccionesFlujo.vue'
import MatriculaAlumnoApoderadoStep from '@/views/matricula-alumno/MatriculaAlumnoApoderadoStep.vue'
import MatriculaAlumnoDiscapacidadStep from '@/views/matricula-alumno/MatriculaAlumnoDiscapacidadStep.vue'
import MatriculaAlumnoTyCStep from '@/views/matricula-alumno/MatriculaAlumnoTyCStep.vue'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useTerminosCondicionesStore } from '@/stores/terminosCondiciones'
import { consultarUltimaTycRespuestaAlumno } from '@/services/tycAuditLog'
import { contextoMolAuditoria } from '@/services/molAuditContext'
import { debeSaltarPasoTyc } from '@/utils/tycAceptacion'
import { esPropioSostenedor } from '@/utils/apoderadoResponsable'
import {
  type ContactoOtpCanalLog,
  type ContactoOtpEventoLog,
  registrarLogContactoOtp,
} from '@/services/contactoOtpAuditLog'
import { logMockContactoOtp } from '@/utils/mockContactoOtpDebug'
import {
  solicitarOtpEmailCorreoPersonal,
  solicitarOtpSmsTelefono,
  verificarOtpEmailCorreoPersonal,
  verificarOtpSmsTelefono,
} from '@/services/rematriculaOtpApi'
import {
  extraerDigitosTelefonoChile,
  normalizarTelefonoChile,
  TELEFONO_CHILE_INPUT_MAX,
  TELEFONO_CHILE_PREFIJO,
  telefonoChileEsValido,
} from '@/utils/telefonoChile'
import { esCorreoDominioUniacc, MENSAJE_CORREO_PERSONAL_UNIACC } from '@/utils/correoPersonal'
import {
  guardarCanalOtpEnCurso,
  leerOtpEnCurso,
  limpiarCanalOtpEnCurso,
} from '@/utils/contactoOtpEnCurso'
import {
  CONTACTO_OTP_MAX_ENVIOS,
  CONTACTO_OTP_SIN_VALIDAR_ACEPTAR,
  CONTACTO_OTP_SIN_VALIDAR_CANCELAR,
  CONTACTO_OTP_SIN_VALIDAR_MENSAJE_CORREO,
  CONTACTO_OTP_SIN_VALIDAR_MENSAJE_TELEFONO,
  formatearDuracionOtp,
} from '@/constants/contactoOtpConfig'
import {
  actualizarDatosMolErp,
  fonoactParaSp,
} from '@/services/actualizarDatosMolApi'
import { codcliMtClientDesdeRut } from '@/services/alumnoDeudaNetApi'
import { fetchPlanPagosMvByCodcli } from '@/services/fetchPlanPagosMv'
import type { PlanPagosMvRow } from '@/types/supabase'

const auth = useAuthStore()
const otpConfig = useContactoOtpConfigStore()
const alumnoMnp = useDatosAlumnoMnpStore()
const alumnoCtx = useMatriculaAlumnoContextStore()
const otpUi = useMockContactoOtpUiStore()
const periodoActivo = usePeriodoActivoStore()
const tycStore = useTerminosCondicionesStore()
const fuente = useAlumnoRematriculaFuente()

const {
  modalContacto,
  errorCorreo,
  errorTelefono,
  correoValidadoOk,
  telefonoValidadoOk,
  correoOtpPendiente,
  correoOtpCodigo,
  correoOtpExpiresAt,
  correoOtpIntentosFallidos,
  correoOtpProximoReintentoAt,
  correoOtpEnviando,
  correoOtpVerificando,
  correoOtpTick,
  correoOtpEnviosRealizados,
  telefonoOtpPendiente,
  telefonoOtpCodigo,
  telefonoOtpExpiresAt,
  telefonoOtpIntentosFallidos,
  telefonoOtpProximoReintentoAt,
  telefonoOtpEnviando,
  telefonoOtpVerificando,
  telefonoOtpTick,
  telefonoOtpEnviosRealizados,
  mostrarContinuarSinOtpCorreo,
  mostrarContinuarSinOtpTelefono,
} = storeToRefs(otpUi)

const correoPersonalMostrado = fuente.correoPersonalMostrado
const telefonoMostrado = fuente.telefonoMostrado

const datosCargando = computed(
  () => !fuente.enModoMockSeleccion.value && !auth.mvUsuario && alumnoMnp.loading,
)

type PasoDatosPersonales = 'tyc' | 'contacto' | 'apoderado' | 'discapacidad'

const resolviendoTyc = ref(!alumnoCtx.tycAccepted)
const paso = ref<PasoDatosPersonales>(alumnoCtx.tycAccepted ? 'contacto' : 'tyc')
const emailDraft = ref('')
const telefonoDraft = ref('')
const emailConfirmado = ref('')
const telefonoConfirmado = ref('')
const emailTocado = ref(false)
const telefonoTocado = ref(false)
/** 9 dígitos nacionales, sin el +56. */
const telefonoDigitosLocal = ref('')

/** Evita el salto a apoderado/discapacidad cuando se reponen marcas ya guardadas. */
const restaurandoContacto = ref(false)
/** Evita doble POST a SP_ACTUALIZA_DATOS_MOL en la misma sesión de contacto. */
const erpSyncIntentado = ref(false)
/** Baseline ERP al cargar/resetear el paso (comparación “¿cambió?”). */
const baselineMailErp = ref('')
const baselineFonoDigitsErp = ref('')

let telefonoOtpCountdownIntervalId: ReturnType<typeof setInterval> | null = null
let correoOtpCountdownIntervalId: ReturnType<typeof setInterval> | null = null

const textoCorreoResumen = computed(() => {
  const t = emailDraft.value.trim()
  return t.length > 0 ? t : 'Sin ingresar'
})

const textoTelefonoResumen = computed(() => {
  const t = telefonoDraft.value.trim()
  return t.length > 0 ? t : 'Sin ingresar'
})

function cerrarModalCorreo(open: boolean) {
  if (!open) otpUi.cerrarModalCorreo()
}

function cerrarModalTelefono(open: boolean) {
  if (!open) otpUi.cerrarModalTelefono()
}

function valorInicialCorreoPersonal(): string {
  const v = correoPersonalMostrado.value
  return v === '—' ? '' : v
}

function valorInicialTelefonoDigitos(): string {
  const v = telefonoMostrado.value
  if (v === '—') return ''
  return extraerDigitosTelefonoChile(v)
}

function sincronizarTelefonoDraftDesdeDigitos() {
  telefonoDraft.value = normalizarTelefonoChile(telefonoDigitosLocal.value)
}

function capturarBaselineContactoErp(): void {
  baselineMailErp.value = valorInicialCorreoPersonal().trim().toLowerCase()
  const tel = telefonoMostrado.value
  baselineFonoDigitsErp.value = tel === '—' || !tel ? '' : tel.replace(/\D/g, '')
  erpSyncIntentado.value = false
}

function correoPersistidoCoincide(valor: string): boolean {
  const guardado = alumnoCtx.contactoCorreoValidado
  if (!guardado) return false
  if (esCorreoDominioUniacc(valor) || esCorreoDominioUniacc(guardado)) return false
  return valor.trim().toLowerCase() === guardado.trim().toLowerCase()
}

function telefonoPersistidoCoincide(digitos: string): boolean {
  const guardado = alumnoCtx.contactoTelefonoValidado
  if (!guardado) return false
  return digitos.replace(/\D/g, '') === guardado
}

function aplicarMarcasContactoPersistidas() {
  correoValidadoOk.value = correoPersistidoCoincide(emailDraft.value)
  telefonoValidadoOk.value = telefonoPersistidoCoincide(telefonoDigitosLocal.value)
}

function resetOtpEnCurso() {
  otpUi.modalContacto = null
  otpUi.errorCorreo = null
  otpUi.errorTelefono = null
  otpUi.resetCorreoOtpEnvios()
  otpUi.resetTelefonoOtpEnvios()
  otpUi.resetCorreoOtp()
  otpUi.resetTelefonoOtp()
}

function sincronizarDraftsContactoDesdeFuente(opciones?: { forzarResetValidacion?: boolean }) {
  if (paso.value !== 'contacto' || datosCargando.value) return

  restaurandoContacto.value = true
  if (opciones?.forzarResetValidacion) {
    const guardado = leerOtpEnCurso()
    if (guardado.correo || guardado.telefono) {
      aplicarOtpEnCursoGuardado()
    } else {
      resetOtpEnCurso()
      emailDraft.value = alumnoCtx.contactoCorreoValidado ?? valorInicialCorreoPersonal()
      telefonoDigitosLocal.value =
        alumnoCtx.contactoTelefonoValidado ?? valorInicialTelefonoDigitos()
      sincronizarTelefonoDraftDesdeDigitos()
    }
    capturarBaselineContactoErp()
  } else {
    if (!correoOtpPendiente.value && !emailDraft.value.trim()) {
      emailDraft.value = alumnoCtx.contactoCorreoValidado ?? valorInicialCorreoPersonal()
    }
    if (!telefonoOtpPendiente.value && !telefonoDigitosLocal.value.trim()) {
      telefonoDigitosLocal.value =
        alumnoCtx.contactoTelefonoValidado ?? valorInicialTelefonoDigitos()
      sincronizarTelefonoDraftDesdeDigitos()
    }
  }
  aplicarMarcasContactoPersistidas()
  void nextTick(() => {
    restaurandoContacto.value = false
  })
}

async function hidratarTycDesdeTabla(): Promise<void> {
  try {
    await Promise.all([tycStore.ensureLoaded(), periodoActivo.ensureLoaded()])
    const ctx = contextoMolAuditoria({
      rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
      codcli: pickCampoAlumno(fuente.codcliMostrado.value),
      nombreAlumno: pickCampoAlumno(fuente.nombreMostrado.value),
      anioPeriodo: periodoActivo.anio,
      semestrePeriodo: periodoActivo.semestre,
      esMock: false,
    })
    if (!ctx.codcli || ctx.anioPeriodo == null || ctx.semestrePeriodo == null) {
      return
    }
    const { data } = await consultarUltimaTycRespuestaAlumno({
      codcli: ctx.codcli,
      anioPeriodo: ctx.anioPeriodo,
      semestrePeriodo: ctx.semestrePeriodo,
    })
    const saltarPorDb = debeSaltarPasoTyc({
      aceptadoEnSesion: false,
      ultimaRespuesta: data,
      tycUpdatedAtActual: tycStore.documento?.updated_at ?? null,
    })
    if (saltarPorDb) {
      alumnoCtx.acceptTyc()
      paso.value = 'contacto'
      sincronizarDraftsContactoDesdeFuente()
      return
    }
    // Aceptación solo-mock o sessionStorage inválido: forzar paso TyC.
    if (alumnoCtx.tycAccepted) {
      alumnoCtx.rejectTyc()
    }
    paso.value = 'tyc'
  } finally {
    resolviendoTyc.value = false
  }
}

function resetCorreoOtpUi() {
  clearCorreoOtpCountdown()
  correoOtpValidezDesdeMs.value = null
  otpUi.resetCorreoOtp()
  limpiarCanalOtpEnCurso('correo')
}

/** Actualizado cada segundo mientras hay OTP pendiente; fuerza recomputo del contador. */
function clearCorreoOtpCountdown() {
  if (correoOtpCountdownIntervalId !== null) {
    clearInterval(correoOtpCountdownIntervalId)
    correoOtpCountdownIntervalId = null
  }
}

function segundosValidezRestantes(desdeMs: number | null, duracionSeg: number, ahoraMs: number): number {
  if (desdeMs == null) return 0
  const elapsed = Math.floor((ahoraMs - desdeMs) / 1000)
  return Math.max(0, duracionSeg - elapsed)
}

function formatearMmSs(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const sec = segundos % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** Marca de tiempo del último envío/reenvío OTP correo (reinicia el contador de validez). */
const correoOtpValidezDesdeMs = ref<number | null>(null)
/** Marca de tiempo del último envío/reenvío OTP teléfono (reinicia el contador de validez). */
const telefonoOtpValidezDesdeMs = ref<number | null>(null)

const correoOtpAhoraMs = computed(() => {
  if (correoOtpTick.value > 0) return correoOtpTick.value
  if (correoOtpPendiente.value || correoOtpProximoReintentoAt.value != null) return Date.now()
  return 0
})

function segundosRestantesCorreoOtp(ahoraMs: number): number {
  const iso = correoOtpExpiresAt.value
  if (iso) {
    const fin = Date.parse(iso)
    if (!Number.isNaN(fin)) return Math.max(0, Math.ceil((fin - ahoraMs) / 1000))
  }
  return segundosValidezRestantes(
    correoOtpValidezDesdeMs.value,
    otpConfig.emailSegundos,
    ahoraMs,
  )
}

const correoOtpCountdownMmSs = computed(() => {
  if (!correoOtpPendiente.value || correoOtpValidezDesdeMs.value == null) return '00:00'
  return formatearMmSs(segundosRestantesCorreoOtp(correoOtpAhoraMs.value))
})

const correoOtpCountdownAgotado = computed(() => {
  if (!correoOtpPendiente.value || correoOtpValidezDesdeMs.value == null) return false
  return segundosRestantesCorreoOtp(correoOtpAhoraMs.value) <= 0
})

function segundosRestantesHastaTimestamp(at: number | null, nowMs: number): number {
  if (at == null) return 0
  return Math.max(0, Math.ceil((at - nowMs) / 1000))
}

const correoOtpReintentoMmSs = computed(() => {
  const s = segundosRestantesHastaTimestamp(correoOtpProximoReintentoAt.value, correoOtpAhoraMs.value)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
})

const correoOtpReintentoBloqueado = computed(() => {
  const at = correoOtpProximoReintentoAt.value
  if (at == null) return false
  return correoOtpAhoraMs.value < at
})

watch(modalContacto, (modal, prev) => {
  logMockContactoOtp('ui.modalContacto', { prev, modal })
})

watch(
  () => ({
    bloqueado: correoOtpReintentoBloqueado.value,
    proximoReintentoAt: correoOtpProximoReintentoAt.value,
    tick: correoOtpTick.value,
    pendiente: correoOtpPendiente.value,
    validezMmSs: correoOtpCountdownMmSs.value,
    reintentoMmSs: correoOtpReintentoMmSs.value,
    expiresAt: correoOtpExpiresAt.value,
  }),
  (v) => logMockContactoOtp('ui.correo.estado', v),
)

watch(
  () => ({
    loaded: otpConfig.loaded,
    emailSegundos: otpConfig.emailSegundos,
    smsSegundos: otpConfig.smsSegundos,
    emailReintentoSegundos: otpConfig.emailReintentoSegundos,
    smsReintentoSegundos: otpConfig.smsReintentoSegundos,
    config: otpConfig.config,
  }),
  (v) => logMockContactoOtp('ui.config', v),
  { immediate: true },
)

watch(
  () =>
    [
      correoOtpPendiente.value,
      correoOtpValidezDesdeMs.value,
      correoOtpProximoReintentoAt.value,
    ] as const,
  () => {
    clearCorreoOtpCountdown()
    const reintentoAt = correoOtpProximoReintentoAt.value
    const validezDesde = correoOtpValidezDesdeMs.value
    const needsTick =
      (correoOtpPendiente.value && validezDesde != null) ||
      (reintentoAt != null && Date.now() < reintentoAt)
    if (!needsTick) return
    correoOtpTick.value = Date.now()
    correoOtpCountdownIntervalId = setInterval(() => {
      correoOtpTick.value = Date.now()
      const now = correoOtpTick.value
      const expiryActive =
        correoOtpPendiente.value &&
        correoOtpValidezDesdeMs.value != null &&
        segundosRestantesCorreoOtp(now) > 0
      const reintentoActive =
        correoOtpProximoReintentoAt.value != null && now < correoOtpProximoReintentoAt.value
      if (!expiryActive && !reintentoActive) clearCorreoOtpCountdown()
    }, 1000)
  },
)

function onPageShowRestaurarContacto(e: PageTransitionEvent) {
  logMockContactoOtp('ui.pageshow', { persisted: e.persisted })
  if (!e.persisted) return
  aplicarOtpEnCursoGuardado()
  if (paso.value === 'contacto') aplicarMarcasContactoPersistidas()
  void otpConfig.ensureLoaded(true)
}

onMounted(() => {
  logMockContactoOtp('ui.onMounted', {
    paso: paso.value,
    modalContacto: modalContacto.value,
    correoPendiente: correoOtpPendiente.value,
    telefonoPendiente: telefonoOtpPendiente.value,
  })
  aplicarOtpEnCursoGuardado()
  if (paso.value === 'contacto') aplicarMarcasContactoPersistidas()
  void otpConfig.ensureLoaded(true).then(() => {
    logMockContactoOtp('ui.onMounted.configCargada', {
      emailSegundos: otpConfig.emailSegundos,
      emailReintentoSegundos: otpConfig.emailReintentoSegundos,
    })
  })
  void periodoActivo.ensureLoaded()
  void hidratarTycDesdeTabla()
  window.addEventListener('pageshow', onPageShowRestaurarContacto)
})

onUnmounted(() => {
  window.removeEventListener('pageshow', onPageShowRestaurarContacto)
  clearCorreoOtpCountdown()
  clearTelefonoOtpCountdown()
})

function clearTelefonoOtpCountdown() {
  if (telefonoOtpCountdownIntervalId !== null) {
    clearInterval(telefonoOtpCountdownIntervalId)
    telefonoOtpCountdownIntervalId = null
  }
}

function segundosRestantesReintentoSms(nowMs: number): number {
  return segundosRestantesHastaTimestamp(telefonoOtpProximoReintentoAt.value, nowMs)
}

function segundosRestantesTelefonoOtp(ahoraMs: number): number {
  const iso = telefonoOtpExpiresAt.value
  if (iso) {
    const fin = Date.parse(iso)
    if (!Number.isNaN(fin)) return Math.max(0, Math.ceil((fin - ahoraMs) / 1000))
  }
  return segundosValidezRestantes(
    telefonoOtpValidezDesdeMs.value,
    otpConfig.smsSegundos,
    ahoraMs,
  )
}

function identidadOtpAlumno(): { usuarioConexion: string; emailInstitucional: string } | null {
  const usuario = auth.username?.trim() ?? ''
  if (!usuario) return null
  const instMostrado = fuente.correoInstitucionalMostrado.value
  const inst =
    instMostrado && instMostrado !== '—'
      ? instMostrado.trim()
      : emailInstitucionalDesdeUsername(usuario)
  if (!inst) return null
  return { usuarioConexion: usuario, emailInstitucional: inst }
}

const telefonoOtpAhoraMs = computed(() => {
  if (telefonoOtpTick.value > 0) return telefonoOtpTick.value
  if (telefonoOtpPendiente.value || telefonoOtpProximoReintentoAt.value != null) return Date.now()
  return 0
})

const telefonoOtpCountdownMmSs = computed(() => {
  if (!telefonoOtpPendiente.value || telefonoOtpValidezDesdeMs.value == null) return '00:00'
  return formatearMmSs(segundosRestantesTelefonoOtp(telefonoOtpAhoraMs.value))
})

const telefonoOtpCountdownAgotado = computed(() => {
  if (!telefonoOtpPendiente.value || telefonoOtpValidezDesdeMs.value == null) return false
  return segundosRestantesTelefonoOtp(telefonoOtpAhoraMs.value) <= 0
})

const telefonoOtpReintentoMmSs = computed(() => {
  const s = segundosRestantesReintentoSms(telefonoOtpAhoraMs.value)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
})

const telefonoOtpReintentoBloqueado = computed(() => {
  const at = telefonoOtpProximoReintentoAt.value
  if (at == null) return false
  return telefonoOtpAhoraMs.value < at
})

watch(
  () => ({
    bloqueado: telefonoOtpReintentoBloqueado.value,
    proximoReintentoAt: telefonoOtpProximoReintentoAt.value,
    tick: telefonoOtpTick.value,
    pendiente: telefonoOtpPendiente.value,
    validezMmSs: telefonoOtpCountdownMmSs.value,
    reintentoMmSs: telefonoOtpReintentoMmSs.value,
    expiresAt: telefonoOtpExpiresAt.value,
  }),
  (v) => logMockContactoOtp('ui.telefono.estado', v),
)

watch(
  () =>
    [
      telefonoOtpPendiente.value,
      telefonoOtpValidezDesdeMs.value,
      telefonoOtpProximoReintentoAt.value,
    ] as const,
  () => {
    clearTelefonoOtpCountdown()
    const reintentoAt = telefonoOtpProximoReintentoAt.value
    const validezDesde = telefonoOtpValidezDesdeMs.value
    const needsTick =
      (telefonoOtpPendiente.value && validezDesde != null) ||
      (reintentoAt != null && Date.now() < reintentoAt)
    if (!needsTick) return
    telefonoOtpTick.value = Date.now()
    telefonoOtpCountdownIntervalId = setInterval(() => {
      telefonoOtpTick.value = Date.now()
      const now = telefonoOtpTick.value
      const expiryActive =
        telefonoOtpPendiente.value &&
        telefonoOtpValidezDesdeMs.value != null &&
        segundosRestantesTelefonoOtp(now) > 0
      const reintentoActive =
        telefonoOtpProximoReintentoAt.value != null && now < telefonoOtpProximoReintentoAt.value
      if (!expiryActive && !reintentoActive) clearTelefonoOtpCountdown()
    }, 1000)
  },
)

function resetTelefonoOtpUi() {
  clearTelefonoOtpCountdown()
  telefonoOtpValidezDesdeMs.value = null
  otpUi.resetTelefonoOtp()
  limpiarCanalOtpEnCurso('telefono')
}

function aplicarOtpEnCursoGuardado(): void {
  const guardado = leerOtpEnCurso()
  if (!guardado.correo && !guardado.telefono) return
  restaurandoContacto.value = true
  if (guardado.correo) {
    emailDraft.value = guardado.correo.destino
    otpUi.correoOtpPendiente = true
    otpUi.correoOtpExpiresAt = guardado.correo.expiresAt
    otpUi.correoOtpProximoReintentoAt = guardado.correo.proximoReintentoAt
    otpUi.correoOtpEnviosRealizados = guardado.correo.envios
    otpUi.correoOtpIntentosFallidos = guardado.correo.intentosFallidos
    correoOtpValidezDesdeMs.value = guardado.correo.validezDesdeMs
  }
  if (guardado.telefono) {
    telefonoDigitosLocal.value = guardado.telefono.destino
    sincronizarTelefonoDraftDesdeDigitos()
    otpUi.telefonoOtpPendiente = true
    otpUi.telefonoOtpExpiresAt = guardado.telefono.expiresAt
    otpUi.telefonoOtpProximoReintentoAt = guardado.telefono.proximoReintentoAt
    otpUi.telefonoOtpEnviosRealizados = guardado.telefono.envios
    otpUi.telefonoOtpIntentosFallidos = guardado.telefono.intentosFallidos
    telefonoOtpValidezDesdeMs.value = guardado.telefono.validezDesdeMs
  }
  void nextTick(() => {
    restaurandoContacto.value = false
  })
}

function persistirCorreoOtpEnCurso(): void {
  if (!correoOtpPendiente.value || correoOtpValidezDesdeMs.value == null || !correoOtpExpiresAt.value) {
    return
  }
  guardarCanalOtpEnCurso('correo', {
    destino: emailDraft.value.trim(),
    validezDesdeMs: correoOtpValidezDesdeMs.value,
    expiresAt: correoOtpExpiresAt.value,
    proximoReintentoAt: correoOtpProximoReintentoAt.value,
    envios: correoOtpEnviosRealizados.value,
    intentosFallidos: correoOtpIntentosFallidos.value,
  })
}

function persistirTelefonoOtpEnCurso(): void {
  if (
    !telefonoOtpPendiente.value ||
    telefonoOtpValidezDesdeMs.value == null ||
    !telefonoOtpExpiresAt.value
  ) {
    return
  }
  guardarCanalOtpEnCurso('telefono', {
    destino: telefonoDigitosLocal.value,
    validezDesdeMs: telefonoOtpValidezDesdeMs.value,
    expiresAt: telefonoOtpExpiresAt.value,
    proximoReintentoAt: telefonoOtpProximoReintentoAt.value,
    envios: telefonoOtpEnviosRealizados.value,
    intentosFallidos: telefonoOtpIntentosFallidos.value,
  })
}

watch(
  () =>
    [
      paso.value,
      datosCargando.value,
      fuente.codcliMostrado.value,
      correoPersonalMostrado.value,
      telefonoMostrado.value,
    ] as const,
  ([p, loading], oldVal) => {
    if (p !== 'contacto' || loading) return

    const prevLoading = oldVal?.[1]
    const acabaDeTerminarCarga = prevLoading === true && loading === false
    if (acabaDeTerminarCarga) {
      sincronizarDraftsContactoDesdeFuente({ forzarResetValidacion: true })
      return
    }

    sincronizarDraftsContactoDesdeFuente()
  },
  { immediate: true },
)

watch(emailDraft, () => {
  if (paso.value !== 'contacto' || restaurandoContacto.value) return
  if (correoPersistidoCoincide(emailDraft.value)) {
    correoValidadoOk.value = true
    return
  }
  correoValidadoOk.value = false
  alumnoCtx.limpiarCorreoValidado()
  otpUi.resetCorreoOtpEnvios()
  resetCorreoOtpUi()
})

watch(telefonoDigitosLocal, () => {
  if (paso.value !== 'contacto' || restaurandoContacto.value) return
  sincronizarTelefonoDraftDesdeDigitos()
  if (telefonoPersistidoCoincide(telefonoDigitosLocal.value)) {
    telefonoValidadoOk.value = true
    return
  }
  telefonoValidadoOk.value = false
  alumnoCtx.limpiarTelefonoValidado()
  otpUi.resetTelefonoOtpEnvios()
  resetTelefonoOtpUi()
})

/** Solo dígitos, máximo 6 (código OTP correo). */
function normalizarCodigoOtpSoloDigitos(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6)
}

/** Input nativo: el `Input` con useVModel(passive) no resincroniza el DOM al filtrar. */
function onCorreoOtpCodigoDomInput(e: Event) {
  const el = e.target as HTMLInputElement
  const next = normalizarCodigoOtpSoloDigitos(el.value)
  correoOtpCodigo.value = next
  if (el.value !== next) el.value = next
}

function onCorreoOtpCodigoKeydown(e: KeyboardEvent) {
  if (correoOtpVerificando.value) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const nav = ['Backspace', 'Delete', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (nav.includes(e.key)) return
  if (e.key === 'Enter') return
  if (/^[0-9]$/.test(e.key)) return
  e.preventDefault()
}

function onTelefonoDigitosDomInput(e: Event) {
  const el = e.target as HTMLInputElement
  const next = extraerDigitosTelefonoChile(el.value)
  telefonoDigitosLocal.value = next
  if (el.value !== next) el.value = next
}

function onTelefonoDigitosKeydown(e: KeyboardEvent) {
  if (datosCargando.value) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const nav = ['Backspace', 'Delete', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (nav.includes(e.key)) return
  if (e.key === 'Enter') return
  if (/^[0-9]$/.test(e.key)) return
  e.preventDefault()
}

function emailTieneFormatoValido(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

const emailEsInstitucional = computed(() => esCorreoDominioUniacc(emailDraft.value))

const emailFormatoInvalido = computed(() => {
  const em = emailDraft.value.trim()
  if (!emailTocado.value || !em || emailEsInstitucional.value) return false
  return !emailTieneFormatoValido(em)
})

const puedeEnviarCorreoOtp = computed(() => {
  const em = emailDraft.value.trim()
  return em.length > 0 && emailTieneFormatoValido(em) && !emailEsInstitucional.value
})

const telefonoFormatoInvalido = computed(() => {
  if (!telefonoTocado.value) return false
  const digitos = telefonoDigitosLocal.value
  if (!digitos) return false
  return !telefonoChileEsValido(normalizarTelefonoChile(digitos))
})

const puedeEnviarTelefonoOtp = computed(() => {
  return telefonoChileEsValido(normalizarTelefonoChile(telefonoDigitosLocal.value))
})

function pickCampoAlumno(val: string): string | null {
  const t = val.trim()
  if (!t || t === '—') return null
  return t
}

async function registrarEventoContactoOtp(
  canal: ContactoOtpCanalLog,
  evento: ContactoOtpEventoLog,
  contactoValor: string,
  numeroEnvio?: number,
) {
  const ctx = contextoMolAuditoria({
    rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
    codcli: pickCampoAlumno(fuente.codcliMostrado.value),
    nombreAlumno: pickCampoAlumno(fuente.nombreMostrado.value),
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
    esMock: false,
  })

  const err = await registrarLogContactoOtp({
    canal,
    evento,
    numeroEnvio,
    contactoValor,
    rutAlumno: ctx.rutAlumno,
    codcli: ctx.codcli,
    nombreAlumno: ctx.nombreAlumno,
    anioPeriodo: ctx.anioPeriodo,
    semestrePeriodo: ctx.semestrePeriodo,
    periodoLabel: ctx.periodoLabel,
    esMock: ctx.esMock,
    sesionId: ctx.sesionId,
    urlOrigen: ctx.urlOrigen,
  })
  if (err) console.warn('[contactoOtpAudit]', err)
}

function cancelarContinuarSinOtpCorreo() {
  mostrarContinuarSinOtpCorreo.value = false
}

function aceptarContinuarSinOtpCorreo() {
  if (esCorreoDominioUniacc(emailDraft.value)) {
    mostrarContinuarSinOtpCorreo.value = false
    errorCorreo.value = MENSAJE_CORREO_PERSONAL_UNIACC
    return
  }
  mostrarContinuarSinOtpCorreo.value = false
  alumnoCtx.marcarCorreoValidado(emailDraft.value)
  correoValidadoOk.value = true
  logMockContactoOtp('ui.correo.continuarSinOtp', { email: emailDraft.value.trim() })
  void registrarEventoContactoOtp(
    'correo',
    'continuar_sin_otp',
    emailDraft.value.trim(),
  )
  resetCorreoOtpUi()
  otpUi.cerrarModalCorreo()
}

function solicitarContinuarSinOtpCorreo() {
  logMockContactoOtp('ui.correo.solicitarContinuarSinOtp', {
    enviosRealizados: correoOtpEnviosRealizados.value,
    maxEnvios: CONTACTO_OTP_MAX_ENVIOS,
  })
  mostrarContinuarSinOtpCorreo.value = true
}

function cancelarContinuarSinOtpTelefono() {
  mostrarContinuarSinOtpTelefono.value = false
}

function aceptarContinuarSinOtpTelefono() {
  mostrarContinuarSinOtpTelefono.value = false
  alumnoCtx.marcarTelefonoValidado(telefonoDigitosLocal.value)
  telefonoValidadoOk.value = true
  logMockContactoOtp('ui.telefono.continuarSinOtp', { telefono: telefonoDraft.value.trim() })
  void registrarEventoContactoOtp(
    'telefono',
    'continuar_sin_otp',
    telefonoDraft.value.trim(),
  )
  resetTelefonoOtpUi()
  otpUi.cerrarModalTelefono()
}

function solicitarContinuarSinOtpTelefono() {
  logMockContactoOtp('ui.telefono.solicitarContinuarSinOtp', {
    enviosRealizados: telefonoOtpEnviosRealizados.value,
    maxEnvios: CONTACTO_OTP_MAX_ENVIOS,
  })
  mostrarContinuarSinOtpTelefono.value = true
}

async function enviarCodigoCorreoOtp() {
  logMockContactoOtp('ui.correo.enviar.click', {
    reintentoBloqueado: correoOtpReintentoBloqueado.value,
    emailReintentoSegundos: otpConfig.emailReintentoSegundos,
    emailSegundos: otpConfig.emailSegundos,
    enviosRealizados: correoOtpEnviosRealizados.value,
  })
  errorCorreo.value = null
  if (
    correoOtpPendiente.value &&
    correoOtpEnviosRealizados.value >= CONTACTO_OTP_MAX_ENVIOS
  ) {
    solicitarContinuarSinOtpCorreo()
    return
  }
  if (correoOtpReintentoBloqueado.value) {
    errorCorreo.value = `Espera ${correoOtpReintentoMmSs.value} para reenviar el correo.`
    logMockContactoOtp('ui.correo.enviar.bloqueado', { mmSs: correoOtpReintentoMmSs.value })
    return
  }
  const em = emailDraft.value.trim()
  if (!em) {
    errorCorreo.value = 'Ingresa tu correo personal.'
    return
  }
  if (!emailTieneFormatoValido(em)) {
    errorCorreo.value = 'El correo personal no tiene un formato válido.'
    return
  }
  if (esCorreoDominioUniacc(em)) {
    errorCorreo.value = MENSAJE_CORREO_PERSONAL_UNIACC
    return
  }
  const identidad = identidadOtpAlumno()
  if (!identidad) {
    errorCorreo.value = 'No se pudo identificar la sesión. Vuelve a ingresar.'
    return
  }

  correoOtpEnviando.value = true
  try {
    const resultado = await solicitarOtpEmailCorreoPersonal({
      ...identidad,
      emailPersonal: em,
      urlOrigen: typeof window !== 'undefined' ? window.location.href : null,
    })
    if (!resultado.ok) {
      errorCorreo.value = resultado.message
      logMockContactoOtp('ui.correo.enviar.error', { message: resultado.message })
      return
    }
    const ahora = Date.now()
    correoOtpPendiente.value = true
    correoOtpIntentosFallidos.value = 0
    correoOtpValidezDesdeMs.value = ahora
    correoOtpExpiresAt.value = resultado.expiresAt
    correoOtpProximoReintentoAt.value =
      ahora + otpConfig.emailReintentoSegundos * 1000
    correoOtpTick.value = ahora
    correoOtpCodigo.value = ''
    correoOtpEnviosRealizados.value += 1
    persistirCorreoOtpEnCurso()
    const numEnvio = correoOtpEnviosRealizados.value
    void registrarEventoContactoOtp(
      'correo',
      numEnvio === 1 ? 'envio' : 'reenvio',
      em,
      numEnvio,
    )
    logMockContactoOtp('ui.correo.enviar.ok', {
      expiresAt: correoOtpExpiresAt.value,
      reenvioCooldownSegundos: otpConfig.emailReintentoSegundos,
      proximoReintentoAt: correoOtpProximoReintentoAt.value,
      enviosRealizados: correoOtpEnviosRealizados.value,
    })
    toast.success('Código enviado a tu correo. Revisa tu bandeja de entrada. (Si no lo ves, revisa en el spam)')
  } finally {
    correoOtpEnviando.value = false
  }
}

async function confirmarCodigoCorreoOtp() {
  logMockContactoOtp('ui.correo.confirmar.click', {
    codigoLen: correoOtpCodigo.value.replace(/\D/g, '').length,
    intentosFallidos: correoOtpIntentosFallidos.value,
  })
  errorCorreo.value = null
  const codigo = correoOtpCodigo.value.replace(/\D/g, '')
  if (codigo.length !== 6) {
    errorCorreo.value = 'Ingresa el código de 6 dígitos.'
    return
  }
  if (correoOtpCountdownAgotado.value) {
    errorCorreo.value = 'Código caducado. Reenvía el correo.'
    return
  }
  const identidad = identidadOtpAlumno()
  if (!identidad) {
    errorCorreo.value = 'No se pudo identificar la sesión. Vuelve a ingresar.'
    return
  }

  correoOtpVerificando.value = true
  try {
    const resultado = await verificarOtpEmailCorreoPersonal({
      ...identidad,
      emailPersonal: emailDraft.value.trim(),
      codigo,
      urlOrigen: typeof window !== 'undefined' ? window.location.href : null,
    })
    if (!resultado.ok) {
      correoOtpIntentosFallidos.value += 1
      persistirCorreoOtpEnCurso()
      errorCorreo.value = resultado.message
      logMockContactoOtp('ui.correo.confirmar.incorrecto', {
        message: resultado.message,
      })
      void registrarEventoContactoOtp(
        'correo',
        'verificar_fallido',
        emailDraft.value.trim(),
      )
      return
    }
    alumnoCtx.marcarCorreoValidado(emailDraft.value)
    correoValidadoOk.value = true
    void registrarEventoContactoOtp('correo', 'verificar_ok', emailDraft.value.trim())
    logMockContactoOtp('ui.correo.confirmar.ok')
    resetCorreoOtpUi()
    otpUi.cerrarModalCorreo()
  } finally {
    correoOtpVerificando.value = false
  }
}

function onTelefonoOtpCodigoDomInput(e: Event) {
  const el = e.target as HTMLInputElement
  const next = normalizarCodigoOtpSoloDigitos(el.value)
  telefonoOtpCodigo.value = next
  if (el.value !== next) el.value = next
}

async function enviarCodigoTelefonoOtp() {
  logMockContactoOtp('ui.telefono.enviar.click', {
    reintentoBloqueado: telefonoOtpReintentoBloqueado.value,
    smsReintentoSegundos: otpConfig.smsReintentoSegundos,
    smsSegundos: otpConfig.smsSegundos,
    enviosRealizados: telefonoOtpEnviosRealizados.value,
  })
  errorTelefono.value = null
  if (
    telefonoOtpPendiente.value &&
    telefonoOtpEnviosRealizados.value >= CONTACTO_OTP_MAX_ENVIOS
  ) {
    solicitarContinuarSinOtpTelefono()
    return
  }
  if (telefonoOtpReintentoBloqueado.value) {
    errorTelefono.value = `Espera ${telefonoOtpReintentoMmSs.value} para reenviar el SMS.`
    logMockContactoOtp('ui.telefono.enviar.bloqueado', { mmSs: telefonoOtpReintentoMmSs.value })
    return
  }
  const tel = telefonoDraft.value.trim()
  if (!tel) {
    errorTelefono.value = 'Ingresa tu teléfono móvil (celular).'
    return
  }
  if (!telefonoChileEsValido(tel)) {
    errorTelefono.value = `El celular debe tener 9 dígitos después de ${TELEFONO_CHILE_PREFIJO}.`
    return
  }
  const identidad = identidadOtpAlumno()
  if (!identidad) {
    errorTelefono.value = 'No se pudo identificar la sesión. Vuelve a ingresar.'
    return
  }

  telefonoOtpEnviando.value = true
  try {
    const resultado = await solicitarOtpSmsTelefono({
      ...identidad,
      telefono: tel,
      urlOrigen: typeof window !== 'undefined' ? window.location.href : null,
    })
    if (!resultado.ok) {
      errorTelefono.value = resultado.message
      logMockContactoOtp('ui.telefono.enviar.error', { message: resultado.message })
      return
    }
    if ('validadoSinSms' in resultado) {
      alumnoCtx.marcarTelefonoValidado(telefonoDigitosLocal.value)
      telefonoValidadoOk.value = true
      void registrarEventoContactoOtp('telefono', 'verificar_ok', tel)
      logMockContactoOtp('ui.telefono.validado_sin_sms')
      resetTelefonoOtpUi()
      otpUi.cerrarModalTelefono()
      return
    }
    const ahora = Date.now()
    telefonoOtpPendiente.value = true
    telefonoOtpIntentosFallidos.value = 0
    telefonoOtpValidezDesdeMs.value = ahora
    telefonoOtpExpiresAt.value = resultado.expiresAt
    telefonoOtpProximoReintentoAt.value = ahora + otpConfig.smsReintentoSegundos * 1000
    telefonoOtpTick.value = ahora
    telefonoOtpCodigo.value = ''
    telefonoOtpEnviosRealizados.value += 1
    persistirTelefonoOtpEnCurso()
    const numEnvio = telefonoOtpEnviosRealizados.value
    void registrarEventoContactoOtp(
      'telefono',
      numEnvio === 1 ? 'envio' : 'reenvio',
      tel,
      numEnvio,
    )
    logMockContactoOtp('ui.telefono.enviar.ok', {
      expiresAt: telefonoOtpExpiresAt.value,
      reenvioCooldownSegundos: otpConfig.smsReintentoSegundos,
      proximoReintentoAt: telefonoOtpProximoReintentoAt.value,
      enviosRealizados: telefonoOtpEnviosRealizados.value,
    })
    toast.success('Código enviado por SMS a tu teléfono móvil (celular).')
  } finally {
    telefonoOtpEnviando.value = false
  }
}

async function confirmarCodigoTelefonoOtp() {
  logMockContactoOtp('ui.telefono.confirmar.click', {
    codigoLen: telefonoOtpCodigo.value.replace(/\D/g, '').length,
    intentosFallidos: telefonoOtpIntentosFallidos.value,
  })
  errorTelefono.value = null
  const codigo = telefonoOtpCodigo.value.replace(/\D/g, '')
  if (codigo.length !== 6) {
    errorTelefono.value = 'Ingresa el código de 6 dígitos recibido por SMS.'
    return
  }
  if (telefonoOtpCountdownAgotado.value) {
    errorTelefono.value = 'Código caducado. Reenvía el SMS.'
    return
  }
  const identidad = identidadOtpAlumno()
  if (!identidad) {
    errorTelefono.value = 'No se pudo identificar la sesión. Vuelve a ingresar.'
    return
  }

  telefonoOtpVerificando.value = true
  try {
    const resultado = await verificarOtpSmsTelefono({
      ...identidad,
      telefono: telefonoDraft.value.trim(),
      codigo,
      urlOrigen: typeof window !== 'undefined' ? window.location.href : null,
    })
    if (!resultado.ok) {
      telefonoOtpIntentosFallidos.value += 1
      persistirTelefonoOtpEnCurso()
      errorTelefono.value = resultado.message
      logMockContactoOtp('ui.telefono.confirmar.incorrecto', {
        message: resultado.message,
      })
      void registrarEventoContactoOtp(
        'telefono',
        'verificar_fallido',
        telefonoDraft.value.trim(),
      )
      return
    }
    alumnoCtx.marcarTelefonoValidado(telefonoDigitosLocal.value)
    telefonoValidadoOk.value = true
    void registrarEventoContactoOtp('telefono', 'verificar_ok', telefonoDraft.value.trim())
    logMockContactoOtp('ui.telefono.confirmar.ok')
    resetTelefonoOtpUi()
    otpUi.cerrarModalTelefono()
  } finally {
    telefonoOtpVerificando.value = false
  }
}

function validarTelefono() {
  if (!telefonoOtpPendiente.value) {
    void enviarCodigoTelefonoOtp()
    return
  }
  void confirmarCodigoTelefonoOtp()
}

function onTycAceptado() {
  paso.value = 'contacto'
  sincronizarDraftsContactoDesdeFuente()
}

const planPagosRematricula = ref<PlanPagosMvRow | null>(null)

async function cargarPlanPagosRematricula(): Promise<PlanPagosMvRow | null> {
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  const anio = periodoActivo.anio
  const sem = periodoActivo.semestre
  if (!codcli || anio == null || sem == null) return null
  const { data, error } = await fetchPlanPagosMvByCodcli({
    codcli,
    anioMatricula: anio,
    periodoMatricula: sem,
  })
  if (error || !data) return null
  planPagosRematricula.value = data
  return data
}

async function irPostContacto(): Promise<void> {
  if (!puedeContinuarDesdeContacto.value) return
  emailConfirmado.value = emailDraft.value.trim()
  telefonoConfirmado.value = telefonoDraft.value.trim()
  const plan = planPagosRematricula.value ?? (await cargarPlanPagosRematricula())
  if (plan && esPropioSostenedor(plan.es_responsable_financiero)) {
    paso.value = 'discapacidad'
    return
  }
  if (alumnoCtx.apoderadoBloqueo) {
    paso.value = 'apoderado'
    return
  }
  if (alumnoCtx.apoderadoConfirmado === true) {
    paso.value = 'discapacidad'
    return
  }
  paso.value = 'apoderado'
}

const puedeContinuarDesdeContacto = computed(() => correoValidadoOk.value && telefonoValidadoOk.value)

function contactoCambioRespectoErp(): boolean {
  const mail = emailDraft.value.trim().toLowerCase()
  const fonoDigits = fonoactParaSp(telefonoDraft.value)
  return mail !== baselineMailErp.value || fonoDigits !== baselineFonoDigitsErp.value
}

async function maybeActualizarDatosErp(): Promise<void> {
  if (erpSyncIntentado.value) return
  if (!correoValidadoOk.value || !telefonoValidadoOk.value) return
  if (!contactoCambioRespectoErp()) return

  // MT_CLIENT.CODCLI = RUT sin DV (no el codcli Excel del plan de pagos)
  const rut = pickCampoAlumno(fuente.rutMostrado.value)
  const codcli = rut ? codcliMtClientDesdeRut(rut) : ''
  if (!codcli) {
    console.warn('[actualiza-datos-mol] sin RUT→CODCLI; se omite SP')
    return
  }

  const mail = emailDraft.value.trim()
  const fonoact = fonoactParaSp(telefonoDraft.value)
  if (!mail || !fonoact) {
    console.warn('[actualiza-datos-mol] mail/fono incompletos; se omite SP')
    return
  }

  erpSyncIntentado.value = true
  try {
    const res = await actualizarDatosMolErp({ codcli, fonoact, mail })
    if (!res.ok) {
      console.warn('[actualiza-datos-mol] SP no OK (alumno avanza igual):', {
        code: res.code,
        message: res.message,
        error: res.error,
        syncStatus: res.syncStatus,
      })
    } else {
      logMockContactoOtp('erp.actualizaDatosMol.ok', {
        codcli,
        ambiente: res.params?.ambiente,
        syncStatus: res.syncStatus,
        duracionMs: res.duracionMs,
      })
    }
  } catch (e) {
    console.warn('[actualiza-datos-mol] error de red (alumno avanza igual):', e)
  }
}

watch(
  () => correoValidadoOk.value && telefonoValidadoOk.value,
  (listo) => {
    if (restaurandoContacto.value) return
    if (listo && paso.value === 'contacto' && !datosCargando.value) {
      void maybeActualizarDatosErp()
      irPostContacto()
    }
  },
)
</script>

<template>
  <div class="space-y-6">
    <Alert v-if="alumnoMnp.cantidadRegistros > 1" variant="default" class="border-amber-200 bg-amber-50 text-amber-950">
      <AlertTriangle class="h-4 w-4 text-amber-700" />
      <AlertTitle>Varios registros</AlertTitle>
      <AlertDescription>
        Hay {{ alumnoMnp.cantidadRegistros }} filas en mnp_datos_alumnos para tu correo institucional. Se muestran
        datos de la primera; el resto queda disponible en el store (array <code class="rounded bg-amber-100 px-1">filas</code>).
      </AlertDescription>
    </Alert>

    <Alert v-if="alumnoMnp.error && !auth.mvUsuario && !fuente.enModoMockSeleccion" variant="destructive">
      <AlertTitle>Error al cargar datos del alumno</AlertTitle>
      <AlertDescription>{{ alumnoMnp.error }}</AlertDescription>
    </Alert>

    <p v-if="datosCargando || resolviendoTyc" class="text-sm text-muted-foreground">Cargando datos del alumno…</p>

    <MatriculaAlumnoTyCStep v-else-if="paso === 'tyc'" @aceptado="onTycAceptado" />

    <!-- Paso contacto: validar correo personal y teléfono -->
    <template v-else-if="paso === 'contacto'">
      <Card class="shadow-md">
        <CardHeader>
          <CardTitle>Validación de contacto</CardTitle>
          <ol class="mt-1 list-none space-y-3 p-0">
            <li class="flex items-start gap-3">
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-uniacc-orange text-xs font-bold text-white"
                aria-hidden="true"
              >1</span>
              <span>
                <span class="block text-sm font-semibold text-zinc-900">Correo personal</span>
                <span class="mt-0.5 block text-sm leading-relaxed text-zinc-600">Te enviamos un código de 6 dígitos.</span>
              </span>
            </li>
            <li class="flex items-start gap-3">
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-uniacc-orange text-xs font-bold text-white"
                aria-hidden="true"
              >2</span>
              <span>
                <span class="block text-sm font-semibold text-zinc-900">Celular</span>
                <span class="mt-0.5 block text-sm leading-relaxed text-zinc-600">Te enviamos un código de 6 dígitos.</span>
              </span>
            </li>
          </ol>
          <p class="text-xs leading-relaxed text-zinc-500">
            Si cambias un dato ya validado, hay que validarlo de nuevo.
          </p>
        </CardHeader>
        <CardContent class="space-y-6">
          <div
            class="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0 flex-1 space-y-2">
              <Label class="text-base">Correo personal</Label>
              <p class="truncate text-sm font-medium text-foreground" :title="textoCorreoResumen">
                {{ textoCorreoResumen }}
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <Badge v-if="correoValidadoOk" variant="success">Validado</Badge>
                <Badge v-else-if="correoOtpPendiente" variant="outline">Código enviado</Badge>
                <Badge v-else variant="outline">Pendiente</Badge>
              </div>
            </div>
            <Button
              type="button"
              class="w-full shrink-0 bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
              :disabled="datosCargando || correoValidadoOk"
              @click="otpUi.abrirModalCorreo()"
            >
              <span class="sm:hidden">{{ correoOtpPendiente ? 'Ingresar código' : 'Validar / actualizar' }}</span>
              <span class="hidden sm:inline">{{
                correoOtpPendiente ? 'Ingresar código' : 'Validar o actualizar correo'
              }}</span>
            </Button>
          </div>

          <div
            class="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0 flex-1 space-y-2">
              <Label class="text-base">Teléfono móvil (celular)</Label>
              <p class="truncate text-sm font-medium text-foreground" :title="textoTelefonoResumen">
                {{ textoTelefonoResumen }}
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <Badge v-if="telefonoValidadoOk" variant="success">Validado</Badge>
                <Badge v-else-if="telefonoOtpPendiente" variant="outline">Código enviado</Badge>
                <Badge v-else variant="outline">Pendiente</Badge>
              </div>
            </div>
            <Button
              type="button"
              class="w-full shrink-0 bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
              :disabled="datosCargando || telefonoValidadoOk"
              @click="otpUi.abrirModalTelefono()"
            >
              <span class="sm:hidden">{{ telefonoOtpPendiente ? 'Ingresar código' : 'Validar / actualizar' }}</span>
              <span class="hidden sm:inline">{{
                telefonoOtpPendiente ? 'Ingresar código' : 'Validar o actualizar celular'
              }}</span>
            </Button>
          </div>

          <div v-if="!puedeContinuarDesdeContacto" class="border-t border-zinc-200 pt-4">
            <p class="text-sm text-muted-foreground">
              Debes validar el correo y el teléfono móvil (celular) para continuar. Al completar ambos pasarás automáticamente a la encuesta.
            </p>
          </div>
          <div v-else class="flex justify-end border-t border-zinc-200 pt-4">
            <Button
              type="button"
              class="bg-uniacc-orange hover:bg-uniacc-orange/90"
              @click="irPostContacto"
            >
              Continuar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog :open="modalContacto === 'correo'" @update:open="cerrarModalCorreo">
        <DialogScrollContent class="max-h-[85vh] max-w-lg">
          <DialogHeader>
            <DialogTitle>Validar correo personal</DialogTitle>
            <DialogDescription>
              Te enviaremos un código de 6 dígitos a este correo.
            </DialogDescription>
            <ul class="list-disc space-y-1 pl-5 text-left text-sm leading-relaxed text-muted-foreground">
              <li>El código dura {{ formatearDuracionOtp(otpConfig.emailSegundos) }}.</li>
              <li>Puedes reenviarlo 1 vez, después de {{ formatearDuracionOtp(otpConfig.emailReintentoSegundos) }}.</li>
              <li>Tienes 3 intentos por código.</li>
            </ul>
          </DialogHeader>

          <div v-if="mostrarContinuarSinOtpCorreo" class="space-y-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p class="text-sm font-semibold">Continuar sin validar correo</p>
            <p class="text-sm">{{ CONTACTO_OTP_SIN_VALIDAR_MENSAJE_CORREO }}</p>
            <AccionesFlujo>
              <template #secundaria>
                <Button
                  type="button"
                  variant="outline"
                  class="w-full sm:w-auto"
                  @click="cancelarContinuarSinOtpCorreo"
                >
                  {{ CONTACTO_OTP_SIN_VALIDAR_CANCELAR }}
                </Button>
              </template>
              <template #primaria>
                <Button
                  type="button"
                  class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                  @click="aceptarContinuarSinOtpCorreo"
                >
                  {{ CONTACTO_OTP_SIN_VALIDAR_ACEPTAR }}
                </Button>
              </template>
            </AccionesFlujo>
          </div>

          <div v-else class="space-y-3">
            <Label for="email-personal-mock-modal">Correo personal</Label>
            <Input
              id="email-personal-mock-modal"
              v-model="emailDraft"
              type="email"
              autocomplete="email"
              placeholder="correo@ejemplo.cl"
              :disabled="correoValidadoOk || datosCargando"
              :class="emailFormatoInvalido || emailEsInstitucional ? 'border-destructive' : ''"
              @blur="emailTocado = true"
              @input="emailTocado = true"
            />
            <p v-if="emailEsInstitucional" class="text-sm text-destructive">
              {{ MENSAJE_CORREO_PERSONAL_UNIACC }}
            </p>
            <p v-else-if="emailFormatoInvalido" class="text-sm text-destructive">
              Ingresa un correo válido (ej. nombre@dominio.cl).
            </p>
            <p v-if="errorCorreo" class="text-sm font-medium text-destructive">{{ errorCorreo }}</p>

            <template v-if="!correoValidadoOk">
              <div v-if="!correoOtpPendiente" class="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  type="button"
                  class="w-full cursor-pointer bg-uniacc-orange font-semibold text-white hover:bg-uniacc-orange/90 sm:w-auto"
                  :disabled="correoOtpEnviando || datosCargando || correoOtpReintentoBloqueado || !puedeEnviarCorreoOtp"
                  @click="enviarCodigoCorreoOtp"
                >
                  {{ correoOtpEnviando ? 'Enviando…' : 'Enviar código' }}
                </Button>
                <p v-if="correoOtpReintentoBloqueado" class="text-xs text-muted-foreground">
                  Reenvío disponible en {{ correoOtpReintentoMmSs }}
                </p>
              </div>
              <div v-else class="space-y-3">
                <p
                  v-if="correoOtpValidezDesdeMs != null"
                  class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted-foreground"
                >
                  <template v-if="correoOtpCountdownAgotado">
                    <span class="font-medium text-destructive">Código caducado.</span>
                    <span>Solicita uno nuevo con «Reenviar código».</span>
                  </template>
                  <template v-else>
                    <span>Tiempo restante</span>
                    <span
                      class="font-mono text-base font-semibold tabular-nums tracking-tight text-foreground"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {{ correoOtpCountdownMmSs }}
                    </span>
                  </template>
                </p>
                <Label for="codigo-otp-correo-mock-modal" class="text-sm">Código de 6 dígitos</Label>
                <input
                  id="codigo-otp-correo-mock-modal"
                  :value="correoOtpCodigo"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  maxlength="6"
                  pattern="[0-9]*"
                  placeholder="000000"
                  :disabled="correoOtpVerificando"
                  :class="
                    cn(
                      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                      'font-mono tabular-nums tracking-widest',
                    )
                  "
                  @input="onCorreoOtpCodigoDomInput"
                  @keydown="onCorreoOtpCodigoKeydown"
                  @compositionend="onCorreoOtpCodigoDomInput"
                />
                <AccionesFlujo>
                  <template #secundaria>
                    <Button
                      type="button"
                      variant="outline"
                      class="w-full sm:w-auto"
                      :disabled="
                        correoOtpEnviando ||
                        correoOtpVerificando ||
                        correoOtpReintentoBloqueado ||
                        !puedeEnviarCorreoOtp
                      "
                      @click="enviarCodigoCorreoOtp"
                    >
                      {{ correoOtpEnviando ? 'Enviando…' : 'Reenviar código' }}
                    </Button>
                  </template>
                  <template #primaria>
                    <Button
                      type="button"
                      class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                      :disabled="
                        correoOtpVerificando ||
                        correoOtpEnviando ||
                        correoOtpCountdownAgotado
                      "
                      @click="confirmarCodigoCorreoOtp"
                    >
                      {{ correoOtpVerificando ? 'Verificando…' : 'Confirmar código' }}
                    </Button>
                  </template>
                </AccionesFlujo>
                <p v-if="correoOtpReintentoBloqueado" class="text-xs text-muted-foreground">
                  Reenvío disponible en {{ correoOtpReintentoMmSs }}
                </p>
              </div>
            </template>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" @click="otpUi.cerrarModalCorreo()">Cerrar</Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>

      <Dialog :open="modalContacto === 'telefono'" @update:open="cerrarModalTelefono">
        <DialogScrollContent class="max-h-[85vh] max-w-lg">
          <DialogHeader>
            <DialogTitle>Validar teléfono móvil (celular)</DialogTitle>
            <DialogDescription>
              Te enviaremos un código de 6 dígitos por SMS a este teléfono móvil (celular).
            </DialogDescription>
            <ul class="list-disc space-y-1 pl-5 text-left text-sm leading-relaxed text-muted-foreground">
              <li>El código dura {{ formatearDuracionOtp(otpConfig.smsSegundos) }}.</li>
              <li>Puedes reenviarlo 1 vez, después de {{ formatearDuracionOtp(otpConfig.smsReintentoSegundos) }}.</li>
              <li>Tienes 3 intentos por código.</li>
            </ul>
          </DialogHeader>

          <div v-if="mostrarContinuarSinOtpTelefono" class="space-y-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p class="text-sm font-semibold">Continuar sin validar el celular</p>
            <p class="text-sm">{{ CONTACTO_OTP_SIN_VALIDAR_MENSAJE_TELEFONO }}</p>
            <AccionesFlujo>
              <template #secundaria>
                <Button
                  type="button"
                  variant="outline"
                  class="w-full sm:w-auto"
                  @click="cancelarContinuarSinOtpTelefono"
                >
                  {{ CONTACTO_OTP_SIN_VALIDAR_CANCELAR }}
                </Button>
              </template>
              <template #primaria>
                <Button
                  type="button"
                  class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                  @click="aceptarContinuarSinOtpTelefono"
                >
                  {{ CONTACTO_OTP_SIN_VALIDAR_ACEPTAR }}
                </Button>
              </template>
            </AccionesFlujo>
          </div>

          <div v-else class="space-y-3">
            <Label for="telefono-mock-modal">Teléfono móvil (celular)</Label>
            <div class="flex gap-2">
              <span
                class="flex h-10 shrink-0 items-center rounded-md border border-input bg-muted px-3 text-sm font-mono text-muted-foreground"
              >
                {{ TELEFONO_CHILE_PREFIJO }}
              </span>
              <input
                id="telefono-mock-modal"
                :value="telefonoDigitosLocal"
                type="text"
                inputmode="numeric"
                autocomplete="tel-national"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                :maxlength="TELEFONO_CHILE_INPUT_MAX"
                pattern="[0-9]*"
                placeholder="987654321"
                :disabled="datosCargando || telefonoValidadoOk"
                :class="
                  cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    'font-mono tabular-nums tracking-wide',
                    telefonoFormatoInvalido ? 'border-destructive' : '',
                  )
                "
                @input="onTelefonoDigitosDomInput"
                @keydown="onTelefonoDigitosKeydown"
                @compositionend="onTelefonoDigitosDomInput"
                @blur="telefonoTocado = true"
              />
            </div>
            <p class="text-xs text-muted-foreground">
              Ingresa los 9 dígitos del celular.
            </p>
            <p v-if="telefonoFormatoInvalido" class="text-sm text-destructive">
              El celular debe tener 9 dígitos después de {{ TELEFONO_CHILE_PREFIJO }}.
            </p>
            <p v-if="errorTelefono" class="text-sm font-medium text-destructive">{{ errorTelefono }}</p>

            <template v-if="!telefonoValidadoOk">
              <div v-if="!telefonoOtpPendiente" class="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  type="button"
                  class="w-full cursor-pointer bg-uniacc-orange font-semibold text-white hover:bg-uniacc-orange/90 sm:w-auto"
                  :disabled="telefonoOtpEnviando || datosCargando || telefonoOtpReintentoBloqueado || !puedeEnviarTelefonoOtp"
                  @click="enviarCodigoTelefonoOtp"
                >
                  {{ telefonoOtpEnviando ? 'Enviando…' : 'Enviar código SMS' }}
                </Button>
                <p v-if="telefonoOtpReintentoBloqueado" class="text-xs text-muted-foreground">
                  Reenvío disponible en {{ telefonoOtpReintentoMmSs }}
                </p>
              </div>
              <div v-else class="space-y-3">
                <p
                  v-if="telefonoOtpValidezDesdeMs != null"
                  class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted-foreground"
                >
                  <template v-if="telefonoOtpCountdownAgotado">
                    <span class="font-medium text-destructive">Código caducado.</span>
                    <span>Solicita uno nuevo con «Reenviar SMS».</span>
                  </template>
                  <template v-else>
                    <span>Tiempo restante</span>
                    <span
                      class="font-mono text-base font-semibold tabular-nums tracking-tight text-foreground"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {{ telefonoOtpCountdownMmSs }}
                    </span>
                  </template>
                </p>
                <Label for="codigo-otp-telefono-mock" class="text-sm">Código SMS de 6 dígitos</Label>
                <input
                  id="codigo-otp-telefono-mock"
                  :value="telefonoOtpCodigo"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="6"
                  placeholder="000000"
                  :disabled="telefonoOtpVerificando"
                  :class="
                    cn(
                      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                      'font-mono tabular-nums tracking-widest',
                    )
                  "
                  @input="onTelefonoOtpCodigoDomInput"
                />
                <AccionesFlujo>
                  <template #secundaria>
                    <Button
                      type="button"
                      variant="outline"
                      class="w-full sm:w-auto"
                      :disabled="
                        telefonoOtpEnviando ||
                        telefonoOtpVerificando ||
                        telefonoOtpReintentoBloqueado ||
                        !puedeEnviarTelefonoOtp
                      "
                      @click="enviarCodigoTelefonoOtp"
                    >
                      Reenviar SMS
                    </Button>
                  </template>
                  <template #primaria>
                    <Button
                      type="button"
                      class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                      :disabled="
                        telefonoOtpVerificando ||
                        telefonoOtpCountdownAgotado
                      "
                      @click="confirmarCodigoTelefonoOtp"
                    >
                      {{ telefonoOtpVerificando ? 'Verificando…' : 'Confirmar código SMS' }}
                    </Button>
                  </template>
                </AccionesFlujo>
                <p v-if="telefonoOtpReintentoBloqueado" class="text-xs text-muted-foreground">
                  Reenvío disponible en {{ telefonoOtpReintentoMmSs }}
                </p>
              </div>
            </template>
            <Button
              v-if="telefonoValidadoOk"
              type="button"
              variant="secondary"
              class="w-full sm:w-auto"
              disabled
            >
              Celular validado
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" @click="otpUi.cerrarModalTelefono()">Cerrar</Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>
    </template>

    <MatriculaAlumnoApoderadoStep
      v-else-if="paso === 'apoderado'"
      @continuar="paso = 'discapacidad'"
    />

    <MatriculaAlumnoDiscapacidadStep v-else-if="paso === 'discapacidad'" />
  </div>
</template>
