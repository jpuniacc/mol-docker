<script setup lang="ts">
import { ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  crearWebpayQa,
  guardarTokenQa,
  redirigirAWebpay,
} from '@/services/webpayQaApi'
import type { ConceptoWebpay } from '@/services/webpayPlusApi'

const monto = ref<string>('1500')
const concepto = ref<ConceptoWebpay>('matricula')
const codcli = ref<string>('99999999')
const error = ref<string>('')
const enviando = ref<boolean>(false)

async function iniciar(): Promise<void> {
  if (enviando.value) return
  error.value = ''

  const montoNum = Number(String(monto.value).trim())
  if (!Number.isInteger(montoNum) || montoNum <= 0) {
    error.value = 'El monto debe ser un número entero mayor a 0.'
    return
  }

  const codcliLimpio = String(codcli.value).trim()
  if (codcliLimpio && !/^9999\d{4}$/.test(codcliLimpio)) {
    error.value = 'El codcli de prueba debe tener 8 dígitos y comenzar con 9999 (ej. 99999999).'
    return
  }

  enviando.value = true
  const res = await crearWebpayQa({
    monto: montoNum,
    concepto: concepto.value,
    ...(codcliLimpio ? { codcli: codcliLimpio } : {}),
  })

  if (!res.ok) {
    error.value = res.error
    enviando.value = false
    return
  }

  guardarTokenQa(res.buyOrder, res.token)
  redirigirAWebpay(res.url, res.token)
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-muted/30 p-4">
    <Card class="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle class="text-2xl text-uniacc-orange">Prueba Webpay QA</CardTitle>
        <CardDescription>
          Pantalla pública de prueba (ambiente de integración). No requiere inicio de sesión.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="iniciar">
          <div class="space-y-2">
            <Label for="webpay-qa-monto">Monto (CLP)</Label>
            <Input
              id="webpay-qa-monto"
              v-model="monto"
              type="number"
              inputmode="numeric"
              min="1"
              step="1"
              :disabled="enviando"
            />
          </div>

          <div class="space-y-2">
            <Label for="webpay-qa-concepto">Concepto</Label>
            <select
              id="webpay-qa-concepto"
              v-model="concepto"
              :disabled="enviando"
              class="flex h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="matricula">Matrícula</option>
              <option value="arancel">Arancel</option>
            </select>
          </div>

          <div class="space-y-2">
            <Label for="webpay-qa-codcli">Código de cliente (codcli)</Label>
            <Input id="webpay-qa-codcli" v-model="codcli" type="text" :disabled="enviando" />
          </div>

          <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>

          <Button
            type="submit"
            class="w-full cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="enviando"
          >
            <Loader2 v-if="enviando" class="h-4 w-4 animate-spin" aria-hidden="true" />
            Ir a Webpay
          </Button>

          <p class="text-xs text-muted-foreground">
            Tarjetas de prueba: VISA 4051 8856 0044 6623, CVV 123, cualquier fecha futura; RUT 11.111.111-1,
            clave 123.
          </p>
        </form>
      </CardContent>
    </Card>
  </main>
</template>
