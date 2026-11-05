<script setup lang="ts">
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
      <AlertDialogHeader>
        <AlertDialogTitle class="text-xl text-zinc-900">
          Te falta completar tu rematrícula
        </AlertDialogTitle>
        <AlertDialogDescription class="space-y-3 text-left text-zinc-600">
          <span class="block">{{ copyCuerpo }}</span>
          <span
            class="block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          >
            Tu pago ya fue recibido. No necesitas volver a pagar la matrícula.
          </span>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="flex-col gap-2 sm:flex-col">
        <Button
          type="button"
          class="w-full cursor-pointer rounded-full bg-[#FF5B00] hover:bg-[#FF5B00]/90"
          @click="emit('completar')"
        >
          Completar ahora
        </Button>
        <Button
          type="button"
          variant="outline"
          class="w-full cursor-pointer rounded-full"
          @click="emit('salir')"
        >
          Salir igual
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
