<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { RefreshCw, Save } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_MAX,
  CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_MIN,
  CONTACTO_OTP_EMAIL_SEGUNDOS_MAX,
  CONTACTO_OTP_EMAIL_SEGUNDOS_MIN,
  CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_MAX,
  CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_MIN,
  CONTACTO_OTP_SMS_SEGUNDOS_MAX,
  CONTACTO_OTP_SMS_SEGUNDOS_MIN,
} from '@/constants/contactoOtpConfig'
import { useContactoOtpConfigStore } from '@/stores/contactoOtpConfig'

const store = useContactoOtpConfigStore()
const { config, loading, saving, error } = storeToRefs(store)

const emailSegundosDraft = ref('')
const smsSegundosDraft = ref('')
const emailReintentoSegundosDraft = ref('')
const smsReintentoSegundosDraft = ref('')
const confirmSaveOpen = ref(false)

const ultimaActualizacion = computed(() => {
  const iso = config.value?.updated_at
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    )
  } catch {
    return iso
  }
})

function syncDraftFromStore() {
  emailSegundosDraft.value = String(store.emailSegundos)
  smsSegundosDraft.value = String(store.smsSegundos)
  emailReintentoSegundosDraft.value = String(store.emailReintentoSegundos)
  smsReintentoSegundosDraft.value = String(store.smsReintentoSegundos)
}

watch(config, () => syncDraftFromStore(), { immediate: true })

function parseSegundos(
  raw: string | number,
  min: number,
  max: number,
  label: string,
): number | null {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    toast.error(`${label}: ingresa un número entero válido.`)
    return null
  }
  const n = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(n) || String(n) !== trimmed) {
    toast.error(`${label}: ingresa un número entero válido.`)
    return null
  }
  if (n < min || n > max) {
    toast.error(`${label}: debe estar entre ${min} y ${max} segundos.`)
    return null
  }
  return n
}

async function recargar() {
  await store.fetch()
  syncDraftFromStore()
}

function solicitarGuardar() {
  const email = parseSegundos(
    emailSegundosDraft.value,
    CONTACTO_OTP_EMAIL_SEGUNDOS_MIN,
    CONTACTO_OTP_EMAIL_SEGUNDOS_MAX,
    'Correo — validez',
  )
  if (email == null) return

  const sms = parseSegundos(
    smsSegundosDraft.value,
    CONTACTO_OTP_SMS_SEGUNDOS_MIN,
    CONTACTO_OTP_SMS_SEGUNDOS_MAX,
    'SMS — validez',
  )
  if (sms == null) return

  const emailReintento = parseSegundos(
    emailReintentoSegundosDraft.value,
    CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_MIN,
    CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_MAX,
    'Correo — espera entre reenvíos',
  )
  if (emailReintento == null) return

  const smsReintento = parseSegundos(
    smsReintentoSegundosDraft.value,
    CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_MIN,
    CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_MAX,
    'SMS — espera entre reenvíos',
  )
  if (smsReintento == null) return

  confirmSaveOpen.value = true
}

async function confirmarGuardar() {
  const email = parseSegundos(
    emailSegundosDraft.value,
    CONTACTO_OTP_EMAIL_SEGUNDOS_MIN,
    CONTACTO_OTP_EMAIL_SEGUNDOS_MAX,
    'Correo — validez',
  )
  const sms = parseSegundos(
    smsSegundosDraft.value,
    CONTACTO_OTP_SMS_SEGUNDOS_MIN,
    CONTACTO_OTP_SMS_SEGUNDOS_MAX,
    'SMS — validez',
  )
  const emailReintento = parseSegundos(
    emailReintentoSegundosDraft.value,
    CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_MIN,
    CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_MAX,
    'Correo — espera entre reenvíos',
  )
  const smsReintento = parseSegundos(
    smsReintentoSegundosDraft.value,
    CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_MIN,
    CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_MAX,
    'SMS — espera entre reenvíos',
  )
  if (email == null || sms == null || emailReintento == null || smsReintento == null) return

  const ok = await store.save({
    otpEmailSegundos: email,
    otpSmsSegundos: sms,
    otpEmailReintentoSegundos: emailReintento,
    otpSmsReintentoSegundos: smsReintento,
  })
  if (ok) {
    toast.success('Parámetros OTP actualizados.')
    confirmSaveOpen.value = false
    syncDraftFromStore()
  } else {
    toast.error(store.error ?? 'No se pudo guardar.')
  }
}

onMounted(() => {
  void recargar()
})
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Mantenedor OTP contacto</CardTitle>
          <CardDescription class="text-zinc-600">
            Tiempos de validez del código y espera entre reenvíos (segundos). Última actualización:
            {{ ultimaActualizacion }}
          </CardDescription>
        </div>
        <Button type="button" variant="outline" class="gap-1.5" :disabled="loading" @click="recargar">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          Recargar
        </Button>
      </CardHeader>
      <CardContent class="space-y-6">
        <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          El cambio aplica de inmediato en el flujo mock y en el OTP real de correo vía uniacc-api.
        </p>

        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <p v-if="loading && !config" class="text-sm text-muted-foreground">Cargando configuración…</p>

        <template v-else>
          <div class="grid gap-6 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="otp-email-segundos">Correo — validez del código (segundos)</Label>
              <Input
                id="otp-email-segundos"
                v-model="emailSegundosDraft"
                type="number"
                min="30"
                max="3600"
                :disabled="saving"
              />
              <p class="text-xs text-muted-foreground">
                Rango: {{ CONTACTO_OTP_EMAIL_SEGUNDOS_MIN }}–{{ CONTACTO_OTP_EMAIL_SEGUNDOS_MAX }} s
                (default 300 = 5 min).
              </p>
            </div>

            <div class="space-y-2">
              <Label for="otp-sms-segundos">SMS — validez del código (segundos)</Label>
              <Input
                id="otp-sms-segundos"
                v-model="smsSegundosDraft"
                type="number"
                min="30"
                max="3600"
                :disabled="saving"
              />
              <p class="text-xs text-muted-foreground">
                Rango: {{ CONTACTO_OTP_SMS_SEGUNDOS_MIN }}–{{ CONTACTO_OTP_SMS_SEGUNDOS_MAX }} s.
              </p>
            </div>

            <div class="space-y-2">
              <Label for="otp-email-reintento-segundos">
                Correo — espera entre reenvíos (segundos)
              </Label>
              <Input
                id="otp-email-reintento-segundos"
                v-model="emailReintentoSegundosDraft"
                type="number"
                min="5"
                max="600"
                :disabled="saving"
                class="max-w-xs"
              />
              <p class="text-xs text-muted-foreground">
                Rango: {{ CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_MIN }}–{{
                  CONTACTO_OTP_EMAIL_REINTENTO_SEGUNDOS_MAX
                }}
                s (default 30). Tiempo mínimo entre cada solicitud de reenvío.
              </p>
            </div>

            <div class="space-y-2">
              <Label for="otp-sms-reintento-segundos">
                SMS — espera entre reenvíos (segundos)
              </Label>
              <Input
                id="otp-sms-reintento-segundos"
                v-model="smsReintentoSegundosDraft"
                type="number"
                min="5"
                max="600"
                :disabled="saving"
                class="max-w-xs"
              />
              <p class="text-xs text-muted-foreground">
                Rango: {{ CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_MIN }}–{{
                  CONTACTO_OTP_SMS_REINTENTO_SEGUNDOS_MAX
                }}
                s (default 30). Tiempo mínimo entre cada solicitud de reenvío.
              </p>
            </div>
          </div>

          <Button
            type="button"
            class="gap-1.5 bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="saving || loading"
            @click="solicitarGuardar"
          >
            <Save class="h-4 w-4" />
            {{ saving ? 'Guardando…' : 'Guardar cambios' }}
          </Button>
        </template>
      </CardContent>
    </Card>

    <Dialog :open="confirmSaveOpen" @update:open="(v: boolean) => (confirmSaveOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar actualización</DialogTitle>
          <DialogDescription>
            ¿Aplicar los nuevos tiempos OTP? Afectará de inmediato al mock y al envío real de
            correo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" @click="confirmSaveOpen = false">Cancelar</Button>
          <Button
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="saving"
            @click="confirmarGuardar"
          >
            Confirmar y guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
