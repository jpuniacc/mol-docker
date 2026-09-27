<script setup lang="ts">
import { computed } from 'vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  MSG_FUERA_CARTERA_OFICIAL,
  TITULO_FUERA_CARTERA_OFICIAL,
} from '@/constants/carteraOficial'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import {
  CheckCircle2,
  Circle,
  GraduationCap,
  Phone,
  Sparkles,
} from 'lucide-vue-next'

const appStore = useAppStore()
const auth = useAuthStore()
const datosMnp = useDatosAlumnoMnpStore()
const alumnoCtx = useMatriculaAlumnoContextStore()
const periodoActivo = usePeriodoActivoStore()
const fuente = useAlumnoRematriculaFuente()

const saludo = computed(() => auth.displayNombreCompleto || auth.username || 'Usuario')
const bloqueoFueraCartera = computed(() => datosMnp.fueraCarteraOficial)
const esAlumnoPixarron = computed(
  () =>
    auth.authSource === 'pixarron' &&
    datosMnp.cantidadRegistros > 0 &&
    !datosMnp.fueraCarteraOficial,
)

const mnp = computed(() => datosMnp.primeraFila)

type PasoHome = { id: string; label: string; done: boolean }

const pasosRematricula = computed((): PasoHome[] => [
  { id: 'tyc', label: 'Datos personales y TyC', done: alumnoCtx.tycAccepted },
  {
    id: 'pago',
    label: 'Forma de pago',
    done: alumnoCtx.formaPagoSeleccionada != null || alumnoCtx.pagoMatricula != null,
  },
  { id: 'firma', label: 'Firma de contrato', done: alumnoCtx.firmaCompletada },
  { id: 'resumen', label: 'Resumen final', done: alumnoCtx.firmaCompletada },
])

const pasosCompletados = computed(() => pasosRematricula.value.filter((p) => p.done).length)

const ctaLabel = computed(() => {
  if (alumnoCtx.firmaCompletada) return 'Ver resumen'
  if (alumnoCtx.formaPagoSeleccionada || alumnoCtx.pagoMatricula) return 'Continuar a firma'
  if (alumnoCtx.tycAccepted) return 'Continuar rematrícula'
  return 'Iniciar rematrícula'
})

const ctaRouteName = computed(() => {
  if (alumnoCtx.firmaCompletada) return 'matricula-alumno-resumen'
  if (alumnoCtx.formaPagoSeleccionada || alumnoCtx.pagoMatricula) return 'matricula-alumno-firma'
  if (alumnoCtx.tycAccepted) return 'matricula-alumno-forma-pago'
  return 'matricula-alumno-datos'
})

function pick(...vals: (string | null | undefined)[]): string {
  for (const v of vals) {
    const t = (v ?? '').trim()
    if (t.length > 0) return t
  }
  return '—'
}
</script>

<template>
  <div class="space-y-8">
    <!-- Staff / genérico -->
    <template v-if="!esAlumnoPixarron">
      <div class="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200/80">
        <div
          class="px-4 py-3 text-center text-sm font-semibold leading-snug text-white md:text-[15px]"
          style="background: linear-gradient(90deg, #ff5b00 0%, #ee2183 50%, #4d98c5 100%)"
        >
          Bienvenido al {{ appStore.appName }}
        </div>
        <div class="space-y-2 px-4 py-6 md:px-8 md:py-8">
          <h1 class="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">Inicio</h1>
          <p class="mt-1 text-sm text-zinc-600 md:text-base">
            Hola, <span class="font-semibold text-zinc-900">{{ saludo }}</span>. Desde aquí puedes
            acceder al flujo de rematrícula y a las herramientas del portal.
          </p>
        </div>
      </div>

      <Alert v-if="bloqueoFueraCartera" class="border-red-300 bg-red-50 text-red-950">
        <AlertTitle>{{ TITULO_FUERA_CARTERA_OFICIAL }}</AlertTitle>
        <AlertDescription>{{ MSG_FUERA_CARTERA_OFICIAL }}</AlertDescription>
      </Alert>

      <div
        v-else
        class="rounded-2xl border border-uniacc-orange/30 bg-white p-6 shadow-md ring-1 ring-uniacc-orange/10"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex gap-3">
            <GraduationCap class="h-8 w-8 shrink-0 text-uniacc-orange" aria-hidden="true" />
            <div>
              <h2 class="text-lg font-semibold text-zinc-900">Simular rematrícula</h2>
              <p class="mt-1 text-sm text-zinc-600">
                Elige un alumno del periodo activo para probar el flujo completo.
              </p>
            </div>
          </div>
          <RouterLink :to="{ name: 'matricula-mock-seleccion-alumno' }" class="shrink-0">
            <Button
              type="button"
              class="cursor-pointer rounded-full bg-uniacc-orange px-6 font-semibold text-white shadow-md transition-colors duration-200 hover:bg-uniacc-orange/90"
            >
              Iniciar simulación
            </Button>
          </RouterLink>
        </div>
      </div>
    </template>

    <!-- Dashboard alumno -->
    <template v-else>
      <section
        class="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200/80"
        aria-labelledby="alumno-home-title"
      >
        <div
          class="px-4 py-3 text-center text-sm font-semibold leading-snug text-white md:text-[15px]"
          style="background: linear-gradient(90deg, #ff5b00 0%, #ee2183 50%, #4d98c5 100%)"
        >
          {{ periodoActivo.tituloRematricula }}
        </div>
        <div class="space-y-4 px-4 py-6 md:px-8 md:py-8">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-sm font-medium text-uniacc-orange">Portal estudiante</p>
              <h1
                id="alumno-home-title"
                class="mt-1 text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl"
              >
                Hola, {{ saludo }}
              </h1>
              <p class="mt-2 max-w-xl text-sm text-zinc-600 md:text-base">
                Aquí ves tu información académica y el avance de tu rematrícula.
              </p>
            </div>
            <div class="flex items-center gap-2 text-uniacc-orange">
              <Sparkles class="h-5 w-5 shrink-0" aria-hidden="true" />
              <span class="text-sm font-medium">Periodo {{ periodoActivo.label ?? '—' }}</span>
            </div>
          </div>
        </div>
      </section>

      <Alert v-if="bloqueoFueraCartera" class="border-red-300 bg-red-50 text-red-950">
        <AlertTitle>{{ TITULO_FUERA_CARTERA_OFICIAL }}</AlertTitle>
        <AlertDescription>{{ MSG_FUERA_CARTERA_OFICIAL }}</AlertDescription>
      </Alert>

      <div v-else class="grid gap-6 lg:grid-cols-5">
        <!-- Identidad -->
        <section
          class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2"
          aria-labelledby="alumno-datos-title"
        >
          <h2 id="alumno-datos-title" class="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Tus datos
          </h2>
          <dl class="mt-4 space-y-3 text-sm">
            <div>
              <dt class="text-zinc-500">RUT</dt>
              <dd class="font-semibold text-zinc-900">{{ fuente.rutMostrado }}</dd>
            </div>
            <div>
              <dt class="text-zinc-500">Carrera</dt>
              <dd class="font-semibold text-zinc-900">{{ fuente.carreraMostrada }}</dd>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <dt class="text-zinc-500">Jornada</dt>
                <dd class="font-medium text-zinc-800">{{ fuente.jornadaMostrada }}</dd>
              </div>
              <div>
                <dt class="text-zinc-500">Estado</dt>
                <dd class="font-medium text-zinc-800">
                  {{ pick(mnp?.estado_academico) }}
                </dd>
              </div>
            </div>
            <div>
              <dt class="text-zinc-500">Código alumno</dt>
              <dd class="font-medium text-zinc-800">{{ fuente.codcliMostrado }}</dd>
            </div>
            <div v-if="datosMnp.cantidadRegistros > 1">
              <dt class="text-zinc-500">Carreras asociadas</dt>
              <dd class="font-medium text-zinc-800">
                {{ datosMnp.cantidadRegistros }} registros en tu correo institucional
              </dd>
            </div>
          </dl>
        </section>

        <!-- Avance + CTA -->
        <section
          class="flex flex-col rounded-2xl border border-uniacc-orange/30 bg-white p-5 shadow-md ring-1 ring-uniacc-orange/10 lg:col-span-3"
          aria-labelledby="alumno-avance-title"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="alumno-avance-title" class="text-lg font-semibold text-zinc-900">
                Tu rematrícula
              </h2>
              <p class="mt-1 text-sm text-zinc-600">
                {{ pasosCompletados }} de {{ pasosRematricula.length }} pasos con avance guardado
              </p>
            </div>
            <RouterLink :to="{ name: ctaRouteName }">
              <Button
                type="button"
                class="cursor-pointer rounded-full bg-uniacc-orange px-6 font-semibold text-white shadow-md transition-colors duration-200 hover:bg-uniacc-orange/90"
              >
                {{ ctaLabel }}
              </Button>
            </RouterLink>
          </div>

          <ol class="mt-6 space-y-3">
            <li
              v-for="paso in pasosRematricula"
              :key="paso.id"
              class="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5"
            >
              <CheckCircle2
                v-if="paso.done"
                class="h-5 w-5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <Circle
                v-else
                class="h-5 w-5 shrink-0 text-zinc-300"
                aria-hidden="true"
              />
              <span
                :class="[
                  'text-sm font-medium',
                  paso.done ? 'text-zinc-900' : 'text-zinc-600',
                ]"
              >
                {{ paso.label }}
              </span>
              <span v-if="paso.done" class="ml-auto text-xs font-semibold text-emerald-700">
                Listo
              </span>
            </li>
          </ol>

          <p class="mt-5 flex items-center gap-2 text-sm text-zinc-500">
            <Phone class="h-4 w-4 shrink-0 text-uniacc-orange" aria-hidden="true" />
            ¿Necesitas ayuda?
            <span class="font-semibold text-zinc-800">(+56 2) 2640 6000</span>
          </p>
        </section>
      </div>
    </template>
  </div>
</template>
