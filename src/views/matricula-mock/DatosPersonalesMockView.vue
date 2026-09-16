<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { AlertTriangle, Info } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { useContactoOtpConfigStore } from '@/stores/contactoOtpConfig'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'
import { useMockContactoOtpUiStore } from '@/stores/mockContactoOtpUi'
import { useMockAlumnoFuente } from '@/composables/useMockAlumnoFuente'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import MatriculaMockApoderadoStep from '@/views/matricula-mock/MatriculaMockApoderadoStep.vue'
import MatriculaMockDiscapacidadStep from '@/views/matricula-mock/MatriculaMockDiscapacidadStep.vue'
import MatriculaMockTyCStep from '@/views/matricula-mock/MatriculaMockTyCStep.vue'
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
  extraerDigitosTelefonoChile,
  normalizarTelefonoChile,
  TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO,
  TELEFONO_CHILE_PREFIJO,
  telefonoChileEsValido,
} from '@/utils/telefonoChile'
import {
  CONTACTO_OTP_MAX_ENVIOS,
  CONTACTO_OTP_SIN_VALIDAR_ACEPTAR,
  CONTACTO_OTP_SIN_VALIDAR_CANCELAR,
  CONTACTO_OTP_SIN_VALIDAR_MENSAJE_CORREO,
  CONTACTO_OTP_SIN_VALIDAR_MENSAJE_TELEFONO,
} from '@/constants/contactoOtpConfig'

const auth = useAuthStore()
const otpConfig = useContactoOtpConfigStore()
const alumnoMnp = useDatosAlumnoMnpStore()
const mockCtx = useMockMatriculaContextStore()
const otpUi = useMockContactoOtpUiStore()
const periodoActivo = usePeriodoActivoStore()
const tycStore = useTerminosCondicionesStore()
const fuente = useMockAlumnoFuente()

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

const resolviendoTyc = ref(!mockCtx.tycAccepted)
const paso = ref<PasoDatosPersonales>(mockCtx.tycAccepted ? 'contacto' : 'tyc')
const emailDraft = ref('')
const telefonoDraft = ref('')
const emailConfirmado = ref('')
const telefonoConfirmado = ref('')
const emailTocado = ref(false)
const telefonoTocado = ref(false)
/** 8 dígitos del abonado (sin +569). */
const telefonoDigitosLocal = ref('')

/** Código fijo solo en mock; en QA usar OTP real vía API. */
const MOCK_OTP_CODE = '123456'
const MOCK_OTP_MAX_INTENTOS = 3

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

function sincronizarDraftsContactoDesdeFuente(opciones?: { forzarResetValidacion?: boolean }) {
  if (paso.value !== 'contacto' || datosCargando.value) return

  if (opciones?.forzarResetValidacion) {
    otpUi.resetAll()
    emailDraft.value = valorInicialCorreoPersonal()
    telefonoDigitosLocal.value = valorInicialTelefonoDigitos()
    sincronizarTelefonoDraftDesdeDigitos()
    return
  }

  if (!correoValidadoOk.value) {
    emailDraft.value = valorInicialCorreoPersonal()
  }
  if (!telefonoValidadoOk.value) {
    telefonoDigitosLocal.value = valorInicialTelefonoDigitos()
    sincronizarTelefonoDraftDesdeDigitos()
  }
}

async function hidratarTycDesdeTabla(): Promise<void> {
  if (mockCtx.tycAccepted) {
    resolviendoTyc.value = false
    return
  }
  try {
    await Promise.all([tycStore.ensureLoaded(), periodoActivo.ensureLoaded()])
    const ctx = contextoMolAuditoria({
      rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
      codcli: pickCampoAlumno(fuente.codcliMostrado.value),
      nombreAlumno: pickCampoAlumno(fuente.nombreMostrado.value),
      anioPeriodo: periodoActivo.anio,
      semestrePeriodo: periodoActivo.semestre,
      esMock: mockCtx.tieneAlumnoSeleccionado,
    })
    if (!ctx.codcli || ctx.anioPeriodo == null || ctx.semestrePeriodo == null) return
    const { data } = await consultarUltimaTycRespuestaAlumno({
      codcli: ctx.codcli,
      anioPeriodo: ctx.anioPeriodo,
      semestrePeriodo: ctx.semestrePeriodo,
    })
    if (
      debeSaltarPasoTyc({
        aceptadoEnSesion: false,
        ultimaRespuesta: data,
        tycUpdatedAtActual: tycStore.documento?.updated_at ?? null,
      })
    ) {
      mockCtx.acceptTyc()
      paso.value = 'contacto'
      sincronizarDraftsContactoDesdeFuente()
    }
  } finally {
    resolviendoTyc.value = false
  }
}

function resetCorreoOtpUi() {
  clearCorreoOtpCountdown()
  correoOtpValidezDesdeMs.value = null
  otpUi.resetCorreoOtp()
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

const correoOtpCountdownMmSs = computed(() => {
  if (!correoOtpPendiente.value || correoOtpValidezDesdeMs.value == null) return '00:00'
  const s = segundosValidezRestantes(
    correoOtpValidezDesdeMs.value,
    otpConfig.emailSegundos,
    correoOtpAhoraMs.value,
  )
  return formatearMmSs(s)
})

const correoOtpCountdownAgotado = computed(() => {
  if (!correoOtpPendiente.value || correoOtpValidezDesdeMs.value == null) return false
  return (
    segundosValidezRestantes(
      correoOtpValidezDesdeMs.value,
      otpConfig.emailSegundos,
      correoOtpAhoraMs.value,
    ) <= 0
  )
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
        segundosValidezRestantes(
          correoOtpValidezDesdeMs.value,
          otpConfig.emailSegundos,
          now,
        ) > 0
      const reintentoActive =
        correoOtpProximoReintentoAt.value != null && now < correoOtpProximoReintentoAt.value
      if (!expiryActive && !reintentoActive) clearCorreoOtpCountdown()
    }, 1000)
  },
)

function resetContactoModalYEstadoOtp() {
  otpUi.resetAll()
}

function onPageShowRestaurarContacto(e: PageTransitionEvent) {
  logMockContactoOtp('ui.pageshow', { persisted: e.persisted })
  if (!e.persisted) return
  resetContactoModalYEstadoOtp()
  void otpConfig.ensureLoaded(true)
}

onMounted(() => {
  logMockContactoOtp('ui.onMounted', {
    paso: paso.value,
    modalContacto: modalContacto.value,
    correoPendiente: correoOtpPendiente.value,
    telefonoPendiente: telefonoOtpPendiente.value,
  })
  resetContactoModalYEstadoOtp()
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

const telefonoOtpAhoraMs = computed(() => {
  if (telefonoOtpTick.value > 0) return telefonoOtpTick.value
  if (telefonoOtpPendiente.value || telefonoOtpProximoReintentoAt.value != null) return Date.now()
  return 0
})

const telefonoOtpCountdownMmSs = computed(() => {
  if (!telefonoOtpPendiente.value || telefonoOtpValidezDesdeMs.value == null) return '00:00'
  const s = segundosValidezRestantes(
    telefonoOtpValidezDesdeMs.value,
    otpConfig.smsSegundos,
    telefonoOtpAhoraMs.value,
  )
  return formatearMmSs(s)
})

const telefonoOtpCountdownAgotado = computed(() => {
  if (!telefonoOtpPendiente.value || telefonoOtpValidezDesdeMs.value == null) return false
  return (
    segundosValidezRestantes(
      telefonoOtpValidezDesdeMs.value,
      otpConfig.smsSegundos,
      telefonoOtpAhoraMs.value,
    ) <= 0
  )
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
        segundosValidezRestantes(
          telefonoOtpValidezDesdeMs.value,
          otpConfig.smsSegundos,
          now,
        ) > 0
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
}

watch(
  () =>
    [
      paso.value,
      datosCargando.value,
      mockCtx.selectedPlanPagos,
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
  if (paso.value !== 'contacto') return
  correoValidadoOk.value = false
  otpUi.resetCorreoOtpEnvios()
  resetCorreoOtpUi()
})

watch(telefonoDigitosLocal, () => {
  if (paso.value !== 'contacto') return
  sincronizarTelefonoDraftDesdeDigitos()
  telefonoValidadoOk.value = false
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
  const next = el.value.replace(/\D/g, '').slice(0, TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO)
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

const emailFormatoInvalido = computed(() => {
  const em = emailDraft.value.trim()
  if (!emailTocado.value || !em) return false
  return !emailTieneFormatoValido(em)
})

const puedeEnviarCorreoOtp = computed(() => {
  const em = emailDraft.value.trim()
  return em.length > 0 && emailTieneFormatoValido(em)
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
    esMock: mockCtx.tieneAlumnoSeleccionado,
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
  mostrarContinuarSinOtpCorreo.value = false
  correoValidadoOk.value = true
  logMockContactoOtp('ui.correo.continuarSinOtp', { email: emailDraft.value.trim() })
  void registrarEventoContactoOtp(
    'correo',
    'continuar_sin_otp',
    emailDraft.value.trim(),
  )
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
  telefonoValidadoOk.value = true
  logMockContactoOtp('ui.telefono.continuarSinOtp', { telefono: telefonoDraft.value.trim() })
  void registrarEventoContactoOtp(
    'telefono',
    'continuar_sin_otp',
    telefonoDraft.value.trim(),
  )
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

  correoOtpEnviando.value = true
  try {
    await new Promise((r) => setTimeout(r, 400))
    const ahora = Date.now()
    correoOtpPendiente.value = true
    correoOtpIntentosFallidos.value = 0
    correoOtpValidezDesdeMs.value = ahora
    correoOtpExpiresAt.value = new Date(
      ahora + otpConfig.emailSegundos * 1000,
    ).toISOString()
    correoOtpProximoReintentoAt.value =
      ahora + otpConfig.emailReintentoSegundos * 1000
    correoOtpTick.value = ahora
    correoOtpCodigo.value = ''
    correoOtpEnviosRealizados.value += 1
    const numEnvio = correoOtpEnviosRealizados.value
    void registrarEventoContactoOtp(
      'correo',
      numEnvio === 1 ? 'envio' : 'reenvio',
      em,
      numEnvio,
    )
    logMockContactoOtp('ui.correo.enviar.ok', {
      expiresAt: correoOtpExpiresAt.value,
      validezSegundos: otpConfig.emailSegundos,
      reenvioCooldownSegundos: otpConfig.emailReintentoSegundos,
      proximoReintentoAt: correoOtpProximoReintentoAt.value,
      enviosRealizados: correoOtpEnviosRealizados.value,
    })
    toast.message(`Correo mock simulado (sin envío real). Código de prueba: ${MOCK_OTP_CODE}`)
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

  correoOtpVerificando.value = true
  try {
    await new Promise((r) => setTimeout(r, 300))
    if (codigo !== MOCK_OTP_CODE) {
      correoOtpIntentosFallidos.value += 1
      if (correoOtpIntentosFallidos.value >= MOCK_OTP_MAX_INTENTOS) {
        correoOtpIntentosFallidos.value = 0
        logMockContactoOtp('ui.correo.confirmar.maxIntentos', {
          reintentoBloqueado: correoOtpReintentoBloqueado.value,
        })
        errorCorreo.value =
          'Código incorrecto. Solicita un nuevo código con Reenviar cuando esté disponible.'
        return
      }
      logMockContactoOtp('ui.correo.confirmar.incorrecto', {
        intentos: correoOtpIntentosFallidos.value,
        max: MOCK_OTP_MAX_INTENTOS,
      })
      errorCorreo.value = `Código incorrecto (${correoOtpIntentosFallidos.value}/${MOCK_OTP_MAX_INTENTOS} intentos).`
      void registrarEventoContactoOtp(
        'correo',
        'verificar_fallido',
        emailDraft.value.trim(),
      )
      return
    }
    correoValidadoOk.value = true
    void registrarEventoContactoOtp('correo', 'verificar_ok', emailDraft.value.trim())
    logMockContactoOtp('ui.correo.confirmar.ok')
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
    errorTelefono.value = 'Ingresa tu teléfono actual.'
    return
  }
  if (!telefonoChileEsValido(tel)) {
    errorTelefono.value = `El teléfono debe tener el formato ${TELEFONO_CHILE_PREFIJO} seguido de 8 dígitos.`
    return
  }
  telefonoOtpEnviando.value = true
  try {
    await new Promise((r) => setTimeout(r, 400))
    const ahora = Date.now()
    telefonoOtpPendiente.value = true
    telefonoOtpIntentosFallidos.value = 0
    telefonoOtpValidezDesdeMs.value = ahora
    telefonoOtpExpiresAt.value = new Date(
      ahora + otpConfig.smsSegundos * 1000,
    ).toISOString()
    telefonoOtpProximoReintentoAt.value =
      ahora + otpConfig.smsReintentoSegundos * 1000
    telefonoOtpTick.value = ahora
    telefonoOtpCodigo.value = ''
    telefonoOtpEnviosRealizados.value += 1
    const numEnvio = telefonoOtpEnviosRealizados.value
    void registrarEventoContactoOtp(
      'telefono',
      numEnvio === 1 ? 'envio' : 'reenvio',
      tel,
      numEnvio,
    )
    logMockContactoOtp('ui.telefono.enviar.ok', {
      expiresAt: telefonoOtpExpiresAt.value,
      validezSegundos: otpConfig.smsSegundos,
      reenvioCooldownSegundos: otpConfig.smsReintentoSegundos,
      proximoReintentoAt: telefonoOtpProximoReintentoAt.value,
      enviosRealizados: telefonoOtpEnviosRealizados.value,
    })
    toast.message(`SMS mock simulado (sin envío real). Código de prueba: ${MOCK_OTP_CODE}`)
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
  telefonoOtpVerificando.value = true
  try {
    await new Promise((r) => setTimeout(r, 300))
    if (codigo !== MOCK_OTP_CODE) {
      telefonoOtpIntentosFallidos.value += 1
      if (telefonoOtpIntentosFallidos.value >= MOCK_OTP_MAX_INTENTOS) {
        telefonoOtpIntentosFallidos.value = 0
        logMockContactoOtp('ui.telefono.confirmar.maxIntentos', {
          reintentoBloqueado: telefonoOtpReintentoBloqueado.value,
        })
        errorTelefono.value =
          'Código incorrecto. Solicita un nuevo código con Reenviar SMS cuando esté disponible.'
        return
      }
      logMockContactoOtp('ui.telefono.confirmar.incorrecto', {
        intentos: telefonoOtpIntentosFallidos.value,
        max: MOCK_OTP_MAX_INTENTOS,
      })
      errorTelefono.value = `Código incorrecto (${telefonoOtpIntentosFallidos.value}/${MOCK_OTP_MAX_INTENTOS} intentos).`
      void registrarEventoContactoOtp(
        'telefono',
        'verificar_fallido',
        telefonoDraft.value.trim(),
      )
      return
    }
    telefonoValidadoOk.value = true
    void registrarEventoContactoOtp('telefono', 'verificar_ok', telefonoDraft.value.trim())
    logMockContactoOtp('ui.telefono.confirmar.ok')
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

function irPostContacto(): void {
  if (!puedeContinuarDesdeContacto.value) return
  emailConfirmado.value = emailDraft.value.trim()
  telefonoConfirmado.value = telefonoDraft.value.trim()
  const plan = mockCtx.selectedPlanPagos
  if (plan && esPropioSostenedor(plan.es_responsable_financiero)) {
    paso.value = 'discapacidad'
    return
  }
  if (mockCtx.apoderadoBloqueo) {
    paso.value = 'apoderado'
    return
  }
  if (mockCtx.apoderadoConfirmado === true) {
    paso.value = 'discapacidad'
    return
  }
  paso.value = 'apoderado'
}

const puedeContinuarDesdeContacto = computed(() => correoValidadoOk.value && telefonoValidadoOk.value)

watch(
  () => correoValidadoOk.value && telefonoValidadoOk.value,
  (listo) => {
    if (listo && paso.value === 'contacto' && !datosCargando.value) {
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

    <MatriculaMockTyCStep v-else-if="paso === 'tyc'" @aceptado="onTycAceptado" />

    <!-- Paso contacto: validar correo personal y teléfono -->
    <template v-else-if="paso === 'contacto'">
      <Alert
        variant="default"
        class="border-uniacc-orange/40 bg-uniacc-orange/10 text-zinc-900 shadow-sm ring-1 ring-uniacc-orange/15 dark:border-uniacc-orange/45 dark:bg-uniacc-orange/15 dark:text-zinc-50 dark:ring-uniacc-orange/25 [&>svg]:text-uniacc-orange"
      >
        <Info class="h-5 w-5 shrink-0" aria-hidden="true" />
        <AlertTitle class="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Cómo validar tu contacto
        </AlertTitle>
        <AlertDescription class="mt-2 space-y-3 text-zinc-800 dark:text-zinc-200">
          <p class="font-medium text-zinc-900 dark:text-zinc-50">
            Pulsa <strong class="text-uniacc-orange">Validar o actualizar</strong> en correo y en teléfono: se abrirá
            un panel para completar cada validación.
          </p>
          <ul class="list-none space-y-2 border-l-2 border-uniacc-orange/50 pl-4 text-sm leading-snug">
            <li>
              <span class="font-semibold text-uniacc-orange">Correo y teléfono (mock).</span>
              Sin envío real: usa el código de prueba <strong>{{ MOCK_OTP_CODE }}</strong>.
              Validez del código: correo {{ otpConfig.emailSegundos }} s, SMS {{ otpConfig.smsSegundos }} s.
              Entre cada reenvío debes esperar: correo {{ otpConfig.emailReintentoSegundos }} s,
              SMS {{ otpConfig.smsReintentoSegundos }} s. Máximo 3 intentos incorrectos por código.
              Puedes reenviar el código una vez. Si aún no lo recibes, podrás continuar con el dato ingresado.
            </li>
            <li>
              <span class="font-semibold text-uniacc-orange">Importante.</span>
              Si cambias un dato después de validarlo, tendrás que volver a validarlo.
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <Card class="shadow-md">
        <CardHeader>
          <CardTitle>Validación de contacto</CardTitle>
          <CardDescription>
            Estos son los datos que tenemos en tu registro. Selecciona cada opción para luego realizar la validación.
          </CardDescription>
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
                <Badge v-else variant="outline">Pendiente</Badge>
              </div>
            </div>
            <Button
              type="button"
              class="w-full shrink-0 bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
              :disabled="datosCargando || correoValidadoOk"
              @click="otpUi.abrirModalCorreo()"
            >
              <span class="sm:hidden">Validar / actualizar</span>
              <span class="hidden sm:inline">Validar o actualizar correo</span>
            </Button>
          </div>

          <div
            class="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0 flex-1 space-y-2">
              <Label class="text-base">Teléfono actual</Label>
              <p class="truncate text-sm font-medium text-foreground" :title="textoTelefonoResumen">
                {{ textoTelefonoResumen }}
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <Badge v-if="telefonoValidadoOk" variant="success">Validado</Badge>
                <Badge v-else variant="outline">Pendiente</Badge>
              </div>
            </div>
            <Button
              type="button"
              class="w-full shrink-0 bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
              :disabled="datosCargando || telefonoValidadoOk"
              @click="otpUi.abrirModalTelefono()"
            >
              <span class="sm:hidden">Validar / actualizar</span>
              <span class="hidden sm:inline">Validar o actualizar teléfono</span>
            </Button>
          </div>

          <div v-if="!puedeContinuarDesdeContacto" class="border-t border-zinc-200 pt-4">
            <p class="text-xs text-muted-foreground">
              Debes validar correo y teléfono para continuar. Al completar ambos pasarás automáticamente a la encuesta.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog :open="modalContacto === 'correo'" @update:open="cerrarModalCorreo">
        <DialogScrollContent class="max-h-[85vh] max-w-lg">
          <DialogHeader>
            <DialogTitle>Validar correo personal</DialogTitle>
            <DialogDescription>
              Simula la validación sin enviar correo real. Código de prueba: {{ MOCK_OTP_CODE }}.
              El código es válido {{ otpConfig.emailSegundos }} segundos. Debes esperar
              {{ otpConfig.emailReintentoSegundos }} segundos entre cada reenvío.
              Puedes reenviar el código una vez. Si aún no lo recibes, podrás continuar con el dato ingresado.
            </DialogDescription>
          </DialogHeader>

          <div v-if="mostrarContinuarSinOtpCorreo" class="space-y-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p class="text-sm font-semibold">Continuar sin validar correo</p>
            <p class="text-sm">{{ CONTACTO_OTP_SIN_VALIDAR_MENSAJE_CORREO }}</p>
            <div class="flex flex-wrap gap-2">
              <Button type="button" variant="outline" @click="cancelarContinuarSinOtpCorreo">
                {{ CONTACTO_OTP_SIN_VALIDAR_CANCELAR }}
              </Button>
              <Button
                type="button"
                class="bg-uniacc-orange hover:bg-uniacc-orange/90"
                @click="aceptarContinuarSinOtpCorreo"
              >
                {{ CONTACTO_OTP_SIN_VALIDAR_ACEPTAR }}
              </Button>
            </div>
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
              :class="emailFormatoInvalido ? 'border-destructive' : ''"
              @blur="emailTocado = true"
              @input="emailTocado = true"
            />
            <p v-if="emailFormatoInvalido" class="text-sm text-destructive">
              Ingresa un correo válido (ej. nombre@dominio.cl).
            </p>
            <p v-if="errorCorreo" class="text-sm font-medium text-destructive">{{ errorCorreo }}</p>

            <template v-if="!correoValidadoOk">
              <div v-if="!correoOtpPendiente" class="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  class="w-full sm:w-auto"
                  :disabled="correoOtpEnviando || datosCargando || correoOtpReintentoBloqueado || !puedeEnviarCorreoOtp"
                  @click="enviarCodigoCorreoOtp"
                >
                  {{ correoOtpEnviando ? 'Simulando…' : 'Simular envío (mock)' }}
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
                <div class="flex flex-wrap gap-2">
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
                </div>
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
            <DialogTitle>Validar teléfono actual</DialogTitle>
            <DialogDescription>
              Simula validación SMS sin envío real. Código de prueba: {{ MOCK_OTP_CODE }}.
              El código es válido {{ otpConfig.smsSegundos }} segundos. Debes esperar
              {{ otpConfig.smsReintentoSegundos }} segundos entre cada reenvío.
              Puedes reenviar el código una vez. Si aún no lo recibes, podrás continuar con el dato ingresado.
            </DialogDescription>
          </DialogHeader>

          <div v-if="mostrarContinuarSinOtpTelefono" class="space-y-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p class="text-sm font-semibold">Continuar sin validar teléfono</p>
            <p class="text-sm">{{ CONTACTO_OTP_SIN_VALIDAR_MENSAJE_TELEFONO }}</p>
            <div class="flex flex-wrap gap-2">
              <Button type="button" variant="outline" @click="cancelarContinuarSinOtpTelefono">
                {{ CONTACTO_OTP_SIN_VALIDAR_CANCELAR }}
              </Button>
              <Button
                type="button"
                class="bg-uniacc-orange hover:bg-uniacc-orange/90"
                @click="aceptarContinuarSinOtpTelefono"
              >
                {{ CONTACTO_OTP_SIN_VALIDAR_ACEPTAR }}
              </Button>
            </div>
          </div>

          <div v-else class="space-y-3">
            <Label for="telefono-mock-modal">Teléfono</Label>
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
                :maxlength="TELEFONO_CHILE_DIGITOS_TRAS_PREFIJO"
                pattern="[0-9]*"
                placeholder="12345678"
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
              Ingresa 8 dígitos después de {{ TELEFONO_CHILE_PREFIJO }} (solo números, sin espacios ni símbolos).
            </p>
            <p v-if="telefonoFormatoInvalido" class="text-sm text-destructive">
              El teléfono debe tener 8 dígitos después de {{ TELEFONO_CHILE_PREFIJO }}.
            </p>
            <p v-if="errorTelefono" class="text-sm font-medium text-destructive">{{ errorTelefono }}</p>

            <template v-if="!telefonoValidadoOk">
              <div v-if="!telefonoOtpPendiente" class="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  class="w-full sm:w-auto"
                  :disabled="telefonoOtpEnviando || datosCargando || telefonoOtpReintentoBloqueado || !puedeEnviarTelefonoOtp"
                  @click="enviarCodigoTelefonoOtp"
                >
                  {{ telefonoOtpEnviando ? 'Enviando…' : 'Enviar código SMS (mock)' }}
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
                <div class="flex flex-wrap gap-2">
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
                </div>
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
              Teléfono validado
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" @click="otpUi.cerrarModalTelefono()">Cerrar</Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>
    </template>

    <MatriculaMockApoderadoStep
      v-else-if="paso === 'apoderado'"
      @continuar="paso = 'discapacidad'"
    />

    <MatriculaMockDiscapacidadStep v-else-if="paso === 'discapacidad'" />
  </div>
</template>
