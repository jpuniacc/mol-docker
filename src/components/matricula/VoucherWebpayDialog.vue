<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal } from 'radix-vue'

import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { VoucherWebpay } from '@/utils/voucherWebpay'

defineProps<{
  voucher: VoucherWebpay
  mostrarVolver: boolean
}>()

const emit = defineEmits<{
  continuar: []
  volver: []
  descargar: []
}>()

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
        <h2 class="shrink-0 pr-2 text-xl font-semibold text-zinc-900">
          {{ voucher.titulo }}
        </h2>
        <dl class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div
            v-for="linea in voucher.lineas"
            :key="linea.etiqueta"
            class="flex flex-col gap-0.5 border-b border-zinc-200 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
          >
            <dt class="text-sm text-zinc-700">{{ linea.etiqueta }}</dt>
            <dd class="break-words text-sm font-medium text-zinc-900 sm:text-right">
              {{ linea.valor }}
            </dd>
          </div>
        </dl>
        <div class="flex shrink-0 flex-col gap-2 md:flex-row md:justify-end">
          <Button
            v-if="voucher.descargable"
            type="button"
            variant="outline"
            class="w-full cursor-pointer md:w-auto"
            @click="emit('descargar')"
          >
            Descargar voucher
          </Button>
          <Button
            v-if="voucher.descargable"
            type="button"
            class="w-full cursor-pointer rounded-full bg-uniacc-orange hover:bg-uniacc-orange/90 md:w-auto"
            @click="emit('continuar')"
          >
            Continuar
          </Button>
          <Button
            v-if="!voucher.descargable || mostrarVolver"
            type="button"
            class="w-full cursor-pointer rounded-full bg-uniacc-orange hover:bg-uniacc-orange/90 md:w-auto"
            @click="emit('volver')"
          >
            Volver a forma de pago
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
