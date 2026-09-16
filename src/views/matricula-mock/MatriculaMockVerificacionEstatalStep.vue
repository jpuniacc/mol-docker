<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Info } from 'lucide-vue-next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VERIFICACION_ESTATAL_UI } from '@/constants/verificacionEstatal'

const props = defineProps<{
  periodoLabel?: string | null
  nombreAlumno?: string
  codcli?: string
  beneficios: string[]
}>()

const emit = defineEmits<{
  volver: []
}>()

const ui = VERIFICACION_ESTATAL_UI
const periodoDisplay = computed(() => props.periodoLabel?.trim() || '—')
const alumnoDisplay = computed(() => props.nombreAlumno?.trim() || '—')
const codcliDisplay = computed(() => props.codcli?.trim() || '—')
</script>

<template>
  <Card class="shadow-md">
    <CardHeader>
      <div class="flex flex-wrap items-center gap-2">
        <CardTitle>{{ ui.cardTitulo }}</CardTitle>
        <Badge variant="outline">{{ ui.badgeEnEspera }}</Badge>
      </div>
      <CardDescription>{{ ui.cardDescripcion }}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <Alert
        variant="default"
        class="border-uniacc-orange/40 bg-uniacc-orange/10 text-zinc-900 shadow-sm ring-1 ring-uniacc-orange/15 [&>svg]:text-uniacc-orange"
      >
        <Clock class="h-5 w-5 shrink-0" aria-hidden="true" />
        <AlertTitle class="text-base font-semibold">{{ ui.pendienteTitulo }}</AlertTitle>
        <AlertDescription class="mt-2 space-y-2 text-sm leading-relaxed text-zinc-800">
          <p>{{ ui.pendienteMensaje }}</p>
          <p class="font-medium text-zinc-900">{{ ui.pendienteAclaracion }}</p>
        </AlertDescription>
      </Alert>

      <section class="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
        <div class="flex items-center gap-2 text-sm font-medium">
          <Info class="h-4 w-4 shrink-0 text-uniacc-orange" />
          <span>Datos de la beca estatal</span>
        </div>
        <dl class="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-muted-foreground">{{ ui.contextoPeriodo }}</dt>
            <dd class="font-medium">{{ periodoDisplay }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground">{{ ui.contextoCodcli }}</dt>
            <dd class="font-medium">{{ codcliDisplay }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-muted-foreground">{{ ui.contextoAlumno }}</dt>
            <dd class="font-medium">{{ alumnoDisplay }}</dd>
          </div>
          <div v-if="beneficios.length > 0" class="sm:col-span-2">
            <dt class="text-muted-foreground">Beneficios</dt>
            <dd class="font-medium">{{ beneficios.join(' · ') }}</dd>
          </div>
        </dl>
      </section>

      <section class="space-y-2">
        <h3 class="text-sm font-semibold">{{ ui.pasosTitulo }}</h3>
        <ul class="list-none space-y-2 border-l-2 border-uniacc-orange/40 pl-4 text-sm text-muted-foreground">
          <li v-for="(paso, i) in ui.pasos" :key="i">{{ paso }}</li>
        </ul>
      </section>

      <div class="border-t border-zinc-200 pt-4">
        <Button type="button" variant="outline" @click="emit('volver')">
          {{ ui.volver }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
