import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

import router from '@/router'
import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import {
  clasificarErrorRematricula,
  clasificarFalloIngreso,
  type EscenaErrorRematricula,
} from '@/utils/errorRematriculaCatalogo'

export type SuperficieError = 'alumno' | 'backoffice' | 'ingreso'
export type EscenaModal = EscenaErrorRematricula | 'ingreso'

export const CORREO_AYUDA_INGRESO = 'servicio.estudiante@uniacc.cl'

export const useErrorRematriculaStore = defineStore('errorRematricula', () => {
  const abierto = ref(false)
  const escena = ref<EscenaModal>('conexion')
  const titulo = ref('')
  const cuerpo = ref('')
  const saludo = ref<string | null>(null)
  const boton = ref<'reintento' | 'entendido'>('reintento')
  const superficie = ref<SuperficieError>('alumno')
  const mostrarEnlaces = ref(true)
  const correoAyuda = ref<string | null>(null)
  const etiquetaAyuda = ref('')

  let reintentar: (() => void) | null = null
  let focoId: string | null = null
  let alCerrar: (() => void) | null = null

  function limpiarAccion(): (() => void) | null {
    reintentar = null
    focoId = null
    const extra = alCerrar
    alCerrar = null
    return extra
  }

  function abrirBase(input: {
    escena: EscenaModal
    titulo: string
    cuerpo: string
    superficie: SuperficieError
    saludo: string | null
    boton: 'reintento' | 'entendido'
    mostrarEnlaces: boolean
    correoAyuda: string | null
    etiquetaAyuda: string
    reintentar?: () => void
    focoId?: string
    alCerrar?: () => void
  }) {
    escena.value = input.escena
    titulo.value = input.titulo
    cuerpo.value = input.cuerpo
    superficie.value = input.superficie
    saludo.value = input.saludo
    boton.value = input.boton
    mostrarEnlaces.value = input.mostrarEnlaces
    correoAyuda.value = input.correoAyuda
    etiquetaAyuda.value = input.etiquetaAyuda
    reintentar = input.reintentar ?? null
    focoId = input.focoId ?? null
    alCerrar = input.alCerrar ?? null
    abierto.value = true
  }

  function cerrar() {
    abierto.value = false
    limpiarAccion()?.()
  }

  function alPrincipal() {
    const accion = reintentar
    const foco = focoId
    abierto.value = false
    const extra = limpiarAccion()
    if (accion) accion()
    else if (foco) document.getElementById(foco)?.focus()
    extra?.()
  }

  function irAlInicio() {
    const destino =
      superficie.value === 'alumno'
        ? { name: 'matricula-alumno-datos' }
        : { name: 'dashboard-rematricula-kpi' }
    cerradoNavegando()
    void router.push(destino)
  }

  function cerradoNavegando() {
    abierto.value = false
    limpiarAccion()
  }

  return {
    abierto,
    escena,
    titulo,
    cuerpo,
    saludo,
    boton,
    superficie,
    mostrarEnlaces,
    correoAyuda,
    etiquetaAyuda,
    abrirBase,
    cerrar,
    alPrincipal,
    irAlInicio,
  }
})

function saludoPersona(nombre: string): string | null {
  const limpio = nombre.trim()
  if (!limpio || limpio === '—') return null
  return `Hola, ${limpio}`
}

function nombreAlumno(): string {
  const auth = useAuthStore()
  const mnp = useDatosAlumnoMnpStore()
  if (auth.mvUsuario) return auth.displayNombreCompleto
  return mnp.primeraFila?.nombre_alumno?.trim() || auth.displayNombreCompleto
}

function superficieActual(): 'alumno' | 'backoffice' {
  const name = String(router.currentRoute.value.name ?? '')
  return name.startsWith('matricula-alumno') ? 'alumno' : 'backoffice'
}

export function mostrarErrorRematricula(
  mensaje: string | null | undefined,
  opts?: { reintentar?: () => void; numOperacion?: string; focoId?: string },
): void {
  const store = useErrorRematriculaStore()
  const auth = useAuthStore()
  const superficie = superficieActual()
  const texto = (mensaje ?? '').trim() || 'No pudimos completar la acción.'
  const clasificado = clasificarErrorRematricula(texto, { numOperacion: opts?.numOperacion })
  const nombre = superficie === 'alumno' ? nombreAlumno() : auth.displayNombreCompleto
  store.abrirBase({
    escena: clasificado.escena,
    titulo: clasificado.titulo,
    cuerpo: clasificado.cuerpo,
    superficie,
    saludo: saludoPersona(nombre),
    boton: 'reintento',
    mostrarEnlaces: true,
    correoAyuda: null,
    etiquetaAyuda: '',
    reintentar: clasificado.enfocarCampo ? undefined : opts?.reintentar,
    focoId: opts?.focoId,
  })
}

export function mostrarFalloIngreso(mensaje: string, nombre?: string | null): void {
  const store = useErrorRematriculaStore()
  const clasificado = clasificarFalloIngreso(mensaje)
  store.abrirBase({
    escena: 'ingreso',
    titulo: clasificado.titulo,
    cuerpo: clasificado.cuerpo,
    superficie: 'ingreso',
    saludo: saludoPersona(nombre ?? ''),
    boton: 'reintento',
    mostrarEnlaces: false,
    correoAyuda: CORREO_AYUDA_INGRESO,
    etiquetaAyuda: 'Necesito ayuda para ingresar',
    focoId: 'login-username',
  })
}

export function mostrarBloqueoIngreso(input: {
  titulo: string
  cuerpo: string
  correo?: string | null
  nombre?: string | null
  alCerrar?: () => void
}): void {
  const store = useErrorRematriculaStore()
  store.abrirBase({
    escena: 'ingreso',
    titulo: input.titulo,
    cuerpo: input.cuerpo,
    superficie: 'ingreso',
    saludo: saludoPersona(input.nombre ?? ''),
    boton: 'entendido',
    mostrarEnlaces: false,
    correoAyuda: input.correo ?? null,
    etiquetaAyuda: input.correo ?? '',
    alCerrar: input.alCerrar,
  })
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useErrorRematriculaStore, import.meta.hot))
}
