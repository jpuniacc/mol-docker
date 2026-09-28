<script setup lang="ts">
import { ref } from 'vue'
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
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'

const router = useRouter()
const alumnoCtx = useMatriculaAlumnoContextStore()
const fuente = useAlumnoRematriculaFuente()
const { viewModel } = useContratoMatriculaViewModel('alumno')

const fmt = fmtMontoClp
const descargando = ref(false)

const formaPagoLabel = (): string => {
  const m = alumnoCtx.formaPagoSeleccionada
  if (!m) return 'No seleccionada'
  return { webpay: 'WebPay', pagare: 'Pagaré', toku: 'TOKU' }[m]
}

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
          Has finalizado el proceso de matrícula. Descarga el contrato desde aquí.
        </p>

        <div class="mx-auto max-w-lg space-y-2 rounded-lg border bg-muted/40 px-4 py-4 text-sm">
          <p><span class="text-muted-foreground">RUT:</span> {{ fuente.rutMostrado }}</p>
          <p><span class="text-muted-foreground">Carrera:</span> {{ fuente.carreraMostrada }}</p>
          <p><span class="text-muted-foreground">Codcli:</span> {{ fuente.codcliMostrado }}</p>
          <p v-if="alumnoCtx.pagoMatricula?.monto != null">
            <span class="text-muted-foreground">Monto registrado:</span>
            {{ fmt(Number(alumnoCtx.pagoMatricula.monto)) }}
          </p>
          <p><span class="text-muted-foreground">Forma de pago:</span> {{ formaPagoLabel() }}</p>
          <p v-if="alumnoCtx.discapacidad?.contesta">
            <span class="text-muted-foreground">Encuesta discapacidad:</span>
            {{ alumnoCtx.discapacidad.tipo }}
          </p>
        </div>

        <div class="rounded-lg bg-muted/60 px-4 py-4 text-center text-sm">
          <p class="font-medium">Próximos pasos y contacto</p>
          <p class="mt-2 text-muted-foreground">
            WhatsApp +56 9 3452 7028 · Plataforma de servicio 800 240 100
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
