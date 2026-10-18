<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { leerTokenQa, obtenerWebpayQa, type FilaQa } from '@/services/webpayQaApi'

const route = useRoute()

const cargando = ref<boolean>(true)
const fila = ref<FilaQa | null>(null)
const buyOrder = ref<string>('')
const token = ref<string | null>(null)
const mensaje = ref<string>('')
const copiado = ref<boolean>(false)

function primerQuery(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim()
  return ''
}

function valor(v: string | number | null | undefined): string {
  return v == null || v === '' ? '—' : String(v)
}

async function copiarToken(): Promise<void> {
  if (!token.value) return
  try {
    await navigator.clipboard.writeText(token.value)
    copiado.value = true
    setTimeout(() => {
      copiado.value = false
    }, 2000)
  } catch {
    mensaje.value = 'No se pudo copiar el token al portapapeles.'
  }
}

onMounted(async () => {
  const errorQuery = primerQuery(route.query.error)
  buyOrder.value = primerQuery(route.query.buy_order)

  if (errorQuery) {
    mensaje.value = 'No pudimos leer el resultado del pago.'
  }

  if (!buyOrder.value) {
    if (!mensaje.value) mensaje.value = 'Falta el parámetro buy_order en la URL.'
    cargando.value = false
    return
  }

  const resultado = await obtenerWebpayQa(buyOrder.value)
  fila.value = resultado
  token.value = resultado?.token ?? leerTokenQa(buyOrder.value)
  if (!resultado && !mensaje.value) {
    mensaje.value = 'No encontramos la transacción.'
  }
  cargando.value = false
})
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-muted/30 p-4">
    <Card class="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle class="text-2xl text-uniacc-orange">Resultado Webpay QA</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="cargando" class="flex items-center gap-3 text-muted-foreground">
          <Loader2 class="h-6 w-6 animate-spin" aria-hidden="true" />
          <p>Consultando el resultado del pago…</p>
        </div>

        <template v-else>
          <p v-if="mensaje" class="text-sm text-destructive" role="alert">{{ mensaje }}</p>

          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt class="font-medium">Estado</dt>
            <dd>{{ valor(fila?.estado) }}</dd>
            <dt class="font-medium">Buy order</dt>
            <dd class="break-all">{{ valor(fila?.buyOrder ?? buyOrder) }}</dd>
            <dt class="font-medium">Token</dt>
            <dd class="break-all font-mono text-xs">{{ valor(token) }}</dd>
            <dt class="font-medium">Tipo de pago</dt>
            <dd>{{ valor(fila?.paymentTypeCode) }}</dd>
            <dt class="font-medium">Cuotas</dt>
            <dd>{{ valor(fila?.installmentsNumber) }}</dd>
            <dt class="font-medium">Código de autorización</dt>
            <dd>{{ valor(fila?.authorizationCode) }}</dd>
          </dl>

          <div class="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              class="cursor-pointer"
              :disabled="!token"
              @click="copiarToken"
            >
              {{ copiado ? 'Token copiado' : 'Copiar token' }}
            </Button>
            <Button as-child class="cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90">
              <router-link :to="{ name: 'webpay-qa' }">Nueva prueba</router-link>
            </Button>
          </div>
        </template>
      </CardContent>
    </Card>
  </main>
</template>
