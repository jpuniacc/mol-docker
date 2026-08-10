<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Info, Loader2 } from 'lucide-vue-next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VERIFICACION_CAE_UI } from '@/constants/verificacionCae'

const props = defineProps<{
  estado: 'verificando' | 'pendiente'
  reintentando?: boolean
  periodoLabel?: string | null
  nombreAlumno?: string
  codcli?: string
}>()

const emit = defineEmits<{
  reintentar: []
  volver: []
}>()

const ui = VERIFICACION_CAE_UI

const badgeEstado = computed(() =>
  props.estado === 'verificando' || props.reintentando ? ui.badgeVerificando : ui.badgeEnEspera,
)

const periodoDisplay = computed(() => props.periodoLabel?.trim() || '—')
const alumnoDisplay = computed(() => props.nombreAlumno?.trim() || '—')
const codcliDisplay = computed(() => props.codcli?.trim() || '—')
</script>

<template>
  <Card class="shadow-md">
    <CardHeader>
      <div class="flex flex-wrap items-center gap-2">
        <CardTitle>{{ ui.cardTitulo }}</CardTitle>
        <Badge variant="outline">{{ badgeEstado }}</Badge>
      </div>
      <CardDescription>{{ ui.cardDescripcion }}</CardDescription>
    </CardHeader>

    <CardContent class="space-y-6">
      <div
        v-if="estado === 'verificando' || reintentando"
        class="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-muted-foreground"
      >
        <Loader2 class="h-5 w-5 shrink-0 animate-spin text-uniacc-orange" aria-hidden="true" />
        <span>{{ ui.verificandoDescripcion }}</span>
      </div>

      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
      >
        <div v-if="estado === 'pendiente' && !reintentando" class="space-y-6">
          <Alert
            variant="default"
            class="border-uniacc-orange/40 bg-uniacc-orange/10 text-zinc-900 shadow-sm ring-1 ring-uniacc-orange/15 dark:border-uniacc-orange/45 dark:bg-uniacc-orange/15 dark:text-zinc-50 dark:ring-uniacc-orange/25 [&>svg]:text-uniacc-orange"
          >
            <Clock class="h-5 w-5 shrink-0" aria-hidden="true" />
            <AlertTitle class="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {{ ui.pendienteTitulo }}
            </AlertTitle>
            <AlertDescription class="mt-2 space-y-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              <p>{{ ui.pendienteMensaje }}</p>
              <p class="font-medium text-zinc-900 dark:text-zinc-50">{{ ui.pendienteAclaracion }}</p>
            </AlertDescription>
          </Alert>

          <section
            class="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4"
            aria-label="Contexto de verificación CAE"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-foreground">
              <Info class="h-4 w-4 shrink-0 text-uniacc-orange" aria-hidden="true" />
              <span>Datos de la verificación</span>
            </div>
            <dl class="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt class="text-muted-foreground">{{ ui.contextoPeriodo }}</dt>
                <dd class="font-medium text-foreground">{{ periodoDisplay }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">{{ ui.contextoCodcli }}</dt>
                <dd class="font-medium text-foreground">{{ codcliDisplay }}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-muted-foreground">{{ ui.contextoAlumno }}</dt>
                <dd class="font-medium text-foreground">{{ alumnoDisplay }}</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="sr-only">Estado CAE</dt>
                <dd>
                  <Badge variant="secondary">{{ ui.badgeCaeActivo }}</Badge>
                </dd>
              </div>
            </dl>
          </section>

          <section class="space-y-2">
            <h3 class="text-sm font-semibold text-foreground">{{ ui.pasosTitulo }}</h3>
            <ul class="list-none space-y-2 border-l-2 border-uniacc-orange/40 pl-4 text-sm leading-snug text-muted-foreground">
              <li v-for="(paso, i) in ui.pasos" :key="i">{{ paso }}</li>
            </ul>
          </section>

          <div class="space-y-2 border-t border-zinc-200 pt-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                class="w-full bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                :disabled="reintentando"
                @click="emit('reintentar')"
              >
                {{ reintentando ? ui.reintentando : ui.reintentar }}
              </Button>
              <Button
                type="button"
                variant="outline"
                class="w-full sm:w-auto"
                :disabled="reintentando"
                @click="emit('volver')"
              >
                {{ ui.volver }}
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">{{ ui.ayudaBotones }}</p>
          </div>
        </div>
      </Transition>
    </CardContent>
  </Card>
</template>
