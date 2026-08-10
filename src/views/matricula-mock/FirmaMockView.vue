<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Pencil, Search } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMockAlumnoFuente } from '@/composables/useMockAlumnoFuente'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'

const router = useRouter()
const mockCtx = useMockMatriculaContextStore()
const fuente = useMockAlumnoFuente()

const FES_OTP_MOCK = '112233'
const serieCedula = ref('')
const otpInstitucional = ref('')
const otpEnviado = ref(false)
const firmando = ref(false)

function descargaMock() {
  toast.message('Descarga de borrador del contrato (mock).')
}

async function enviarOtpInstitucional() {
  otpEnviado.value = true
  toast.message(`OTP institucional mock enviado a ${fuente.correoInstitucionalMostrado}. Código demo: ${FES_OTP_MOCK}`)
}

async function firmarContrato() {
  if (!serieCedula.value.trim()) {
    toast.error('Ingresa la serie de tu cédula.')
    return
  }
  if (!otpEnviado.value) {
    toast.error('Solicita el OTP institucional primero.')
    return
  }
  if (otpInstitucional.value.replace(/\D/g, '') !== FES_OTP_MOCK) {
    toast.error('OTP incorrecto (mock).')
    return
  }
  firmando.value = true
  try {
    await new Promise((r) => setTimeout(r, 500))
    mockCtx.setFirmaCompletada(true)
    toast.success('Firma electrónica simulada correctamente.')
    void router.push({ name: 'matricula-mock-resumen' })
  } finally {
    firmando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-muted-foreground">
      Vista 08 — Firma electrónica simple (FES mock): revisa el contrato y firma con serie de cédula + OTP
      institucional.
    </p>

    <Card class="shadow-md">
      <CardHeader>
        <CardTitle>Firma electrónica del contrato</CardTitle>
        <CardDescription>
          Estudiante: {{ fuente.nombreMostrado }} · RUT {{ fuente.rutMostrado }}
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
          <div class="flex gap-3">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <Search class="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p class="font-semibold">1. Revisa el contrato</p>
              <p class="text-sm text-muted-foreground">Vista previa simulada del contrato de matrícula.</p>
            </div>
          </div>
          <div class="flex gap-3">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
              <Pencil class="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p class="font-semibold">2. Firma estudiante</p>
              <p class="text-sm font-medium">{{ fuente.nombreMostrado }}</p>
            </div>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="serie-cedula">Serie cédula de identidad</Label>
            <Input id="serie-cedula" v-model="serieCedula" placeholder="Ej. A12345678" autocomplete="off" />
          </div>
          <div class="space-y-2">
            <Label for="otp-fes">OTP institucional (mock: {{ FES_OTP_MOCK }})</Label>
            <div class="flex flex-wrap gap-2">
              <Input
                id="otp-fes"
                v-model="otpInstitucional"
                inputmode="numeric"
                maxlength="6"
                placeholder="000000"
                class="max-w-[160px] font-mono"
              />
              <Button type="button" variant="secondary" @click="enviarOtpInstitucional">
                Enviar OTP
              </Button>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <Button variant="outline" class="gap-2" type="button" @click="descargaMock">
            <Download class="h-4 w-4" />
            Descarga borrador
          </Button>
          <Button
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            type="button"
            :disabled="firmando"
            @click="firmarContrato"
          >
            {{ firmando ? 'Firmando…' : 'Firmar contrato (mock FES)' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <div class="flex flex-wrap justify-between gap-3">
      <Button variant="outline" @click="router.push({ name: 'matricula-mock-forma-pago' })">Anterior</Button>
    </div>
  </div>
</template>
