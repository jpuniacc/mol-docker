<script setup lang="ts">
import { Clock } from 'lucide-vue-next'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

defineProps<{
  open: boolean
  copyCuerpo: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  completar: []
  salir: []
}>()
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogContent class="max-w-md border-orange-100">
      <AlertDialogHeader class="space-y-3 text-left">
        <Clock class="h-6 w-6 text-[#FF5B00]" aria-hidden="true" />
        <AlertDialogTitle class="text-xl font-bold text-[#FF5B00] md:text-2xl">
          Tu rematrícula aún está pendiente
        </AlertDialogTitle>
        <AlertDialogDescription class="space-y-3 text-left text-zinc-600">
          <span class="block text-sm leading-relaxed md:text-base">{{ copyCuerpo }}</span>
          <span
            class="block rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm leading-relaxed text-orange-950"
          >
            <span class="font-bold text-[#FF5B00]">¡No te preocupes!</span>
            Tu pago de matrícula ya está registrado. No necesitas volver a pagarlo. Solo debes
            continuar con los pasos pendientes.
          </span>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="flex-col gap-2 sm:flex-col">
        <Button
          type="button"
          class="w-full cursor-pointer rounded-full bg-[#FF5B00] font-semibold text-white hover:bg-[#FF5B00]/90"
          @click="emit('completar')"
        >
          Continuar rematrícula
        </Button>
        <Button
          type="button"
          variant="outline"
          class="w-full cursor-pointer rounded-full border-[#FF5B00]/40 text-zinc-800 hover:bg-orange-50"
          @click="emit('salir')"
        >
          Salir por ahora
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
