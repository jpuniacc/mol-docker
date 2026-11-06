<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronDown, Loader2 } from 'lucide-vue-next'
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
import { useRetencionRematricula } from '@/composables/useRetencionRematricula'
import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import {
  useMatriculaAlumnoContextStore,
  type WebpayConceptoEstado,
} from '@/stores/matriculaAlumnoContext'
import { registrarWebpayAudit, type RegistrarWebpayAuditParams } from '@/services/webpayAuditLog'
import { emitirRetencionAudit } from '@/services/retencionAuditLog'
import { detalleDesdeWebpay } from '@/utils/webpayPagoDetalle'
import {
  destinoDesdePaso,
  montoCrearSiguienteWebpay,
  motivoContinuarError,
} from '@/utils/webpayRetornoContinuar'
import { siguientePaso, type MedioConcepto } from '@/utils/webpaySiguientePaso'
import {
  ctaContinuarRetornoMatricula,
  type SenalesRetencionRematricula,
} from '@/utils/procesoRematriculaIncompleto'
import { reintentarFlushBorrador } from '@/utils/reintentarFlushBorrador'
import VoucherWebpayDialog from '@/components/matricula/VoucherWebpayDialog.vue'
import RetencionMicroStepper from '@/components/matricula/RetencionMicroStepper.vue'
import { armarVoucherWebpay, type VoucherWebpay } from '@/utils/voucherWebpay'
import { descargarVoucherWebpay } from '@/utils/voucherWebpayPdf'
import { COMERCIO_VOUCHER, PIE_VOUCHER } from '@/utils/voucherWebpay'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const datosMnp = useDatosAlumnoMnpStore()
const alumnoCtx = useMatriculaAlumnoContextStore()
const fuente = useAlumnoRematriculaFuente()
const retencion = useRetencionRematricula()

const cargando = ref(true)
const mensaje = ref('')
const mostrarReintentar = ref(false)
const redirigiendo = ref(false)
const voucher = ref<VoucherWebpay | null>(null)
const filaVoucher = ref<FilaPublica | null>(null)
const continuarFallido = ref(false)
const continuando = ref(false)
const borradorPersistido = ref(false)
const guardandoAvance = ref(false)
const comprobanteAbierto = ref(false)

const esMatriculaAutorizada = computed(
  () =>
    filaVoucher.value?.concepto === 'matricula' && filaVoucher.value?.estado === 'autorizada',
)

const senalesCta = computed((): SenalesRetencionRematricula => ({
  medioMatricula: alumnoCtx.medioMatricula,
  medioArancel: alumnoCtx.medioArancel,
  webpayMatriculaEstado: alumnoCtx.webpayMatriculaEstado,
  webpayArancelEstado: alumnoCtx.webpayArancelEstado,
  pagoMatricula: alumnoCtx.pagoMatricula,
  firmaCompletada: alumnoCtx.firmaCompletada,
  arancelPorPagar: alumnoCtx.webpayMontoArancel,
  periodoActivo: true,
}))

const ctaRetorno = computed(() => ctaContinuarRetornoMatricula(senalesCta.value))

const resumenComprobante = computed(() => {
  const v = voucher.value
  if (!v) return ''
  const monto = v.lineas.find((l) => /monto|total|amount/i.test(l.etiqueta))?.valor
  const fecha = v.lineas.find((l) => /fecha|date/i.test(l.etiqueta))?.valor
  const partes = [monto, fecha].filter(Boolean)
  return partes.length > 0 ? partes.join(' · ') : v.titulo
})

const nombreCorto = computed(() => {
  const n = fuente.nombreMostrado.value.trim()
  if (!n || n === '—') return ''
  return n.split(/\s+/)[0] ?? ''
})

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

async function persistirConReintento(fila: FilaPublica): Promise<boolean> {
  guardandoAvance.value = true
  try {
    const r = await reintentarFlushBorrador(() => guardarEstadoConcepto(fila), {
      maxIntentos: 4,
      baseMs: 1_000,
    })
    borradorPersistido.value = r.ok
    if (r.ok) {
      emitirRetencionAudit({
        accion: 'persistencia_ok',
        ...contextoAuditAlumno(fila),
        payload: { intentos: r.intentos, buy_order: fila.buyOrder },
      })
      return true
    }
    emitirRetencionAudit({
      accion: 'persistencia_error',
      ...contextoAuditAlumno(fila),
      payload: { intentos: r.intentos, buy_order: fila.buyOrder },
    })
    return false
  } finally {
    guardandoAvance.value = false
  }
}

async function asegurarBorradorPersistido(fila: FilaPublica): Promise<boolean> {
  if (borradorPersistido.value) {
    const ok = await alumnoCtx.flushBorrador()
    if (ok) return true
  }
  const ok = await persistirConReintento(fila)
  if (ok) return true
  auditarContinuarError(fila, motivoContinuarError('persistencia'))
  mostrarErrorRematricula(
    'Tu pago está recibido. No pudimos guardar el avance. Reintenta antes de continuar.',
  )
  mostrarReintentar.value = true
  return false
}

async function reintentarGuardarAvance(): Promise<void> {
  const fila = filaVoucher.value
  if (!fila || guardandoAvance.value) return
  const ok = await persistirConReintento(fila)
  if (!ok) {
    mostrarErrorRematricula(
      'Tu pago está recibido; reintenta guardar el avance. No vuelvas a pagar la matrícula.',
    )
  }
}

const ESPERA_AUDIT_ANTES_WEBPAY_MS = 1_000

function emitirWebpayAudit(params: RegistrarWebpayAuditParams): void {
  void registrarWebpayAudit(params).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[WebpayAudit]', message)
  })
}

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
    retencion.marcarTransferenciaExterna(true)
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
  if (!borradorPersistido.value) {
    await reintentarGuardarAvance()
    if (!borradorPersistido.value) return
  }
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
      if (filaInvalida) await persistirConReintento(filaInvalida)
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

  const persistido = await persistirConReintento(fila)
  if (!persistido) {
    mostrarErrorRematricula(
      'Tu pago está recibido; reintenta guardar el avance. No vuelvas a pagar la matrícula.',
    )
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
    <div v-if="cargando || redirigiendo" class="flex flex-col items-center gap-3 py-16 text-muted-foreground">
      <Loader2 class="h-8 w-8 animate-spin" aria-hidden="true" />
      <p class="text-center text-lg">
        {{ redirigiendo ? 'Te estamos llevando al siguiente pago.' : 'Consultando el resultado del pago…' }}
      </p>
    </div>

    <template v-else-if="esMatriculaAutorizada && voucher">
      <Card class="border-orange-100 shadow-lg">
        <CardContent class="space-y-5 pt-8 pb-8">
          <span
            class="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
          >
            ✓ Webpay autorizado
          </span>
          <h1 class="text-2xl font-bold text-zinc-900 md:text-3xl">
            Pago de matrícula recibido
            <span class="mt-1 block text-[#FF5B00]">Paso 1 de 3</span>
          </h1>
          <p class="text-base leading-relaxed text-zinc-600">
            <template v-if="nombreCorto">¡Gracias, {{ nombreCorto }}! </template>
            Ya recibimos tu pago de matrícula. Ahora elige cómo pagarás tu arancel y firma el
            contrato para completar tu rematrícula.
          </p>

          <RetencionMicroStepper :paso-activo="2" />

          <div
            class="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-relaxed text-orange-900"
          >
            <p class="font-semibold">Tu rematrícula aún no está completa.</p>
            <p class="mt-1">
              No vuelvas a pagar la matrícula: continúa con los pasos pendientes.
            </p>
          </div>

          <div
            v-if="!borradorPersistido"
            class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="alert"
          >
            <p class="font-semibold">Tu pago está recibido; reintenta guardar el avance.</p>
            <p class="mt-1">No podrás continuar hasta que el avance quede guardado.</p>
            <Button
              type="button"
              class="mt-3 cursor-pointer rounded-full bg-[#FF5B00] hover:bg-[#FF5B00]/90"
              :disabled="guardandoAvance"
              @click="reintentarGuardarAvance"
            >
              <Loader2 v-if="guardandoAvance" class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Reintentar
            </Button>
          </div>

          <Button
            type="button"
            class="h-14 w-full cursor-pointer rounded-full bg-[#FF5B00] text-base font-semibold hover:bg-[#FF5B00]/90 md:text-lg"
            :disabled="!borradorPersistido || continuando || guardandoAvance"
            @click="alContinuar"
          >
            <Loader2 v-if="continuando" class="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
            {{ ctaRetorno.label }} →
          </Button>
          <p class="text-center text-sm text-zinc-500">
            Puedes elegir Webpay o pagaré, según las opciones disponibles.
          </p>

          <div class="rounded-lg border border-zinc-200 p-4">
            <button
              type="button"
              class="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
              @click="comprobanteAbierto = !comprobanteAbierto"
            >
              <span class="font-semibold text-zinc-800">Comprobante de matrícula</span>
              <span class="inline-flex items-center gap-1 text-sm text-[#4D98C5]">
                Ver detalle
                <ChevronDown
                  class="h-4 w-4 transition-transform"
                  :class="comprobanteAbierto ? 'rotate-180' : ''"
                  aria-hidden="true"
                />
              </span>
            </button>
            <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
              <span>{{ resumenComprobante }}</span>
              <button
                type="button"
                class="cursor-pointer text-[#4D98C5] underline-offset-2 hover:underline"
                :disabled="continuando"
                @click="alDescargar"
              >
                Descargar comprobante
              </button>
            </div>
            <div
              v-if="comprobanteAbierto"
              class="mt-4 border border-zinc-300 bg-white px-4 py-4 font-mono text-[13px] leading-snug text-zinc-900"
            >
              <p class="text-center text-sm font-semibold tracking-wide">COMPROBANTE DE VENTA</p>
              <p v-if="voucher.tipoTarjeta" class="mt-1 text-center">{{ voucher.tipoTarjeta }}</p>
              <p class="mt-2 text-center">{{ COMERCIO_VOUCHER.nombre }}</p>
              <p class="text-center">{{ COMERCIO_VOUCHER.direccion }}</p>
              <p class="text-center">RUT {{ COMERCIO_VOUCHER.rut }}</p>
              <p class="text-center">{{ COMERCIO_VOUCHER.codigo }}</p>
              <div class="my-3 border-t border-dashed border-zinc-400" />
              <div
                v-for="linea in voucher.lineas"
                :key="linea.etiqueta"
                class="flex items-baseline justify-between gap-3 py-0.5"
              >
                <span>{{ linea.etiqueta }}</span>
                <span class="break-all text-right">{{ linea.valor }}</span>
              </div>
              <div class="my-3 border-t border-dashed border-zinc-400" />
              <p v-for="pie in PIE_VOUCHER" :key="pie" class="text-center text-xs">{{ pie }}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>

    <template v-else>
      <Card class="border-orange-100 shadow-lg">
        <CardContent class="space-y-6 pt-8 pb-8">
          <h1 class="text-center text-2xl font-bold text-uniacc-orange md:text-3xl">
            Resultado del pago
          </h1>
          <p class="text-center text-lg text-muted-foreground">
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
        :ocupado="continuando || !borradorPersistido"
        @descargar="alDescargar"
        @continuar="alContinuar"
        @volver="alVolver"
      />
    </template>
  </div>
</template>
