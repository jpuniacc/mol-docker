<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Loader2, Mail } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import ContratoPrestacionServiciosPreview from '@/components/rematricula/ContratoPrestacionServiciosPreview.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useContratoMatriculaViewModel } from '@/composables/useContratoMatriculaViewModel'
import { useMockAlumnoFuente } from '@/composables/useMockAlumnoFuente'
import {
  ensureContratoFirma,
  getContratoFirmaEstado,
  type ContratoFirmaEstadoResponse,
  type ContratoFirmaFirmanteEstado,
} from '@/services/contratoFirmaApi'
import { downloadContratoPreviewPdf } from '@/services/contratoPreviewApi'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'
import { esPropioSostenedor } from '@/utils/apoderadoResponsable'

const POLL_MS = 5000

const router = useRouter()
const mockCtx = useMockMatriculaContextStore()
const fuente = useMockAlumnoFuente()
const { viewModel, tienePlanConfirmado } = useContratoMatriculaViewModel()

const descargando = ref(false)
const aceptado = ref(false)
const enviando = ref(false)
const errorFirma = ref<string | null>(null)
const firmantes = ref<ContratoFirmaFirmanteEstado[]>([])
const numOperacionFirma = ref<string | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let unmounted = false

function clearPoll(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function completarYNavegar(): void {
  clearPoll()
  mockCtx.setFirmaCompletada(true)
  void router.push({ name: 'matricula-mock-resumen' })
}

function aplicarEstadoOk(estado: Extract<ContratoFirmaEstadoResponse, { ok: true }>): void {
  firmantes.value = estado.firmantes
  numOperacionFirma.value = estado.numOperacion
  if (estado.ready) {
    completarYNavegar()
  }
}

async function pollEstado(numOperacion: string): Promise<void> {
  const res = await getContratoFirmaEstado(numOperacion)
  if (unmounted || !res.ok) {
    return
  }
  aplicarEstadoOk(res)
}

function iniciarPoll(numOperacion: string): void {
  clearPoll()
  pollTimer = setInterval(() => {
    void pollEstado(numOperacion)
  }, POLL_MS)
}

async function enviarAFirmar(): Promise<void> {
  const vm = viewModel.value
  if (!vm || enviando.value) {
    return
  }

  clearPoll()
  enviando.value = true
  errorFirma.value = null

  try {
    const incluirApoderado = !esPropioSostenedor(fuente.plan.value?.es_responsable_financiero)
    const codcli = fuente.codcliMostrado.value
    const res = await ensureContratoFirma({
      ...vm,
      incluirApoderado,
      codcli,
    })

    if (unmounted) {
      return
    }

    if (!res.ok) {
      errorFirma.value = res.error
      return
    }

    aplicarEstadoOk(res)
    if (!res.ready) {
      iniciarPoll(res.numOperacion)
    }
  } finally {
    enviando.value = false
  }
}

onUnmounted(() => {
  unmounted = true
  clearPoll()
})

async function descargaBorrador(): Promise<void> {
  const vm = viewModel.value
  if (!vm) {
    toast.error('Confirma el plan de pagos antes de descargar el contrato.')
    return
  }
  descargando.value = true
  try {
    const res = await downloadContratoPreviewPdf(vm)
    if (!res.ok || !res.blob) {
      toast.error(res.error || 'No se pudo generar el PDF')
      return
    }
    const url = URL.createObjectURL(res.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contrato-${vm.numOperacion || 'borrador'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Borrador del contrato descargado.')
  } finally {
    descargando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-muted-foreground">
      Revisa el contrato. Cuando lo aceptes, se envía a firmar por correo.
    </p>

    <Card v-if="!tienePlanConfirmado" class="shadow-md border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle>Falta el plan de pagos</CardTitle>
        <CardDescription>
          Confirma el plan de pagos en el paso anterior para ver el contrato con los datos de
          {{ fuente.nombreMostrado }}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          class="bg-uniacc-orange hover:bg-uniacc-orange/90"
          type="button"
          @click="router.push({ name: 'matricula-mock-forma-pago' })"
        >
          Ir a forma de pago
        </Button>
      </CardContent>
    </Card>

    <template v-else>
      <Card class="shadow-md">
        <CardHeader>
          <CardTitle>1. Revisa el contrato</CardTitle>
          <CardDescription>
            Estudiante: {{ fuente.nombreMostrado }} · RUT {{ fuente.rutMostrado }} · Op.
            {{ viewModel?.numOperacion }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            class="max-h-[70vh] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-100/80 p-2"
          >
            <ContratoPrestacionServiciosPreview v-if="viewModel" :model="viewModel" />
          </div>
          <div class="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              class="gap-2"
              type="button"
              :disabled="descargando"
              @click="descargaBorrador"
            >
              <Download class="h-4 w-4" />
              {{ descargando ? 'Generando…' : 'Descarga borrador' }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card v-if="firmantes.length === 0 && !enviando && !errorFirma" class="shadow-md">
        <CardHeader>
          <CardTitle>2. Acepta y envía a firmar</CardTitle>
          <CardDescription>
            El contrato queda en pantalla para que lo revises. Recién al aceptarlo se envía a
            TuFirma.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <label class="flex cursor-pointer items-start gap-3 text-sm text-zinc-800">
            <Checkbox
              :checked="aceptado"
              class="mt-0.5 cursor-pointer"
              @update:checked="(v: boolean) => (aceptado = v === true)"
            />
            <span>Acepto el contrato de prestación de servicios y quiero enviarlo a firmar.</span>
          </label>
          <div class="flex justify-end">
            <Button
              type="button"
              class="cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
              :disabled="!aceptado"
              @click="enviarAFirmar"
            >
              Enviar a firmar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card v-else class="shadow-md">
        <CardHeader>
          <CardTitle>Firma del contrato</CardTitle>
          <CardDescription>
            Enviamos el contrato a firmar por correo. Esta pantalla espera a que firmen todos.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div
            v-if="enviando && firmantes.length === 0 && !errorFirma"
            class="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-muted-foreground"
          >
            <Loader2 class="h-5 w-5 shrink-0 animate-spin text-uniacc-orange" aria-hidden="true" />
            <span>Enviando el contrato a firmar…</span>
          </div>

          <Alert v-if="errorFirma" variant="destructive">
            <AlertTitle>No se pudo enviar el contrato a firmar</AlertTitle>
            <AlertDescription class="mt-2 space-y-3">
              <p>{{ errorFirma }}</p>
              <Button type="button" variant="secondary" :disabled="enviando" @click="enviarAFirmar">
                {{ enviando ? 'Reintentando…' : 'Reintentar' }}
              </Button>
            </AlertDescription>
          </Alert>

          <div v-if="firmantes.length > 0" class="space-y-3">
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail class="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Firmar desde el correo. Operación
                {{ numOperacionFirma || viewModel?.numOperacion }}.
              </span>
            </div>
            <ul class="divide-y rounded-md border" role="list">
              <li
                v-for="(firmante, idx) in firmantes"
                :key="`${firmante.rol}-${firmante.email}-${idx}`"
                class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div class="min-w-0">
                  <p class="font-medium text-foreground">{{ firmante.nombre }}</p>
                  <p class="text-sm text-muted-foreground">{{ firmante.email }}</p>
                </div>
                <Badge :variant="firmante.ready ? 'success' : 'warning'">
                  {{ firmante.ready ? 'Firmado' : 'Pendiente' }}
                </Badge>
              </li>
            </ul>
            <p
              v-if="!errorFirma"
              class="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 class="h-4 w-4 shrink-0 animate-spin text-uniacc-orange" aria-hidden="true" />
              Esperando firmas…
            </p>
          </div>
        </CardContent>
      </Card>
    </template>

    <div class="flex flex-wrap justify-between gap-3">
      <Button variant="outline" @click="router.push({ name: 'matricula-mock-forma-pago' })">
        Anterior
      </Button>
    </div>
  </div>
</template>
