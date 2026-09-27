<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { fmtMontoClp } from '@/services/fetchPlanPagosMv'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'

const router = useRouter()
const alumnoCtx = useMatriculaAlumnoContextStore()
const fuente = useAlumnoRematriculaFuente()

const fmt = fmtMontoClp

const formaPagoLabel = computed(() => {
  const m = alumnoCtx.formaPagoSeleccionada
  if (!m) return 'No seleccionada'
  return { webpay: 'WebPay', pagare: 'Pagaré', toku: 'TOKU' }[m]
})

function contratoMock() {
  toast.message('Descarga de contrato firmado (mock).')
}

function pacPatMock() {
  toast.message('Suscripción PAC-PAT (mock).')
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
          Has finalizado exitosamente el proceso de matrícula (simulación mock).
        </p>

        <div class="mx-auto max-w-lg space-y-2 rounded-lg border bg-muted/40 px-4 py-4 text-sm">
          <p><span class="text-muted-foreground">RUT:</span> {{ fuente.rutMostrado }}</p>
          <p><span class="text-muted-foreground">Carrera:</span> {{ fuente.carreraMostrada }}</p>
          <p><span class="text-muted-foreground">Codcli:</span> {{ fuente.codcliMostrado }}</p>
          <p v-if="alumnoCtx.pagoMatricula?.monto != null">
            <span class="text-muted-foreground">Monto registrado:</span>
            {{ fmt(Number(alumnoCtx.pagoMatricula.monto)) }}
          </p>
          <p><span class="text-muted-foreground">Forma de pago:</span> {{ formaPagoLabel }}</p>
          <p v-if="alumnoCtx.discapacidad?.contesta">
            <span class="text-muted-foreground">Encuesta discapacidad:</span>
            {{ alumnoCtx.discapacidad.tipo }}
          </p>
        </div>

        <p class="text-center text-sm text-muted-foreground">
          Te hemos enviado un correo simulado a {{ fuente.correoInstitucionalMostrado }} con la documentación.
        </p>

        <div class="rounded-lg bg-muted/60 px-4 py-4 text-center text-sm">
          <p class="font-medium">Próximos pasos y contacto</p>
          <p class="mt-2 text-muted-foreground">
            WhatsApp +56 9 3452 7028 · Plataforma de servicio 800 240 100
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            class="bg-uniacc-orange rounded-full px-8 hover:bg-uniacc-orange/90"
            type="button"
            @click="contratoMock"
          >
            Descargar el contrato
          </Button>
          <Button
            class="bg-uniacc-orange rounded-full px-8 hover:bg-uniacc-orange/90"
            type="button"
            @click="pacPatMock"
          >
            Suscribir PAC-PAT
          </Button>
        </div>
      </CardContent>
    </Card>

    <div class="flex flex-wrap justify-between gap-3">
      <Button variant="outline" @click="router.push({ name: 'matricula-alumno-firma' })">Anterior</Button>
      <Button variant="secondary" @click="router.push({ name: 'dashboard-home' })">Volver al inicio</Button>
    </div>
  </div>
</template>
