<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useContratoMatriculaViewModel } from '@/composables/useContratoMatriculaViewModel'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { downloadContratoFirmaPdf } from '@/services/contratoFirmaApi'
import { downloadContratoPreviewPdf } from '@/services/contratoPreviewApi'
import { fmtMontoClp } from '@/services/fetchPlanPagosMv'
import { armarGrabarPlanPagos, postGrabarPlanPagos } from '@/services/grabarPlanPagosApi'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import type { MockDescuentoPagare, MockPagoMatricula } from '@/stores/mockMatriculaContext'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { useMatriculaFlujoPreflightStore } from '@/stores/datos_erp/matricula_flujo_preflight'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { etiquetaFormaPago } from '@/utils/etiquetaFormaPago'
import { resumenPagosWebpay } from '@/utils/resumenPagosWebpay'

const router = useRouter()
const alumnoCtx = useMatriculaAlumnoContextStore()
const alumnoMnp = useDatosAlumnoMnpStore()
const preflight = useMatriculaFlujoPreflightStore()
const periodoActivo = usePeriodoActivoStore()
const fuente = useAlumnoRematriculaFuente()
const { viewModel } = useContratoMatriculaViewModel('alumno')

const fmt = fmtMontoClp
const descargando = ref(false)

onMounted(() => {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
})

const grabacionIniciada = ref(false)

watch(
  () =>
    [
      alumnoCtx.firmaCompletada,
      alumnoMnp.primeraFila?.codigo_carrera,
      periodoActivo.anio,
      periodoActivo.semestre,
      alumnoCtx.pagoMatricula,
    ] as const,
  () => {
    if (!alumnoCtx.firmaCompletada || grabacionIniciada.value) return
    const armado = armarGrabarPlanPagos({
      rut: fuente.rutMostrado.value,
      codcliAcademico: fuente.codcliMostrado.value,
      codigoCarrera: alumnoMnp.primeraFila?.codigo_carrera ?? '',
      ano: periodoActivo.anio,
      periodo: periodoActivo.semestre,
      caja: preflight.steps?.caja.row?.caja ?? null,
      pago: alumnoCtx.pagoMatricula,
    })
    if (!armado.ok) return
    grabacionIniciada.value = true
    void postGrabarPlanPagos(armado.payload).then((res) => {
      if (!res.ok) {
        grabacionIniciada.value = false
        toast.error(res.error)
        return
      }
      if (!res.already) toast.success('Plan de pagos guardado en TEST.')
    })
  },
  { immediate: true },
)

const formaPagoLabel = (): string =>
  etiquetaFormaPago({
    medioMatricula: alumnoCtx.medioMatricula,
    medioArancel: alumnoCtx.medioArancel,
    formaPagoSeleccionada: alumnoCtx.formaPagoSeleccionada,
  })

type LineaPlan = {
  id: string
  etiqueta: string
  monto: number
  esDescuento: boolean
}

type BloquePlan = {
  titulo: string
  lineas: LineaPlan[]
  aPagar: number
  cuotaHabitual: number | null
  cuotaUltima: number | null
}

function fmtFechaIso(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!match) return iso
  return `${match[3]}/${match[2]}/${match[1]}`
}

function fmtPorcentaje(valor: number): string {
  const redondeado = Math.round(valor * 100) / 100
  return Number.isInteger(redondeado) ? String(redondeado) : String(redondeado)
}

function etiquetaDescuento(descuento: MockDescuentoPagare): string {
  const nombre = descuento.descripcion.trim() || descuento.tipoDocumento.trim() || 'Descuento'
  if (descuento.porc != null && descuento.porc > 0) {
    return `${nombre} (${fmtPorcentaje(descuento.porc)} %)`
  }
  return nombre
}

function descuentosDe(
  pago: MockPagoMatricula,
  concepto: 'matricula' | 'arancel',
): MockDescuentoPagare[] {
  return (pago.descuentos ?? []).filter((descuento) => descuento.concepto === concepto && descuento.monto > 0)
}

function bloquePlan(
  pago: MockPagoMatricula,
  titulo: string,
  concepto: 'matricula' | 'arancel',
  itemCuota: 'MATRICULA' | 'ARANCEL',
  bruto: number | undefined,
): BloquePlan | null {
  const descuentos = descuentosDe(pago, concepto)
  const sumaDescuentos = descuentos.reduce((total, descuento) => total + descuento.monto, 0)
  const cuotas = (pago.cuotasDetalle ?? [])
    .filter((cuota) => cuota.items === itemCuota)
    .reduce((total, cuota) => total + cuota.monto, 0)
  const valor = bruto != null && bruto > 0 ? bruto : null
  const aPagar = valor != null ? Math.max(0, valor - sumaDescuentos) : cuotas
  const filasCuota = (pago.cuotasDetalle ?? [])
    .filter((cuota) => cuota.items === itemCuota)
    .slice()
    .sort((a, b) => a.cuota - b.cuota)
  const cuotaHabitual = filasCuota[0]?.monto ?? null
  const montoUltima = filasCuota[filasCuota.length - 1]?.monto ?? null
  const cuotaUltima =
    cuotaHabitual != null && montoUltima != null && montoUltima !== cuotaHabitual ? montoUltima : null
  if (valor == null && descuentos.length === 0 && aPagar <= 0) return null
  const lineas: LineaPlan[] = []
  if (valor != null) {
    lineas.push({ id: `${concepto}-valor`, etiqueta: 'Valor', monto: valor, esDescuento: false })
  }
  for (const descuento of descuentos) {
    lineas.push({
      id: descuento.documento || `${concepto}-${descuento.descripcion}`,
      etiqueta: etiquetaDescuento(descuento),
      monto: descuento.monto,
      esDescuento: true,
    })
  }
  return { titulo, lineas, aPagar, cuotaHabitual, cuotaUltima }
}

const pagosWebpay = computed(() =>
  resumenPagosWebpay({
    medioMatricula: alumnoCtx.medioMatricula,
    medioArancel: alumnoCtx.medioArancel,
    montoMatricula: alumnoCtx.webpayMontoMatricula,
    montoArancel: alumnoCtx.webpayMontoArancel,
    detalleMatricula: alumnoCtx.webpayMatriculaDetalle,
    detalleArancel: alumnoCtx.webpayArancelDetalle,
  }),
)

const planResumen = computed(() => {
  const pago = alumnoCtx.pagoMatricula
  if (!pago) return null
  const bloques = [
    bloquePlan(pago, 'Matrícula', 'matricula', 'MATRICULA', pago.valorMatriculaBruto),
    bloquePlan(pago, 'Arancel', 'arancel', 'ARANCEL', pago.valorArancelBruto),
  ].filter((bloque): bloque is BloquePlan => bloque != null)
  if (bloques.length === 0 && pago.monto <= 0) return null
  const partes: string[] = []
  if (pago.cuotas != null) partes.push(`${pago.cuotas} cuotas`)
  if (pago.diaVencimiento != null) partes.push(`día ${pago.diaVencimiento}`)
  if (pago.fechaInicio) partes.push(`primera cuota ${fmtFechaIso(pago.fechaInicio)}`)
  return {
    detalleCuotas: partes.join(' · '),
    bloques,
    total: pago.monto,
  }
})

function guardarPdf(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

async function descargarContrato(): Promise<void> {
  const vm = viewModel.value
  const numOp = (alumnoCtx.pagoMatricula?.numOperacion ?? vm?.numOperacion ?? '').trim()
  const operacionValida = numOp.length > 0 && numOp !== '—'
  if (!vm && !operacionValida) {
    toast.error('Confirma el plan de pagos antes de descargar el contrato.')
    return
  }

  descargando.value = true
  try {
    if (operacionValida) {
      const firmado = await downloadContratoFirmaPdf(numOp)
      if (firmado.ok) {
        guardarPdf(firmado.blob, `contrato-${numOp}.pdf`)
        toast.success('Contrato descargado.')
        return
      }
    }

    if (!vm) {
      toast.error('No se pudo descargar el contrato.')
      return
    }

    const res = await downloadContratoPreviewPdf(vm)
    if (!res.ok || !res.blob) {
      toast.error(res.error || 'No se pudo generar el contrato')
      return
    }
    guardarPdf(res.blob, `contrato-${operacionValida ? numOp : 'borrador'}.pdf`)
    toast.success('Contrato descargado.')
  } finally {
    descargando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <Card class="border-orange-100 shadow-lg">
      <CardContent class="space-y-6 pt-8 pb-8">
        <h1 class="text-center text-2xl font-bold text-uniacc-orange md:text-3xl">
          ¡Felicitaciones {{ fuente.nombreMostrado }}!
        </h1>
        <p class="text-center text-lg text-muted-foreground">
          Has finalizado el proceso de matrícula. Descarga el contrato presionando el botón más abajo.
        </p>

        <div class="mx-auto max-w-lg space-y-2 rounded-lg border bg-muted/40 px-4 py-4 text-sm">
          <p><span class="text-muted-foreground">RUT:</span> {{ fuente.rutMostrado }}</p>
          <p><span class="text-muted-foreground">Carrera:</span> {{ fuente.carreraMostrada }}</p>
          <p><span class="text-muted-foreground">Codcli:</span> {{ fuente.codcliMostrado }}</p>
          <p><span class="text-muted-foreground">Forma de pago:</span> {{ formaPagoLabel() }}</p>
          <p v-if="alumnoCtx.discapacidad?.contesta">
            <span class="text-muted-foreground">Encuesta discapacidad:</span>
            {{ alumnoCtx.discapacidad.tipo }}
          </p>
        </div>

        <section
          v-if="pagosWebpay"
          class="mx-auto max-w-lg overflow-hidden rounded-lg border border-zinc-200"
          aria-labelledby="pagos-webpay-titulo"
        >
          <div class="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <h2 id="pagos-webpay-titulo" class="text-base font-semibold text-zinc-900">
              Pagos con Webpay
            </h2>
          </div>
          <div
            v-for="bloque in pagosWebpay.bloques"
            :key="bloque.titulo"
            class="border-b border-zinc-200 px-4 py-3"
          >
            <h3 class="text-sm font-semibold text-zinc-900">{{ bloque.titulo }}</h3>
            <dl class="mt-2 space-y-1.5">
              <div
                v-if="bloque.saldo != null"
                class="flex items-baseline justify-between gap-3 text-sm"
              >
                <dt class="text-zinc-700">Saldo</dt>
                <dd class="shrink-0 tabular-nums text-zinc-900">{{ fmt(bloque.saldo) }}</dd>
              </div>
              <div
                v-if="bloque.descuento != null && bloque.descuento > 0"
                class="flex items-baseline justify-between gap-3 text-sm"
              >
                <dt class="text-zinc-700">Descuento Webpay 5 %</dt>
                <dd class="shrink-0 tabular-nums text-zinc-900">−{{ fmt(bloque.descuento) }}</dd>
              </div>
              <div
                class="flex items-baseline justify-between gap-3 text-sm"
                :class="bloque.saldo != null ? 'border-t border-zinc-200 pt-1.5' : ''"
              >
                <dt class="font-medium text-zinc-900">Pagado</dt>
                <dd class="shrink-0 font-medium tabular-nums text-zinc-900">{{ fmt(bloque.pagado) }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <dt class="text-zinc-700">Tarjeta</dt>
                <dd class="shrink-0 text-zinc-900">{{ bloque.tarjeta }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <dt class="text-zinc-700">Cuotas</dt>
                <dd class="shrink-0 text-zinc-900">{{ bloque.cuotas }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <dt class="text-zinc-700">Autorización</dt>
                <dd class="shrink-0 tabular-nums text-zinc-900">{{ bloque.autorizacion }}</dd>
              </div>
            </dl>
          </div>
          <div class="flex items-baseline justify-between gap-3 bg-uniacc-orange/10 px-4 py-3">
            <p class="text-sm font-semibold text-zinc-900">Total pagado con Webpay</p>
            <p class="shrink-0 text-base font-semibold tabular-nums text-zinc-900">
              {{ fmt(pagosWebpay.total) }}
            </p>
          </div>
        </section>

        <section
          v-if="planResumen"
          class="mx-auto max-w-lg overflow-hidden rounded-lg border border-zinc-200"
          aria-labelledby="plan-pagos-titulo"
        >
          <div class="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <h2 id="plan-pagos-titulo" class="text-base font-semibold text-zinc-900">Plan de pagos</h2>
            <p v-if="planResumen.detalleCuotas" class="mt-1 text-sm text-zinc-700">
              {{ planResumen.detalleCuotas }}
            </p>
          </div>
          <div
            v-for="bloque in planResumen.bloques"
            :key="bloque.titulo"
            class="border-b border-zinc-200 px-4 py-3"
          >
            <h3 class="text-sm font-semibold text-zinc-900">{{ bloque.titulo }}</h3>
            <dl class="mt-2 space-y-1.5">
              <div
                v-for="linea in bloque.lineas"
                :key="linea.id"
                class="flex items-baseline justify-between gap-3 text-sm"
              >
                <dt class="text-zinc-700">{{ linea.etiqueta }}</dt>
                <dd class="shrink-0 tabular-nums text-zinc-900">
                  {{ linea.esDescuento ? `−${fmt(linea.monto)}` : fmt(linea.monto) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 border-t border-zinc-200 pt-1.5 text-sm">
                <dt class="font-medium text-zinc-900">A pagar</dt>
                <dd class="shrink-0 font-medium tabular-nums text-zinc-900">{{ fmt(bloque.aPagar) }}</dd>
              </div>
              <div
                v-if="bloque.cuotaHabitual != null"
                class="flex items-baseline justify-between gap-3 text-sm"
              >
                <dt class="text-zinc-700">Cada cuota</dt>
                <dd class="shrink-0 tabular-nums text-zinc-900">{{ fmt(bloque.cuotaHabitual) }}</dd>
              </div>
              <div
                v-if="bloque.cuotaUltima != null"
                class="flex items-baseline justify-between gap-3 text-sm"
              >
                <dt class="text-zinc-700">Última cuota</dt>
                <dd class="shrink-0 tabular-nums text-zinc-900">{{ fmt(bloque.cuotaUltima) }}</dd>
              </div>
            </dl>
          </div>
          <div class="flex items-baseline justify-between gap-3 bg-uniacc-orange/10 px-4 py-3">
            <p class="text-sm font-semibold text-zinc-900">
              {{ alumnoCtx.formaPagoSeleccionada === 'pagare' ? 'Total del pagaré' : 'Total a pagar' }}
            </p>
            <p class="shrink-0 text-base font-semibold tabular-nums text-zinc-900">
              {{ fmt(planResumen.total) }}
            </p>
          </div>
        </section>

        <div class="rounded-lg bg-muted/60 px-4 py-4 text-center text-sm">
          <p class="font-medium">Próximos pasos y contacto</p>
          <p class="mt-2 text-muted-foreground">
            WhatsApp +56 9 3452 7028
          </p>
        </div>

        <div class="flex justify-center">
          <Button
            class="cursor-pointer rounded-full bg-uniacc-orange px-8 hover:bg-uniacc-orange/90"
            type="button"
            :disabled="descargando"
            @click="descargarContrato"
          >
            <Loader2 v-if="descargando" class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            <Download v-else class="mr-2 h-4 w-4" aria-hidden="true" />
            {{ descargando ? 'Descargando…' : 'Descargar el contrato' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <div class="flex justify-end">
      <Button variant="secondary" class="cursor-pointer" @click="router.push({ name: 'dashboard-home' })">
        Volver al inicio
      </Button>
    </div>
  </div>
</template>
