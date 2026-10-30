<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'

import NpsRematriculaForm from '@/components/rematricula/NpsRematriculaForm.vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useNpsRematricula } from '@/composables/useNpsRematricula'

const props = defineProps<{
  /** Elemento que recibe el foco al cerrar (botón Descargar el contrato). */
  focoRetorno?: () => HTMLElement | null | undefined
}>()

const RETARDO_MS = 1500
const esMovil = useMediaQuery('(max-width: 768px)')
const nps = useNpsRematricula()
const abierto = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const puedeMostrar = computed(
  () => !nps.cargando.value && !nps.respondio.value && !nps.errorPreparacion.value,
)
const puedeReabrir = computed(() => puedeMostrar.value && nps.omitido.value && !abierto.value)

onMounted(async () => {
  await nps.cargarEstado()
  if (puedeMostrar.value && !nps.omitido.value) {
    timer = setTimeout(() => {
      if (puedeMostrar.value && !nps.omitido.value) abierto.value = true
    }, RETARDO_MS)
  }
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})

watch(abierto, (v, prev) => {
  // Cualquier cierre sin respuesta (X, Esc, clic fuera, "Ahora no") = omitir.
  if (prev && !v && !nps.respondio.value) nps.omitir()
})

function onOpenChange(v: boolean): void {
  abierto.value = v
}

function cerrar(): void {
  abierto.value = false
}

function onCloseAutoFocus(ev: Event): void {
  const el = props.focoRetorno?.()
  if (el) {
    ev.preventDefault()
    el.focus()
  }
}

function abrir(): void {
  if (puedeMostrar.value) abierto.value = true
}

defineExpose({ abrir, puedeReabrir })
</script>

<template>
  <Sheet v-if="esMovil" :open="abierto" @update:open="onOpenChange">
    <SheetContent
      side="bottom"
      class="max-h-[90dvh] overflow-y-auto rounded-t-2xl"
      @close-auto-focus="onCloseAutoFocus"
    >
      <SheetTitle class="pr-6 text-base font-semibold text-zinc-900">Evalúa tu experiencia</SheetTitle>
      <SheetDescription class="sr-only">Encuesta opcional de una pregunta</SheetDescription>
      <NpsRematriculaForm class="mt-3" :nps="nps" @enviado="cerrar" @omitir="cerrar" />
    </SheetContent>
  </Sheet>
  <Dialog v-else :open="abierto" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-md" @close-auto-focus="onCloseAutoFocus">
      <DialogTitle class="pr-6 text-base font-semibold text-zinc-900">Evalúa tu experiencia</DialogTitle>
      <DialogDescription class="sr-only">Encuesta opcional de una pregunta</DialogDescription>
      <NpsRematriculaForm :nps="nps" @enviado="cerrar" @omitir="cerrar" />
    </DialogContent>
  </Dialog>
</template>
