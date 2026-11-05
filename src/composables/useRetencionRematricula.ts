import { computed, ref, type Ref } from 'vue'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import {
  copyProcesoIncompleto,
  pasoPendienteRetencion,
  procesoRematriculaIncompleto,
  type SenalesRetencionRematricula,
} from '@/utils/procesoRematriculaIncompleto'

function senalesDesdeStore(
  alumnoCtx: ReturnType<typeof useMatriculaAlumnoContextStore>,
  periodoActivo: boolean,
): SenalesRetencionRematricula {
  return {
    medioMatricula: alumnoCtx.medioMatricula,
    medioArancel: alumnoCtx.medioArancel,
    webpayMatriculaEstado: alumnoCtx.webpayMatriculaEstado,
    webpayArancelEstado: alumnoCtx.webpayArancelEstado,
    pagoMatricula: alumnoCtx.pagoMatricula,
    firmaCompletada: alumnoCtx.firmaCompletada,
    arancelPorPagar: alumnoCtx.webpayMontoArancel,
    periodoActivo,
  }
}

/**
 * Estado compartido de retención post-pago matrícula.
 * bypassSalida: permite una navegación tras "Salir igual".
 * transferenciaExterna: desactiva beforeunload al ir a Webpay/TuFirma.
 */
const bypassSalida = ref(false)
const transferenciaExterna = ref(false)
const modalSalidaAbierto = ref(false)
/** Destino pendiente tras confirmar Salir igual (ruta name o path). */
const destinoPendienteSalida = ref<{ name?: string; path?: string } | null>(null)
/** Si true, tras Salir igual se hace logout. */
const logoutTrasSalida = ref(false)

export function useRetencionRematricula() {
  const alumnoCtx = useMatriculaAlumnoContextStore()
  const periodoStore = usePeriodoActivoStore()

  const senales = computed(() =>
    senalesDesdeStore(alumnoCtx, periodoStore.anio != null && periodoStore.semestre != null),
  )

  const esIncompleto = computed(() => procesoRematriculaIncompleto(senales.value))
  const pasoPendiente = computed(() => pasoPendienteRetencion(senales.value))
  const copySalida = computed(() => copyProcesoIncompleto(senales.value))

  const debeAdvertirBeforeUnload = computed(
    () => esIncompleto.value && !bypassSalida.value && !transferenciaExterna.value,
  )

  function marcarBypassSalida(): void {
    bypassSalida.value = true
  }

  function limpiarBypassSalida(): void {
    bypassSalida.value = false
  }

  function consumirBypassSalida(): boolean {
    if (!bypassSalida.value) return false
    bypassSalida.value = false
    return true
  }

  function marcarTransferenciaExterna(activa: boolean): void {
    transferenciaExterna.value = activa
  }

  function onBeforeUnload(e: BeforeUnloadEvent): void {
    if (!debeAdvertirBeforeUnload.value) return
    e.preventDefault()
    e.returnValue = ''
  }

  function abrirModalSalida(destino?: {
    name?: string
    path?: string
    logout?: boolean
  }): void {
    destinoPendienteSalida.value = destino
      ? { name: destino.name, path: destino.path }
      : { name: 'dashboard-home' }
    logoutTrasSalida.value = destino?.logout === true
    modalSalidaAbierto.value = true
  }

  function cerrarModalSalida(): void {
    modalSalidaAbierto.value = false
    destinoPendienteSalida.value = null
    logoutTrasSalida.value = false
  }

  function tomarDestinoSalida(): {
    destino: { name?: string; path?: string } | null
    logout: boolean
  } {
    const destino = destinoPendienteSalida.value
    const logout = logoutTrasSalida.value
    destinoPendienteSalida.value = null
    logoutTrasSalida.value = false
    modalSalidaAbierto.value = false
    return { destino, logout }
  }

  return {
    esIncompleto,
    pasoPendiente,
    copySalida,
    senales,
    debeAdvertirBeforeUnload,
    bypassSalida: bypassSalida as Ref<boolean>,
    transferenciaExterna: transferenciaExterna as Ref<boolean>,
    modalSalidaAbierto: modalSalidaAbierto as Ref<boolean>,
    destinoPendienteSalida: destinoPendienteSalida as Ref<{
      name?: string
      path?: string
    } | null>,
    marcarBypassSalida,
    limpiarBypassSalida,
    consumirBypassSalida,
    marcarTransferenciaExterna,
    onBeforeUnload,
    abrirModalSalida,
    cerrarModalSalida,
    tomarDestinoSalida,
  }
}
