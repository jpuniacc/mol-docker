<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Loader2, Mail } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import ContratoPrestacionServiciosPreview from '@/components/rematricula/ContratoPrestacionServiciosPreview.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useContratoMatriculaViewModel } from '@/composables/useContratoMatriculaViewModel'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { fetchPlanPagosMvByCodcli } from '@/services/fetchPlanPagosMv'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import {
  ensureContratoFirma,
  getContratoFirmaEstado,
  type ContratoFirmaEstadoResponse,
  type ContratoFirmaFirmanteEstado,
} from '@/services/contratoFirmaApi'
import { downloadContratoPreviewPdf } from '@/services/contratoPreviewApi'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { esPropioSostenedor } from '@/utils/apoderadoResponsable'

const POLL_MS = 5000

const router = useRouter()
const alumnoCtx = useMatriculaAlumnoContextStore()
const fuente = useAlumnoRematriculaFuente()
const { viewModel, tienePlanConfirmado } = useContratoMatriculaViewModel('alumno')

const descargando = ref(false)
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
  alumnoCtx.setFirmaCompletada(true)
  void router.push({ name: 'matricula-alumno-resumen' })
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
    const codcliRaw = fuente.codcliMostrado.value
    const codcli = codcliRaw === '—' ? undefined : codcliRaw.trim()
    let esResponsableFinanciero: string | null | undefined
    if (codcli && periodoActivo.anio != null && periodoActivo.semestre != null) {
      const { data: planRow } = await fetchPlanPagosMvByCodcli({
        codcli,
        anioMatricula: periodoActivo.anio,
        periodoMatricula: periodoActivo.semestre,
      })
      esResponsableFinanciero = planRow?.es_responsable_financiero
    }
    const incluirApoderado = !esPropioSostenedor(esResponsableFinanciero)
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

watch(
  tienePlanConfirmado,
  (ok: boolean) => {
    if (ok) {
      void enviarAFirmar()
    } else {
      clearPoll()
    }
  },
  { immediate: true },
)

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
      Vista 08 — Firma del contrato: revisa el contrato y espera a que firmen todos por correo.
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
          @click="router.push({ name: 'matricula-alumno-forma-pago' })"
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

      <Card class="shadow-md">
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
      <Button variant="outline" @click="router.push({ name: 'matricula-alumno-forma-pago' })">
        Anterior
      </Button>
    </div>
  </div>
</template>
