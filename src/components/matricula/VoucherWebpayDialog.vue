<script setup lang="ts">
import { computed } from 'vue'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from 'radix-vue'
import { CircleAlert, CircleCheck, CircleX, Loader2 } from 'lucide-vue-next'

import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { COMERCIO_VOUCHER, PIE_VOUCHER, type VoucherWebpay } from '@/utils/voucherWebpay'

const props = defineProps<{
  voucher: VoucherWebpay
  mostrarVolver: boolean
  ocupado: boolean
}>()

const emit = defineEmits<{
  continuar: []
  volver: []
  descargar: []
}>()

const estadoUi = computed(() => {
  if (props.voucher.estado === 'rechazada') {
    return { icono: CircleX, texto: 'text-red-700', fondo: 'bg-red-50' }
  }
  if (props.voucher.estado === 'abortada') {
    return { icono: CircleAlert, texto: 'text-amber-800', fondo: 'bg-amber-50' }
  }
  return { icono: CircleCheck, texto: 'text-emerald-700', fondo: 'bg-emerald-50' }
})

function frenar(evento: { preventDefault: () => void }): void {
  evento.preventDefault()
}
</script>

<template>
  <Dialog :open="true">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/80" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden border bg-background p-4 shadow-lg sm:p-6"
        @pointer-down-outside="frenar"
        @interact-outside="frenar"
        @escape-key-down="frenar"
      >
        <DialogTitle as-child>
          <h2
            class="flex shrink-0 items-center gap-2 text-xl font-semibold"
            :class="estadoUi.texto"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              :class="estadoUi.fondo"
            >
              <component :is="estadoUi.icono" class="h-5 w-5" aria-hidden="true" />
            </span>
            {{ voucher.titulo }}
          </h2>
        </DialogTitle>
        <DialogDescription class="sr-only">Comprobante de la transacción</DialogDescription>
        <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div
            class="mx-auto w-full max-w-sm border border-zinc-300 bg-white px-4 py-4 font-mono text-[13px] leading-snug text-zinc-900"
          >
            <p class="text-center text-sm font-semibold tracking-wide">COMPROBANTE DE VENTA</p>
            <p v-if="voucher.tipoTarjeta" class="mt-1 text-center">{{ voucher.tipoTarjeta }}</p>
            <p class="mt-2 text-center">{{ COMERCIO_VOUCHER.nombre }}</p>
            <p class="text-center">{{ COMERCIO_VOUCHER.direccion }}</p>
            <p class="text-center">RUT {{ COMERCIO_VOUCHER.rut }}</p>
            <p class="text-center">{{ COMERCIO_VOUCHER.codigo }}</p>
            <div class="my-3 border-t border-dashed border-zinc-400" />
            <div
              v-for="linea in voucher.lineas"
              :key="linea.etiqueta"
              class="flex items-baseline justify-between gap-3 py-0.5"
            >
              <span>{{ linea.etiqueta }}</span>
              <span class="break-all text-right">{{ linea.valor }}</span>
            </div>
            <div class="my-3 border-t border-dashed border-zinc-400" />
            <p v-for="pie in PIE_VOUCHER" :key="pie" class="text-center text-xs">{{ pie }}</p>
          </div>
        </div>
        <div class="flex shrink-0 flex-col gap-2 md:flex-row md:justify-end">
          <Button
            v-if="voucher.descargable"
            type="button"
            variant="outline"
            class="w-full cursor-pointer md:w-auto"
            :disabled="ocupado"
            @click="emit('descargar')"
          >
            Descargar voucher
          </Button>
          <Button
            v-if="!voucher.descargable || mostrarVolver"
            type="button"
            :variant="voucher.descargable && mostrarVolver ? 'outline' : 'default'"
            :class="
              voucher.descargable && mostrarVolver
                ? 'w-full cursor-pointer md:w-auto'
                : 'w-full cursor-pointer rounded-full bg-uniacc-orange hover:bg-uniacc-orange/90 md:w-auto'
            "
            :disabled="ocupado"
            @click="emit('volver')"
          >
            Volver a forma de pago
          </Button>
          <Button
            v-if="voucher.descargable"
            type="button"
            class="w-full cursor-pointer rounded-full bg-uniacc-orange hover:bg-uniacc-orange/90 md:w-auto md:order-last"
            :disabled="ocupado"
            @click="emit('continuar')"
          >
            <Loader2 v-if="ocupado" class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Continuar
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
