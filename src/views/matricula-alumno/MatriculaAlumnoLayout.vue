<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Stepper,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper'
import { toast } from 'vue-sonner'
import { Menu, MessageCircle } from 'lucide-vue-next'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { claveBorradorValida } from '@/utils/borradorRematriculaSync'
import {
  PASOS_ALUMNO_REMATRICULA,
  accionAlPulsarPaso,
  NOMBRES_PASO_ALUMNO,
  pasoBloqueadoTrasEnvio,
  pasoMaximoAlumno,
  textoAvisoPasoCerrado,
} from '@/utils/pasoAlumnoRematricula'

const STEP_NAMES = PASOS_ALUMNO_REMATRICULA
const NOMBRES_CORTO_PASO = ['Datos', 'Pago', 'Firma', 'Resumen'] as const

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const alumnoCtx = useMatriculaAlumnoContextStore()
const fuente = useAlumnoRematriculaFuente()
const periodoActivo = usePeriodoActivoStore()

watch(
  () => [fuente.codcliMostrado.value, periodoActivo.anio, periodoActivo.semestre] as const,
  () => {
    const clave = claveBorradorValida(
      fuente.codcliMostrado.value,
      periodoActivo.anio,
      periodoActivo.semestre,
    )
    if (!clave) return
    void alumnoCtx.sincronizarBorradorServidor(clave)
  },
  { immediate: true },
)

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

const avisoPasoAbierto = ref(false)
const avisoPasoTexto = ref('')
const menuAbierto = ref(false)

function nombrePaso(step: number): string {
  return NOMBRES_PASO_ALUMNO[step - 1] ?? ''
}

const stepModel = computed({
  get: () => routeNameToStep(route.name),
  set: (v: number | undefined) => {
    const actual = routeNameToStep(route.name)
    const accion = accionAlPulsarPaso({
      step: v,
      pasoActual: actual,
      cerrado: v !== undefined && pasoBloqueado(v),
    })
    if (accion === 'nada' || v === undefined) return
    if (accion === 'aviso') {
      avisoPasoTexto.value = textoAvisoPasoCerrado(nombrePaso(actual), nombrePaso(v))
      avisoPasoAbierto.value = true
      return
    }
    const n = STEP_NAMES[v - 1]
    if (n) void router.push({ name: n })
  },
})

const headerRut = computed(() => fuente.rutMostrado.value)
const headerCarrera = computed(() => fuente.carreraMostrada.value)
const headerNombre = computed(() => fuente.nombreMostrado.value)
const tituloRematricula = computed(() => periodoActivo.tituloRematricula)
const periodoLabel = computed(() => periodoActivo.anio)

function salirAlDashboard() {
  void router.push({ name: 'dashboard-home' })
}

function cerrarSesion() {
  auth.logout()
  void router.replace({ name: 'login' })
  toast.success('Sesión cerrada correctamente.')
}
</script>

<template>
  <div class="relative min-h-svh bg-zinc-100 pb-28 md:pb-24">
    <div class="sticky top-0 z-30 border-b border-zinc-200/80 bg-zinc-100/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-100/80">
      <header class="border-b border-zinc-200 bg-white shadow-sm md:hidden">
        <div class="flex items-center justify-between px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            class="h-11 w-11 cursor-pointer text-zinc-800"
            aria-label="Abrir menú"
            @click="menuAbierto = true"
          >
            <Menu class="h-6 w-6" aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange"
                aria-label="Cuenta"
              >
                <img src="/Logo/logoUniaccNew.svg" alt="" class="h-7 w-7 object-contain" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem class="cursor-pointer" @click="salirAlDashboard">
                Volver al inicio
              </DropdownMenuItem>
              <DropdownMenuItem class="cursor-pointer" @click="cerrarSesion">
                Salir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <!-- Cabecera -->
      <header class="hidden border-b border-zinc-200 bg-white shadow-sm md:block">
        <div
          class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-4"
        >
          <div class="flex items-center gap-4">
            <RouterLink :to="{ name: 'dashboard-home' }">
              <img
                src="/Logo/logoUniaccNew.svg"
                alt="Universidad UNIACC"
                class="h-9 w-auto md:h-10"
              />
            </RouterLink>
          </div>
          <div class="hidden text-right md:block">
            <p class="text-lg font-bold tracking-tight text-zinc-900">
              {{ tituloRematricula }}
            </p>
            <div class="ml-auto mt-1 h-1 w-24 rounded-full bg-uniacc-orange" />
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

      <div class="mx-auto hidden max-w-6xl overflow-x-auto border-b border-zinc-200 bg-zinc-100 px-4 py-2 md:block md:px-6">
        <Stepper
          v-model="stepModel"
          :linear="false"
          class="flex w-full min-w-[28rem] items-center gap-0 md:min-w-0"
        >
          <StepperItem
            :step="1"
            class="flex min-w-0 flex-1 flex-row items-center"
            :class="pasoBloqueado(1) ? 'opacity-40' : ''"
          >
            <StepperTrigger class="flex min-w-0 flex-1 flex-row items-center justify-center gap-1.5 p-1">
              <span
                class="text-[11px] leading-tight"
                :class="stepModel === 1 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >1</span>
              <StepperTitle
                class="text-[11px] leading-tight"
                :class="stepModel === 1 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >
                {{ NOMBRES_PASO_ALUMNO[0] }}
              </StepperTitle>
            </StepperTrigger>
            <StepperSeparator class="mx-1 h-px min-w-[0.75rem] flex-1 bg-border" />
          </StepperItem>
          <StepperItem
            :step="2"
            class="flex min-w-0 flex-1 flex-row items-center"
            :class="pasoBloqueado(2) ? 'opacity-40' : ''"
          >
            <StepperTrigger class="flex min-w-0 flex-1 flex-row items-center justify-center gap-1.5 p-1">
              <span
                class="text-[11px] leading-tight"
                :class="stepModel === 2 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >2</span>
              <StepperTitle
                class="text-[11px] leading-tight"
                :class="stepModel === 2 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >
                {{ NOMBRES_PASO_ALUMNO[1] }}
              </StepperTitle>
            </StepperTrigger>
            <StepperSeparator class="mx-1 h-px min-w-[0.75rem] flex-1 bg-border" />
          </StepperItem>
          <StepperItem
            :step="3"
            class="flex min-w-0 flex-1 flex-row items-center"
            :class="pasoBloqueado(3) ? 'opacity-40' : ''"
          >
            <StepperTrigger class="flex min-w-0 flex-1 flex-row items-center justify-center gap-1.5 p-1">
              <span
                class="text-[11px] leading-tight"
                :class="stepModel === 3 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >3</span>
              <StepperTitle
                class="text-[11px] leading-tight"
                :class="stepModel === 3 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >
                {{ NOMBRES_PASO_ALUMNO[2] }}
              </StepperTitle>
            </StepperTrigger>
            <StepperSeparator class="mx-1 h-px min-w-[0.75rem] flex-1 bg-border" />
          </StepperItem>
          <StepperItem
            :step="4"
            class="flex min-w-0 flex-1 flex-row items-center"
            :class="pasoBloqueado(4) ? 'opacity-40' : ''"
          >
            <StepperTrigger class="flex min-w-0 flex-1 flex-row items-center justify-center gap-1.5 p-1">
              <span
                class="text-[11px] leading-tight"
                :class="stepModel === 4 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >4</span>
              <StepperTitle
                class="text-[11px] leading-tight"
                :class="stepModel === 4 ? 'font-semibold text-uniacc-orange' : 'font-medium'"
              >
                {{ NOMBRES_PASO_ALUMNO[3] }}
              </StepperTitle>
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

    <nav
      class="alumno-barra-pasos fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Pasos de la rematrícula"
    >
      <div class="grid grid-cols-4">
        <button
          v-for="(nombre, idx) in NOMBRES_PASO_ALUMNO"
          :key="nombre"
          type="button"
          class="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs"
          :class="[
            pasoBloqueado(idx + 1) ? 'opacity-40' : '',
            stepModel === idx + 1 ? 'font-semibold text-uniacc-orange' : 'font-medium text-zinc-500',
          ]"
          :aria-current="stepModel === idx + 1 ? 'step' : undefined"
          :aria-label="nombre"
          @click="stepModel = idx + 1"
        >
          <span aria-hidden="true">{{ idx + 1 }}</span>
          <span aria-hidden="true">{{ NOMBRES_CORTO_PASO[idx] }}</span>
        </button>
      </div>
    </nav>

    <a
      href="#"
      class="alumno-whatsapp fixed bottom-24 right-6 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-200 hover:scale-110 hover:bg-[#1ebe5d] motion-reduce:transition-none motion-reduce:hover:scale-100 md:bottom-6"
      aria-label="WhatsApp"
      @click.prevent
    >
      <MessageCircle class="h-7 w-7" />
    </a>

    <Sheet :open="menuAbierto" @update:open="menuAbierto = $event">
      <SheetContent side="left" class="w-[18rem]">
        <SheetHeader class="text-left">
          <SheetTitle>{{ headerNombre }}</SheetTitle>
          <SheetDescription>RUT {{ headerRut }}</SheetDescription>
        </SheetHeader>
        <p class="mt-4 text-sm text-zinc-700">{{ headerCarrera }}</p>
        <a
          href="tel:+56226406000"
          class="mt-6 inline-flex cursor-pointer text-sm font-medium text-[#1E3A5F] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange"
          @click="menuAbierto = false"
        >
          Ayuda (+56 2) 26406000
        </a>
      </SheetContent>
    </Sheet>

    <AlertDialog v-model:open="avisoPasoAbierto">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Paso no disponible</AlertDialogTitle>
          <AlertDialogDescription class="text-left">
            {{ avisoPasoTexto }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction class="bg-uniacc-orange hover:bg-uniacc-orange/90">
            Entendido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

<style>
body:has([role='dialog'][data-state='open']) .alumno-barra-pasos,
body:has([role='alertdialog'][data-state='open']) .alumno-barra-pasos,
body:has([role='dialog'][data-state='open']) .alumno-whatsapp,
body:has([role='alertdialog'][data-state='open']) .alumno-whatsapp {
  display: none;
}
</style>
