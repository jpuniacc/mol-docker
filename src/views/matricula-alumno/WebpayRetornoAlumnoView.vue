<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  crearWebpay,
  obtenerWebpay,
  redirigirAWebpay,
  type ConceptoWebpay,
  type FilaPublica,
} from '@/services/webpayPlusApi'
import {
  useMatriculaAlumnoContextStore,
  type WebpayConceptoEstado,
} from '@/stores/matriculaAlumnoContext'
import { siguientePaso } from '@/utils/webpaySiguientePaso'

const route = useRoute()
const router = useRouter()
const alumnoCtx = useMatriculaAlumnoContextStore()

const cargando = ref(true)
const mensaje = ref('')
const mostrarReintentar = ref(false)
const redirigiendo = ref(false)

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
  if (fila.concepto === 'matricula') {
    alumnoCtx.setWebpayMatriculaEstado(estado)
  } else {
    alumnoCtx.setWebpayArancelEstado(estado)
  }
}

function irAFormaPago(plan?: ConceptoWebpay): void {
  void router.push(
    plan
      ? { name: 'matricula-alumno-forma-pago', query: { plan } }
      : { name: 'matricula-alumno-forma-pago' },
  )
}

async function avanzarSiAutorizada(fila: FilaPublica): Promise<void> {
  const medioMatricula = alumnoCtx.medioMatricula
  const medioArancel = alumnoCtx.medioArancel
  if (medioMatricula == null || medioArancel == null) {
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
      toast.error('No encontramos el monto del siguiente pago.')
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
      toast.error(creado.error)
      mostrarReintentar.value = true
      return
    }
    redirigiendo.value = true
    redirigirAWebpay(creado.url, creado.token)
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
  cargando.value = false

  if (fila.estado === 'autorizada') {
    mensaje.value = 'El pago quedó autorizado.'
    await avanzarSiAutorizada(fila)
    return
  }

  if (fila.estado === 'rechazada' || fila.estado === 'abortada') {
    mensaje.value = 'El pago no se completó.'
    mostrarReintentar.value = true
    return
  }

  mensaje.value = 'No pudimos leer el resultado del pago.'
  mostrarReintentar.value = true
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
  </div>
</template>
