<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { Button } from '@/components/ui/button'
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper'
import { MessageCircle } from 'lucide-vue-next'

const STEP_NAMES = [
  'matricula-alumno-datos',
  'matricula-alumno-forma-pago',
  'matricula-alumno-firma',
  'matricula-alumno-resumen',
] as const

const route = useRoute()
const router = useRouter()
const alumnoCtx = useMatriculaAlumnoContextStore()
const fuente = useAlumnoRematriculaFuente()
const periodoActivo = usePeriodoActivoStore()

function routeNameToStep(name: string | symbol | null | undefined): number {
  const idx = STEP_NAMES.indexOf(name as (typeof STEP_NAMES)[number])
  return idx >= 0 ? idx + 1 : 1
}

const matriculaCerrada = computed(() => alumnoCtx.firmaCompletada)

const stepModel = computed({
  get: () => routeNameToStep(route.name),
  set: (v: number | undefined) => {
    if (v === undefined || matriculaCerrada.value) return
    const n = STEP_NAMES[v - 1]
    if (n) void router.push({ name: n })
  },
})

const headerRut = computed(() => fuente.rutMostrado.value)
const headerCarrera = computed(() => fuente.carreraMostrada.value)
const headerCampus = computed(() => fuente.campusMostrado.value)
const headerNombre = computed(() => fuente.nombreMostrado.value)
const tituloRematricula = computed(() => periodoActivo.tituloRematricula)
const periodoLabel = computed(() => periodoActivo.label ?? '—')
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

function reiniciarFlujo() {
  alumnoCtx.resetFlujo()
  void router.push({ name: 'matricula-alumno-datos' })
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
              v-if="!matriculaCerrada"
              type="button"
              variant="outline"
              size="sm"
              class="cursor-pointer border-uniacc-blue bg-uniacc-blue/10 text-uniacc-blue transition-colors duration-200 hover:bg-uniacc-blue/20"
              @click="reiniciarFlujo"
            >
              Reiniciar
            </Button>
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

        <!-- Banda estudiante -->
        <div
          style="background: linear-gradient(90deg, #ff5b00 0%, #ee2183 50%, #4d98c5 100%)"
          :class="[
            'px-4 py-3 text-white transition-all duration-200 md:px-6',
            isCompactHeader ? 'md:py-2' : 'md:py-3',
          ]"
        >
          <div
            :class="[
              'mx-auto flex max-w-6xl flex-col gap-2 text-sm transition-all duration-200 md:flex-row md:flex-wrap md:items-center md:justify-between',
              isCompactHeader ? 'md:gap-3' : 'md:gap-4',
            ]"
          >
            <p class="font-medium">Rematrícula en línea — Periodo {{ periodoLabel }}</p>
            <p class="flex flex-wrap gap-x-4 gap-y-1">
              <span class="font-semibold">{{ headerNombre }}</span>
              <span>RUT {{ headerRut }}</span>
              <span>{{ headerCarrera }}</span>
              <span>{{ headerCampus }}</span>
            </p>
            <p class="text-white/80 md:text-right">
              ¿Necesitas ayuda?
              <span class="font-semibold text-white"> (+56 2) 26406000</span>
            </p>
          </div>
        </div>
      </header>

      <div
        :class="[
          'mx-auto max-w-6xl overflow-x-auto border-b border-zinc-200 bg-zinc-100 px-4 py-4 transition-all duration-200 md:px-6',
          isCompactHeader ? 'md:py-3' : 'md:py-6',
        ]"
      >
        <Stepper
          v-model="stepModel"
          :linear="false"
          class="flex w-full min-w-[520px] items-start gap-0 md:min-w-0"
        >
        <StepperItem
          :step="1"
          :disabled="matriculaCerrada"
          class="flex min-w-0 flex-1 flex-row items-start"
        >
          <StepperTrigger class="flex min-w-0 flex-1 flex-col items-center gap-1">
            <StepperIndicator class="h-9 w-9 text-sm">1</StepperIndicator>
            <div class="text-center">
              <StepperTitle class="text-xs font-semibold md:text-sm">Datos personales</StepperTitle>
              <StepperDescription class="hidden sm:block">Revisión</StepperDescription>
            </div>
          </StepperTrigger>
          <StepperSeparator class="mx-1 mt-4 h-0.5 min-w-[1rem] flex-1 self-start bg-border md:mx-2" />
        </StepperItem>
        <StepperItem
          :step="2"
          :disabled="matriculaCerrada"
          class="flex min-w-0 flex-1 flex-row items-start"
        >
          <StepperTrigger class="flex min-w-0 flex-1 flex-col items-center gap-1">
            <StepperIndicator class="h-9 w-9 text-sm">2</StepperIndicator>
            <div class="text-center">
              <StepperTitle class="text-xs font-semibold md:text-sm">Forma de pago</StepperTitle>
              <StepperDescription class="hidden sm:block">Pago</StepperDescription>
            </div>
          </StepperTrigger>
          <StepperSeparator class="mx-1 mt-4 h-0.5 min-w-[1rem] flex-1 self-start bg-border md:mx-2" />
        </StepperItem>
        <StepperItem
          :step="3"
          :disabled="matriculaCerrada"
          class="flex min-w-0 flex-1 flex-row items-start"
        >
          <StepperTrigger class="flex min-w-0 flex-1 flex-col items-center gap-1">
            <StepperIndicator class="h-9 w-9 text-sm">3</StepperIndicator>
            <div class="text-center">
              <StepperTitle class="text-xs font-semibold md:text-sm">Firma de contrato</StepperTitle>
              <StepperDescription class="hidden sm:block">Revisión y FES</StepperDescription>
            </div>
          </StepperTrigger>
          <StepperSeparator class="mx-1 mt-4 h-0.5 min-w-[1rem] flex-1 self-start bg-border md:mx-2" />
        </StepperItem>
        <StepperItem :step="4" class="flex min-w-0 flex-1 flex-col items-center">
          <StepperTrigger class="flex flex-col items-center gap-1">
            <StepperIndicator class="h-9 w-9 text-sm">4</StepperIndicator>
            <div class="text-center">
              <StepperTitle class="text-xs font-semibold md:text-sm">Resumen final</StepperTitle>
              <StepperDescription class="hidden sm:block">Confirmación</StepperDescription>
            </div>
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
