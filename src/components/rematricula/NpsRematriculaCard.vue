<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { obtenerSesionLogId } from '@/services/molAuditContext'
import { estadoNpsRematricula, guardarNpsRematricula } from '@/services/npsRematriculaApi'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { esCalificacionNps, type CalificacionNps } from '@/utils/npsRematricula'

const PREGUNTA = '¿Qué tan fácil fue completar tu proceso de rematrícula?'
const MSG_PREPARACION = 'No pudimos preparar la evaluación. Reintenta más tarde.'
const CALIFICACIONES: readonly CalificacionNps[] = [1, 2, 3, 4, 5]

const alumnoMnp = useDatosAlumnoMnpStore()
const periodoActivo = usePeriodoActivoStore()

const omitidoLocal = ref(false)
const cargandoEstado = ref(true)
const respondio = ref(false)
const calificacion = ref<CalificacionNps | null>(null)
const comentario = ref('')
const enviando = ref(false)
const errorPreparacion = ref<string | null>(null)
const errorGuardado = ref<string | null>(null)

const muestraComentario = computed(() => {
  const c = calificacion.value
  return c != null && c <= 3
})

function pickStr(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : null
}

function identidadObligatoria(): {
  rutAlumno: string
  codcli: string
  codigoCarrera: string
  jornada: string
  anioPeriodo: number
  semestrePeriodo: number
} | null {
  const fila = alumnoMnp.primeraFila
  const rutAlumno = pickStr(fila?.rut_alumno)
  const codcli = pickStr(fila?.codcli)
  const codigoCarrera = pickStr(fila?.codigo_carrera)
  const jornada = pickStr(fila?.jornada_carrera)
  const anioPeriodo = periodoActivo.anio
  const semestrePeriodo = periodoActivo.semestre
  if (
    !rutAlumno ||
    !codcli ||
    !codigoCarrera ||
    !jornada ||
    anioPeriodo == null ||
    semestrePeriodo == null
  ) {
    return null
  }
  return { rutAlumno, codcli, codigoCarrera, jornada, anioPeriodo, semestrePeriodo }
}

async function cargarEstado(): Promise<void> {
  cargandoEstado.value = true
  errorPreparacion.value = null
  try {
    await periodoActivo.ensureLoaded()
    const codcli = pickStr(alumnoMnp.primeraFila?.codcli)
    const anio = periodoActivo.anio
    const semestre = periodoActivo.semestre
    if (!codcli || anio == null || semestre == null) {
      errorPreparacion.value = MSG_PREPARACION
      return
    }
    const res = await estadoNpsRematricula(codcli, anio, semestre)
    if ('error' in res) {
      errorPreparacion.value = MSG_PREPARACION
      return
    }
    respondio.value = res.respondio
    if (!res.respondio && !identidadObligatoria()) {
      errorPreparacion.value = MSG_PREPARACION
    }
  } finally {
    cargandoEstado.value = false
  }
}

onMounted(() => {
  void cargarEstado()
})

function omitirLocal(): void {
  omitidoLocal.value = true
}

function seleccionar(n: CalificacionNps): void {
  if (enviando.value) return
  calificacion.value = n
  errorGuardado.value = null
  if (n >= 4) comentario.value = ''
}

async function enviar(): Promise<void> {
  if (enviando.value || calificacion.value == null) return
  if (!esCalificacionNps(calificacion.value)) return

  const id = identidadObligatoria()
  if (!id) {
    errorPreparacion.value = MSG_PREPARACION
    return
  }

  enviando.value = true
  errorGuardado.value = null
  try {
    const err = await guardarNpsRematricula({
      ...id,
      calificacion: calificacion.value,
      comentario: muestraComentario.value ? comentario.value : null,
      periodoLabel: periodoActivo.label,
      sesionId: obtenerSesionLogId(),
    })
    if (err) {
      errorGuardado.value = err
      toast.error('No se pudo guardar tu evaluación. Intenta de nuevo.')
      return
    }
    respondio.value = true
    toast.success('Evaluación registrada.')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <Card
    v-if="!omitidoLocal"
    class="mx-auto max-w-lg border-zinc-200 shadow-sm"
    aria-labelledby="nps-rematricula-titulo"
  >
    <CardHeader class="pb-3">
      <CardTitle id="nps-rematricula-titulo" class="text-base font-semibold text-zinc-900">
        Evalúa tu experiencia
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div
        v-if="cargandoEstado"
        class="flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
        Cargando evaluación…
      </div>

      <p v-else-if="errorPreparacion" class="text-sm text-muted-foreground">
        {{ errorPreparacion }}
      </p>

      <p v-else-if="respondio" class="text-sm font-medium text-zinc-900">
        Gracias, ya registramos tu evaluación.
      </p>

      <template v-else>
        <p class="text-sm leading-relaxed text-zinc-800">{{ PREGUNTA }}</p>

        <div
          class="flex flex-wrap justify-center gap-2"
          role="group"
          :aria-label="PREGUNTA"
        >
          <button
            v-for="n in CALIFICACIONES"
            :key="n"
            type="button"
            class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            :class="
              calificacion === n
                ? 'border-uniacc-orange bg-uniacc-orange/10 text-zinc-900 ring-1 ring-uniacc-orange/40'
                : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50'
            "
            :aria-pressed="calificacion === n"
            :disabled="enviando"
            @click="seleccionar(n)"
          >
            {{ n }}
          </button>
        </div>

        <p class="text-center text-xs text-muted-foreground">1 = muy difícil · 5 = muy fácil</p>

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
            @click="omitirLocal"
          >
            Ahora no
          </Button>
          <Button
            type="button"
            class="cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="calificacion == null || enviando"
            @click="enviar"
          >
            <Loader2 v-if="enviando" class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Enviar evaluación
          </Button>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
