<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import { textoConPortal } from '@/utils/errorRematriculaCatalogo'
import TextoPortalSolicitudes from '@/components/rematricula/TextoPortalSolicitudes.vue'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  crearWebpay,
  obtenerWebpay,
  redirigirAWebpay,
  type ConceptoWebpay,
  type FilaPublica,
} from '@/services/webpayPlusApi'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import {
  useMatriculaAlumnoContextStore,
  type WebpayConceptoEstado,
} from '@/stores/matriculaAlumnoContext'
import { registrarWebpayAudit, type RegistrarWebpayAuditParams } from '@/services/webpayAuditLog'
import { detalleDesdeWebpay } from '@/utils/webpayPagoDetalle'
import {
  destinoDesdePaso,
  montoCrearSiguienteWebpay,
  motivoContinuarError,
} from '@/utils/webpayRetornoContinuar'
import { siguientePaso, type MedioConcepto } from '@/utils/webpaySiguientePaso'
import VoucherWebpayDialog from '@/components/matricula/VoucherWebpayDialog.vue'
import { armarVoucherWebpay, type VoucherWebpay } from '@/utils/voucherWebpay'
import { descargarVoucherWebpay } from '@/utils/voucherWebpayPdf'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const datosMnp = useDatosAlumnoMnpStore()
const alumnoCtx = useMatriculaAlumnoContextStore()
const fuente = useAlumnoRematriculaFuente()

const cargando = ref(true)
const mensaje = ref('')
const mostrarReintentar = ref(false)
const redirigiendo = ref(false)
const voucher = ref<VoucherWebpay | null>(null)
const filaVoucher = ref<FilaPublica | null>(null)
const continuarFallido = ref(false)
const continuando = ref(false)

function primerQuery(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim()
  return ''
}

function estadoPersistible(estado: FilaPublica['estado']): WebpayConceptoEstado | null {
  if (estado === 'autorizada' || estado === 'rechazada' || estado === 'abortada') return estado
  return null
}

/** Persiste estado Webpay en contexto y fuerza upload a BD (no solo sessionStorage). */
async function guardarEstadoConcepto(fila: FilaPublica): Promise<boolean> {
  const estado = estadoPersistible(fila.estado)
  const detalle =
    estado === 'autorizada'
      ? detalleDesdeWebpay({
          paymentTypeCode: fila.paymentTypeCode,
          authorizationCode: fila.authorizationCode,
          installmentsNumber: fila.installmentsNumber,
          transactionDate: fila.transactionDate,
          cardLast4: fila.cardLast4,
        })
      : null
  if (fila.concepto === 'matricula') {
    alumnoCtx.setWebpayMatriculaEstado(estado)
    alumnoCtx.setWebpayMatriculaDetalle(detalle)
  } else {
    alumnoCtx.setWebpayArancelEstado(estado)
    alumnoCtx.setWebpayArancelDetalle(detalle)
  }
  return alumnoCtx.flushBorrador()
}

async function asegurarBorradorPersistido(fila: FilaPublica): Promise<boolean> {
  const ok = await alumnoCtx.flushBorrador()
  if (ok) return true
  auditarContinuarError(fila, motivoContinuarError('persistencia'))
  mostrarErrorRematricula(
    'No pudimos guardar el avance del pago. Revisa tu conexión e intenta Continuar de nuevo.',
  )
  mostrarReintentar.value = true
  return false
}

const ESPERA_AUDIT_ANTES_WEBPAY_MS = 1_000

function emitirWebpayAudit(params: RegistrarWebpayAuditParams): void {
  void registrarWebpayAudit(params).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[WebpayAudit]', message)
  })
}

/** Espera el RPC antes del submit de página completa. Tope ~1s: Continuar no se queda colgado. */
async function esperarAuditoriaAntesDeWebpay(trabajo: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      trabajo,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ESPERA_AUDIT_ANTES_WEBPAY_MS)
      }),
    ])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[WebpayAudit]', message)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function contextoAuditAlumno(fila: FilaPublica | null): Pick<
  RegistrarWebpayAuditParams,
  'rutAlumno' | 'codcli' | 'anioPeriodo' | 'semestrePeriodo'
> {
  return {
    rutAlumno: fuente.rutMostrado.value === '—' ? null : fuente.rutMostrado.value,
    codcli: fuente.codcliMostrado.value === '—' ? null : fuente.codcliMostrado.value,
    anioPeriodo: fila?.anioPeriodo ?? null,
    semestrePeriodo: fila?.semestrePeriodo ?? null,
  }
}

function auditarRetorno(buyOrder: string, errorQuery: string, fila: FilaPublica | null): void {
  emitirWebpayAudit({
    accion: 'retorno',
    ...contextoAuditAlumno(fila),
    payload: {
      buy_order: buyOrder || null,
      estado: fila?.estado ?? null,
      error: errorQuery || null,
      autenticado: auth.isAuthenticated,
    },
  })
}

function paramsContinuarOk(
  fila: FilaPublica,
  destino: ReturnType<typeof destinoDesdePaso> | 'forma-pago',
): RegistrarWebpayAuditParams {
  return {
    accion: 'continuar_ok',
    ...contextoAuditAlumno(fila),
    payload: {
      buy_order: fila.buyOrder,
      destino,
    },
  }
}

function auditarContinuarOk(fila: FilaPublica, destino: ReturnType<typeof destinoDesdePaso> | 'forma-pago'): void {
  emitirWebpayAudit(paramsContinuarOk(fila, destino))
}

async function auditarContinuarOkAntesDeWebpay(
  fila: FilaPublica,
  destino: ReturnType<typeof destinoDesdePaso>,
): Promise<void> {
  await esperarAuditoriaAntesDeWebpay(registrarWebpayAudit(paramsContinuarOk(fila, destino)))
}

function auditarContinuarError(fila: FilaPublica, motivo: ReturnType<typeof motivoContinuarError>): void {
  emitirWebpayAudit({
    accion: 'continuar_error',
    ...contextoAuditAlumno(fila),
    payload: {
      buy_order: fila.buyOrder,
      motivo,
    },
  })
}

function irAFormaPago(plan?: ConceptoWebpay, aviso?: 'abortada' | 'rechazada'): void {
  const esAlumno =
    auth.authSource === 'pixarron' &&
    datosMnp.cantidadRegistros > 0 &&
    !datosMnp.fueraCarteraOficial
  const name = esAlumno ? 'matricula-alumno-forma-pago' : 'matricula-mock-forma-pago'
  const query: Record<string, string> = {}
  if (plan) query.plan = plan
  if (aviso) query.aviso = aviso
  void router.push(Object.keys(query).length > 0 ? { name, query } : { name })
}

async function avanzarSiAutorizada(fila: FilaPublica): Promise<void> {
  if (!(await asegurarBorradorPersistido(fila))) return

  const medioMatricula = alumnoCtx.medioMatricula
  const medioArancel: MedioConcepto | null = alumnoCtx.medioArancel
  if (medioMatricula == null) {
    auditarContinuarError(fila, motivoContinuarError('medio_null'))
    mostrarErrorRematricula('No encontramos cómo seguir con el pago.')
    mostrarReintentar.value = true
    return
  }

  const paso = siguientePaso({
    medioMatricula,
    medioArancel,
    matriculaAutorizada: alumnoCtx.webpayMatriculaEstado === 'autorizada',
    arancelAutorizado: alumnoCtx.webpayArancelEstado === 'autorizada',
    planListo: alumnoCtx.pagoMatricula != null,
    arancelPorPagar: alumnoCtx.webpayMontoArancel,
  })

  if (paso.tipo === 'webpay') {
    const monto = montoCrearSiguienteWebpay({
      concepto: paso.concepto,
      webpayMontoMatricula: alumnoCtx.webpayMontoMatricula,
      webpayMontoArancel: alumnoCtx.webpayMontoArancel,
    })
    if (monto == null) {
      auditarContinuarError(fila, motivoContinuarError('monto_invalido'))
      mostrarErrorRematricula('No encontramos el monto del siguiente pago.')
      mostrarReintentar.value = true
      return
    }
    const codcliAcademico = fuente.codcliMostrado.value.trim()
    const rut = fuente.rutMostrado.value.trim()
    if (!codcliAcademico || codcliAcademico === '—' || !rut || rut === '—') {
      auditarContinuarError(fila, motivoContinuarError('identidad'))
      mostrarErrorRematricula('Faltan codcli académico o RUT para continuar el pago')
      mostrarReintentar.value = true
      return
    }
    const creado = await crearWebpay({
      codcli: fila.codcli,
      codcliAcademico,
      rut,
      anio: fila.anioPeriodo,
      periodo: fila.semestrePeriodo,
      concepto: paso.concepto,
      monto,
    })
    if (!creado.ok) {
      auditarContinuarError(fila, motivoContinuarError('crear_webpay'))
      mostrarErrorRematricula(creado.error)
      mostrarReintentar.value = true
      return
    }
    if (!(await asegurarBorradorPersistido(fila))) return
    await auditarContinuarOkAntesDeWebpay(fila, destinoDesdePaso(paso))
    redirigiendo.value = true
    redirigirAWebpay(creado.url, creado.token)
    return
  }

  if (paso.tipo === 'elegir-arancel') {
    auditarContinuarOk(fila, destinoDesdePaso(paso))
    irAFormaPago()
    return
  }

  if (paso.tipo === 'plan-pagare') {
    auditarContinuarOk(fila, destinoDesdePaso(paso))
    irAFormaPago(paso.concepto)
    return
  }

  if (paso.tipo === 'firma') {
    auditarContinuarOk(fila, destinoDesdePaso(paso))
    alumnoCtx.marcarPasoAlcanzado(3)
    if (!(await asegurarBorradorPersistido(fila))) return
    void router.push({ name: 'matricula-alumno-firma' })
    return
  }

  auditarContinuarOk(fila, 'forma-pago')
  irAFormaPago()
}

function alDescargar(): void {
  if (!voucher.value) return
  try {
    descargarVoucherWebpay(voucher.value)
  } catch {
    mostrarErrorRematricula('No se pudo descargar el voucher.')
  }
}

async function alContinuar(): Promise<void> {
  if (!filaVoucher.value || continuando.value) return
  continuando.value = true
  try {
    await avanzarSiAutorizada(filaVoucher.value)
    if (mostrarReintentar.value) continuarFallido.value = true
  } finally {
    if (!redirigiendo.value) {
      continuando.value = false
    }
  }
}

function avisoPagoIlegible(): void {
  const texto = 'No pudimos leer el resultado del pago.'
  mensaje.value = textoConPortal(texto)
  mostrarErrorRematricula(texto)
}

function alVolver(): void {
  const estado = filaVoucher.value?.estado
  const aviso = estado === 'rechazada' || estado === 'abortada' ? estado : undefined
  irAFormaPago(undefined, aviso)
}

onMounted(async () => {
  const errorQuery = primerQuery(route.query.error)
  const buyOrder = primerQuery(route.query.buy_order)

  if (errorQuery === 'retorno-invalido') {
    avisoPagoIlegible()
    mostrarReintentar.value = true
    let filaInvalida: FilaPublica | null = null
    if (buyOrder) {
      filaInvalida = await obtenerWebpay(buyOrder)
      if (filaInvalida) await guardarEstadoConcepto(filaInvalida)
    }
    auditarRetorno(buyOrder, errorQuery, filaInvalida)
    cargando.value = false
    return
  }

  if (!buyOrder) {
    avisoPagoIlegible()
    mostrarReintentar.value = true
    auditarRetorno(buyOrder, errorQuery, null)
    cargando.value = false
    return
  }

  const fila = await obtenerWebpay(buyOrder)
  if (!fila) {
    avisoPagoIlegible()
    mostrarReintentar.value = true
    auditarRetorno(buyOrder, errorQuery, null)
    cargando.value = false
    return
  }

  const persistido = await guardarEstadoConcepto(fila)
  if (!persistido) {
    console.warn('[WebpayRetorno] No se pudo flush del borrador tras guardar estado')
  }

  const armado = armarVoucherWebpay(fila)
  if (!armado) {
    avisoPagoIlegible()
    mostrarReintentar.value = true
    auditarRetorno(buyOrder, errorQuery, fila)
    cargando.value = false
    return
  }

  filaVoucher.value = fila
  voucher.value = armado
  auditarRetorno(buyOrder, errorQuery, fila)
  cargando.value = false
})
</script>

<template>
  <div class="space-y-6">
    <Card class="border-orange-100 shadow-lg">
      <CardContent class="space-y-6 pt-8 pb-8">
        <h1 class="text-center text-2xl font-bold text-uniacc-orange md:text-3xl">Resultado del pago</h1>
        <div v-if="cargando || redirigiendo" class="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 class="h-8 w-8 animate-spin" aria-hidden="true" />
          <p class="text-center text-lg">
            {{ redirigiendo ? 'Te estamos llevando al siguiente pago.' : 'Consultando el resultado del pago…' }}
          </p>
        </div>
        <p v-else class="text-center text-lg text-muted-foreground">
          <TextoPortalSolicitudes :texto="mensaje" />
        </p>
        <div v-if="mostrarReintentar && !redirigiendo" class="flex justify-center">
          <Button
            class="cursor-pointer rounded-full bg-uniacc-orange px-8 hover:bg-uniacc-orange/90"
            type="button"
            @click="irAFormaPago()"
          >
            Volver a forma de pago
          </Button>
        </div>
      </CardContent>
    </Card>
    <VoucherWebpayDialog
      v-if="voucher && !redirigiendo"
      :voucher="voucher"
      :mostrar-volver="continuarFallido"
      :ocupado="continuando"
      @descargar="alDescargar"
      @continuar="alContinuar"
      @volver="alVolver"
    />
  </div>
</template>
