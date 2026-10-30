<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PREGUNTA_NPS, type NpsRematriculaEstado } from '@/composables/useNpsRematricula'
import type { CalificacionNps } from '@/utils/npsRematricula'

const props = defineProps<{ nps: NpsRematriculaEstado }>()
const emit = defineEmits<{ enviado: []; omitir: [] }>()

const CALIFICACIONES: readonly CalificacionNps[] = [1, 2, 3, 4, 5, 6, 7]
const nps = props.nps
const { calificacion, comentario, enviando, errorGuardado, muestraComentario } = nps

async function onEnviar(): Promise<void> {
  const ok = await nps.enviar()
  if (ok) emit('enviado')
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm leading-relaxed text-zinc-800">{{ PREGUNTA_NPS }}</p>

    <div class="flex flex-wrap justify-center gap-1.5 sm:gap-2" role="group" :aria-label="PREGUNTA_NPS">
      <button
        v-for="n in CALIFICACIONES"
        :key="n"
        type="button"
        class="flex h-10 w-10 shrink-0 cursor-pointer sm:h-11 sm:w-11 items-center justify-center rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        :class="
          calificacion === n
            ? 'border-uniacc-orange bg-uniacc-orange/10 text-zinc-900 ring-1 ring-uniacc-orange/40'
            : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50'
        "
        :aria-pressed="calificacion === n"
        :disabled="enviando"
        @click="nps.seleccionar(n)"
      >
        {{ n }}
      </button>
    </div>

    <p class="text-center text-xs text-muted-foreground">1 = Muy difícil · 7 = Muy fácil</p>

    <div v-if="muestraComentario" class="space-y-2">
      <label for="nps-comentario" class="text-sm font-medium text-zinc-900">
        ¿Qué salió mal? <span class="font-normal text-muted-foreground">(opcional)</span>
      </label>
      <Textarea
        id="nps-comentario"
        v-model="comentario"
        :maxlength="500"
        :disabled="enviando"
        rows="3"
        class="resize-y"
        placeholder="Cuéntanos brevemente qué dificultó el proceso"
      />
      <p class="text-right text-xs text-muted-foreground">{{ comentario.length }}/500</p>
    </div>

    <p v-if="errorGuardado" class="text-sm text-destructive" role="alert">
      No se pudo guardar tu evaluación. Intenta de nuevo.
    </p>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="secondary"
        class="cursor-pointer"
        :disabled="enviando"
        @click="emit('omitir')"
      >
        Ahora no
      </Button>
      <Button
        type="button"
        class="cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
        :disabled="calificacion == null || enviando"
        @click="onEnviar"
      >
        <Loader2 v-if="enviando" class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        Enviar evaluación
      </Button>
    </div>
  </div>
</template>
