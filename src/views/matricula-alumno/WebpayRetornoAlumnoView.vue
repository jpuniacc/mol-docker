<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  crearWebpay,
  obtenerWebpay,
  redirigirAWebpay,
  type ConceptoWebpay,
  type FilaPublica,
} from '@/services/webpayPlusApi'
import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import {
  useMatriculaAlumnoContextStore,
  type WebpayConceptoEstado,
} from '@/stores/matriculaAlumnoContext'
import { detalleDesdeWebpay } from '@/utils/webpayPagoDetalle'
import { siguientePaso, type MedioConcepto } from '@/utils/webpaySiguientePaso'
import VoucherWebpayDialog from '@/components/matricula/VoucherWebpayDialog.vue'
import { armarVoucherWebpay, type VoucherWebpay } from '@/utils/voucherWebpay'
import { descargarVoucherWebpay } from '@/utils/voucherWebpayPdf'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const datosMnp = useDatosAlumnoMnpStore()
const alumnoCtx = useMatriculaAlumnoContextStore()

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

function guardarEstadoConcepto(fila: FilaPublica): void {
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
  const medioMatricula = alumnoCtx.medioMatricula
  const medioArancel: MedioConcepto | null = alumnoCtx.medioArancel
  if (medioMatricula == null) {
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
  })

  if (paso.tipo === 'webpay') {
    const monto =
      paso.concepto === 'matricula' ? alumnoCtx.webpayMontoMatricula : alumnoCtx.webpayMontoArancel
    if (monto == null || !Number.isInteger(monto) || monto <= 0) {
      mostrarErrorRematricula('No encontramos el monto del siguiente pago.')
      mostrarReintentar.value = true
      return
    }
    const creado = await crearWebpay({
      codcli: fila.codcli,
      anio: fila.anioPeriodo,
      periodo: fila.semestrePeriodo,
      concepto: paso.concepto,
      monto,
    })
    if (!creado.ok) {
      mostrarErrorRematricula(creado.error)
      mostrarReintentar.value = true
      return
    }
    redirigiendo.value = true
    redirigirAWebpay(creado.url, creado.token)
    return
  }

  if (paso.tipo === 'elegir-arancel') {
    irAFormaPago()
    return
  }

  if (paso.tipo === 'plan-pagare') {
    irAFormaPago(paso.concepto)
    return
  }

  if (paso.tipo === 'firma') {
    alumnoCtx.marcarPasoAlcanzado(3)
    void router.push({ name: 'matricula-alumno-firma' })
    return
  }

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

function alVolver(): void {
  const estado = filaVoucher.value?.estado
  const aviso = estado === 'rechazada' || estado === 'abortada' ? estado : undefined
  irAFormaPago(undefined, aviso)
}

onMounted(async () => {
  const errorQuery = primerQuery(route.query.error)
  const buyOrder = primerQuery(route.query.buy_order)

  if (errorQuery === 'retorno-invalido') {
    mensaje.value = 'No pudimos leer el resultado del pago.'
    mostrarReintentar.value = true
    if (buyOrder) {
      const fila = await obtenerWebpay(buyOrder)
      if (fila) guardarEstadoConcepto(fila)
    }
    cargando.value = false
    return
  }

  if (!buyOrder) {
    mensaje.value = 'No pudimos leer el resultado del pago.'
    mostrarReintentar.value = true
    cargando.value = false
    return
  }

  const fila = await obtenerWebpay(buyOrder)
  if (!fila) {
    mensaje.value = 'No pudimos leer el resultado del pago.'
    mostrarReintentar.value = true
    cargando.value = false
    return
  }

  guardarEstadoConcepto(fila)

  const armado = armarVoucherWebpay(fila)
  if (!armado) {
    mensaje.value = 'No pudimos leer el resultado del pago.'
    mostrarReintentar.value = true
    cargando.value = false
    return
  }

  filaVoucher.value = fila
  voucher.value = armado
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
        <p v-else class="text-center text-lg text-muted-foreground">{{ mensaje }}</p>
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
