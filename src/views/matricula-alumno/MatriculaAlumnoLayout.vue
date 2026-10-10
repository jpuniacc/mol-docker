<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { Button } from '@/components/ui/button'
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper'
import { MessageCircle } from 'lucide-vue-next'
import {
  PASOS_ALUMNO_REMATRICULA,
  pasoBloqueadoTrasEnvio,
  pasoMaximoAlumno,
} from '@/utils/pasoAlumnoRematricula'

const STEP_NAMES = PASOS_ALUMNO_REMATRICULA

const route = useRoute()
const router = useRouter()
const alumnoCtx = useMatriculaAlumnoContextStore()
const fuente = useAlumnoRematriculaFuente()
const periodoActivo = usePeriodoActivoStore()

function routeNameToStep(name: string | symbol | null | undefined): number {
  const idx = STEP_NAMES.indexOf(name as (typeof STEP_NAMES)[number])
  return idx >= 0 ? idx + 1 : 1
}

const pasoMaximo = computed(() => pasoMaximoAlumno(alumnoCtx))

function pasoBloqueado(step: number): boolean {
  return pasoBloqueadoTrasEnvio({
    envioFirmaIniciado: alumnoCtx.envioFirmaIniciado,
    firmaCompletada: alumnoCtx.firmaCompletada,
    step,
    pasoMaximo: pasoMaximo.value,
  })
}

const stepModel = computed({
  get: () => routeNameToStep(route.name),
  set: (v: number | undefined) => {
    if (v === undefined || pasoBloqueado(v)) return
    const n = STEP_NAMES[v - 1]
    if (n) void router.push({ name: n })
  },
})

const headerRut = computed(() => fuente.rutMostrado.value)
const headerCarrera = computed(() => fuente.carreraMostrada.value)
const headerNombre = computed(() => fuente.nombreMostrado.value)
const tituloRematricula = computed(() => periodoActivo.tituloRematricula)
const periodoLabel = computed(() => periodoActivo.anio)
const yScroll = ref(0)
const isCompactHeader = computed(() => yScroll.value > 24)

function actualizarScrollHeader() {
  yScroll.value = window.scrollY || window.pageYOffset || 0
}

onMounted(() => {
  actualizarScrollHeader()
  window.addEventListener('scroll', actualizarScrollHeader, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', actualizarScrollHeader)
})

function salirAlDashboard() {
  void router.push({ name: 'dashboard-home' })
}
</script>

<template>
  <div class="relative min-h-svh bg-zinc-100 pb-24">
    <div class="sticky top-0 z-30 border-b border-zinc-200/80 bg-zinc-100/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-100/80">
      <!-- Cabecera -->
      <header class="border-b border-zinc-200 bg-white shadow-sm transition-all duration-200">
        <div
          :class="[
            'mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 transition-all duration-200 md:flex-row md:items-center md:justify-between md:px-6',
            isCompactHeader ? 'md:py-2' : 'md:py-4',
          ]"
        >
          <div class="flex items-center gap-4">
            <RouterLink :to="{ name: 'dashboard-home' }">
              <img
                src="/Logo/logoUniaccNew.svg"
                alt="Universidad UNIACC"
                :class="[
                  'h-9 w-auto transition-all duration-200',
                  isCompactHeader ? 'md:h-7' : 'md:h-10',
                ]"
              />
            </RouterLink>
          </div>
          <div class="hidden text-right transition-all duration-200 md:block">
            <p
              :class="[
                'font-bold tracking-tight text-zinc-900 transition-all duration-200',
                isCompactHeader ? 'text-base' : 'text-lg',
              ]"
            >
              {{ tituloRematricula }}
            </p>
            <div
              :class="[
                'ml-auto rounded-full bg-uniacc-orange transition-all duration-200',
                isCompactHeader ? 'mt-0.5 h-0.5 w-20' : 'mt-1 h-1 w-24',
              ]"
            />
          </div>
          <div class="flex flex-wrap items-center gap-2 md:justify-end">
            <Button
              type="button"
              size="sm"
              class="cursor-pointer bg-uniacc-orange text-white transition-colors duration-200 hover:bg-uniacc-orange/90"
              @click="salirAlDashboard"
            >
              Salir
            </Button>
          </div>
        </div>

        <div class="bg-[#1E3A5F] text-white">
          <div
            class="h-1 bg-gradient-to-r from-uniacc-orange via-uniacc-magenta to-uniacc-blue"
            aria-hidden="true"
          />
          <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-sm md:flex-nowrap md:px-6">
            <p class="min-w-0 truncate font-semibold" :title="headerNombre">{{ headerNombre }}</p>
            <p class="flex min-w-0 items-center gap-x-2 text-xs text-white/90">
              <span class="shrink-0">RUT {{ headerRut }}</span>
              <span aria-hidden="true">·</span>
              <span class="truncate">{{ headerCarrera }}</span>
            </p>
            <p class="hidden text-xs text-white/80 lg:block">Periodo {{ periodoLabel }}</p>
            <a
              href="tel:+56226406000"
              class="ml-auto shrink-0 cursor-pointer rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium ring-1 ring-white/30 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Ayuda (+56 2) 26406000
            </a>
          </div>
        </div>
      </header>

      <div class="mx-auto max-w-6xl overflow-x-auto border-b border-zinc-200 bg-zinc-100 px-4 py-2 md:px-6">
        <Stepper
          v-model="stepModel"
          :linear="false"
          class="flex w-full min-w-[28rem] items-start gap-0 md:min-w-0"
        >
        <StepperItem
          :step="1"
          :disabled="pasoBloqueado(1)"
          class="flex min-w-0 flex-1 flex-row items-start data-[disabled]:opacity-40"
        >
          <StepperTrigger class="flex min-w-0 flex-1 flex-col items-center gap-0.5 p-1">
            <StepperIndicator class="h-6 w-6 text-[11px]">1</StepperIndicator>
            <StepperTitle class="text-[11px] font-medium leading-tight">Datos personales</StepperTitle>
          </StepperTrigger>
          <StepperSeparator class="mx-1 mt-3 h-px min-w-[0.75rem] flex-1 self-start bg-border" />
        </StepperItem>
        <StepperItem
          :step="2"
          :disabled="pasoBloqueado(2)"
          class="flex min-w-0 flex-1 flex-row items-start data-[disabled]:opacity-40"
        >
          <StepperTrigger class="flex min-w-0 flex-1 flex-col items-center gap-0.5 p-1">
            <StepperIndicator class="h-6 w-6 text-[11px]">2</StepperIndicator>
            <StepperTitle class="text-[11px] font-medium leading-tight">Forma de pago</StepperTitle>
          </StepperTrigger>
          <StepperSeparator class="mx-1 mt-3 h-px min-w-[0.75rem] flex-1 self-start bg-border" />
        </StepperItem>
        <StepperItem
          :step="3"
          :disabled="pasoBloqueado(3)"
          class="flex min-w-0 flex-1 flex-row items-start data-[disabled]:opacity-40"
        >
          <StepperTrigger class="flex min-w-0 flex-1 flex-col items-center gap-0.5 p-1">
            <StepperIndicator class="h-6 w-6 text-[11px]">3</StepperIndicator>
            <StepperTitle class="text-[11px] font-medium leading-tight">Firma de contrato</StepperTitle>
          </StepperTrigger>
          <StepperSeparator class="mx-1 mt-3 h-px min-w-[0.75rem] flex-1 self-start bg-border" />
        </StepperItem>
        <StepperItem
          :step="4"
          :disabled="pasoBloqueado(4)"
          class="flex min-w-0 flex-1 flex-col items-center data-[disabled]:opacity-40"
        >
          <StepperTrigger class="flex flex-col items-center gap-0.5 p-1">
            <StepperIndicator class="h-6 w-6 text-[11px]">4</StepperIndicator>
            <StepperTitle class="text-[11px] font-medium leading-tight">Resumen final</StepperTitle>
          </StepperTrigger>
        </StepperItem>
        </Stepper>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 pb-8 md:px-6">
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <a
      href="#"
      class="fixed bottom-6 right-6 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-200 hover:scale-110 hover:bg-[#1ebe5d] motion-reduce:transition-none motion-reduce:hover:scale-100"
      aria-label="WhatsApp"
      @click.prevent
    >
      <MessageCircle class="h-7 w-7" />
    </a>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
