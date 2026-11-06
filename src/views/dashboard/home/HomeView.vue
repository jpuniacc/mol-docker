<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  MSG_FUERA_CARTERA_OFICIAL,
  TITULO_FUERA_CARTERA_OFICIAL,
} from '@/constants/carteraOficial'
import TextoPortalSolicitudes from '@/components/rematricula/TextoPortalSolicitudes.vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import AvancePasosAlumno from '@/components/rematricula/AvancePasosAlumno.vue'
import { claveBorradorValida } from '@/utils/borradorRematriculaSync'
import { conciliarRetencionAlumno } from '@/composables/useConciliarRetencion'
import { copyReingresoRematricula, procesoRematriculaIncompleto } from '@/utils/procesoRematriculaIncompleto'
import {
  ctaAvanceHome,
  pasosAvanceHome,
  pasosListosHome,
} from '@/utils/pasoAlumnoRematricula'
import { Phone, Sparkles } from 'lucide-vue-next'

const router = useRouter()
const appStore = useAppStore()
const auth = useAuthStore()
const datosMnp = useDatosAlumnoMnpStore()
const alumnoCtx = useMatriculaAlumnoContextStore()
const periodoActivo = usePeriodoActivoStore()

const saludo = computed(() => auth.displayNombreCompleto || auth.username || 'Usuario')
const bloqueoFueraCartera = computed(() => datosMnp.fueraCarteraOficial)
const esAlumnoPixarron = computed(
  () =>
    auth.authSource === 'pixarron' &&
    datosMnp.cantidadRegistros > 0 &&
    !datosMnp.fueraCarteraOficial,
)

const avance = computed(() =>
  pasosAvanceHome({
    tycAccepted: alumnoCtx.tycAccepted,
    contactoCorreoValidado: alumnoCtx.contactoCorreoValidado,
    contactoTelefonoValidado: alumnoCtx.contactoTelefonoValidado,
    apoderadoConfirmado: alumnoCtx.apoderadoConfirmado,
    discapacidad: alumnoCtx.discapacidad,
    pasoAlcanzado: alumnoCtx.pasoAlcanzado,
    pagoMatricula: alumnoCtx.pagoMatricula,
    formaPagoSeleccionada: alumnoCtx.formaPagoSeleccionada,
    firmaCompletada: alumnoCtx.firmaCompletada,
    envioFirmaIniciado: alumnoCtx.envioFirmaIniciado,
    medioMatricula: alumnoCtx.medioMatricula,
    medioArancel: alumnoCtx.medioArancel,
    webpayMatriculaEstado: alumnoCtx.webpayMatriculaEstado,
    webpayArancelEstado: alumnoCtx.webpayArancelEstado,
    arancelPorPagar: alumnoCtx.webpayMontoArancel,
  }),
)

const pasosCompletados = computed(() => pasosListosHome(avance.value))
const cta = computed(() => ctaAvanceHome(avance.value))

const retencionIncompleta = computed(() =>
  procesoRematriculaIncompleto({
    medioMatricula: alumnoCtx.medioMatricula,
    medioArancel: alumnoCtx.medioArancel,
    webpayMatriculaEstado: alumnoCtx.webpayMatriculaEstado,
    webpayArancelEstado: alumnoCtx.webpayArancelEstado,
    pagoMatricula: alumnoCtx.pagoMatricula,
    firmaCompletada: alumnoCtx.firmaCompletada,
    arancelPorPagar: alumnoCtx.webpayMontoArancel,
    periodoActivo: periodoActivo.anio != null && periodoActivo.semestre != null,
  }),
)

const copyReingreso = computed(() =>
  copyReingresoRematricula({
    medioMatricula: alumnoCtx.medioMatricula,
    medioArancel: alumnoCtx.medioArancel,
    webpayMatriculaEstado: alumnoCtx.webpayMatriculaEstado,
    webpayArancelEstado: alumnoCtx.webpayArancelEstado,
    pagoMatricula: alumnoCtx.pagoMatricula,
    firmaCompletada: alumnoCtx.firmaCompletada,
    arancelPorPagar: alumnoCtx.webpayMontoArancel,
  }),
)

/** true hasta terminar la 1ª conciliación (o si faltan clave/periodo). */
const conciliando = ref(true)
const rutaRetomar = ref<string | null>(null)

async function retomarRematricula(): Promise<void> {
  if (rutaRetomar.value) {
    await router.push({ name: rutaRetomar.value })
    return
  }
  await router.push({ name: 'matricula-alumno-retomar' })
}

watch(
  () =>
    [
      esAlumnoPixarron.value,
      datosMnp.primeraFila?.codcli,
      datosMnp.primeraFila?.rut_alumno,
      periodoActivo.anio,
      periodoActivo.semestre,
    ] as const,
  async () => {
    if (!esAlumnoPixarron.value) {
      conciliando.value = false
      return
    }
    const codcli = datosMnp.primeraFila?.codcli
    const rut = datosMnp.primeraFila?.rut_alumno
    const clave = claveBorradorValida(codcli, periodoActivo.anio, periodoActivo.semestre)
    if (!clave || !codcli || !rut) {
      conciliando.value = true
      return
    }
    conciliando.value = true
    try {
      const r = await conciliarRetencionAlumno({ rut, codcli })
      rutaRetomar.value = r.ruta
      if (r.incompleto && r.ruta) {
        // Banner visible; no forzar redirect automático para no sorprender en home.
      }
    } finally {
      conciliando.value = false
    }
  },
  { immediate: true },
)
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
            Hola, <span class="font-semibold text-zinc-900">{{ saludo }}</span>. Desde aquí entras
            a las herramientas del portal.
          </p>
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
          class="hidden px-4 py-3 text-center text-sm font-semibold leading-snug text-white md:block md:text-[15px]"
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
            <div class="hidden items-center gap-2 text-uniacc-orange md:flex">
              <Sparkles class="h-5 w-5 shrink-0" aria-hidden="true" />
              <span class="text-sm font-medium">Periodo {{ periodoActivo.label ?? '—' }}</span>
            </div>
          </div>
        </div>
      </section>

      <Alert v-if="bloqueoFueraCartera" class="border-red-300 bg-red-50 text-red-950">
        <AlertTitle>{{ TITULO_FUERA_CARTERA_OFICIAL }}</AlertTitle>
        <AlertDescription>
          <TextoPortalSolicitudes :texto="MSG_FUERA_CARTERA_OFICIAL" />
        </AlertDescription>
      </Alert>

      <section
        v-else-if="conciliando"
        class="flex flex-col rounded-2xl border border-uniacc-orange/30 bg-white p-5 shadow-md ring-1 ring-uniacc-orange/10"
        aria-busy="true"
        aria-labelledby="alumno-avance-cargando"
      >
        <h2 id="alumno-avance-cargando" class="text-lg font-semibold text-zinc-900">
          Tu rematrícula
        </h2>
        <p class="mt-2 text-sm text-zinc-600">Recuperando tu avance guardado…</p>
        <Button
          type="button"
          disabled
          class="mt-4 cursor-not-allowed rounded-full bg-uniacc-orange/60 px-6 font-semibold text-white"
        >
          Un momento…
        </Button>
      </section>

      <section
        v-else-if="retencionIncompleta"
        class="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-lg ring-1 ring-orange-100"
        aria-labelledby="retencion-banner-title"
      >
        <div class="bg-[#FF5B00] px-4 py-2.5 text-center text-sm font-semibold tracking-wide text-white">
          Tu avance está guardado
        </div>
        <div class="space-y-3 p-5 md:space-y-4 md:p-6">
          <h2 id="retencion-banner-title" class="text-xl font-bold text-zinc-900 md:text-2xl">
            ¡Tu matrícula ya está pagada! Retomemos donde quedaste.
          </h2>
          <p class="text-sm leading-relaxed text-zinc-600 md:text-base">
            {{ copyReingreso }}
          </p>
          <p class="text-sm font-bold text-zinc-900 md:text-base">
            No necesitas volver a pagar la matrícula.
          </p>
          <Button
            type="button"
            class="h-12 w-full cursor-pointer rounded-full bg-[#FF5B00] text-base font-semibold text-white hover:bg-[#FF5B00]/90"
            @click="retomarRematricula"
          >
            Continuar mi rematrícula →
          </Button>
          <p class="text-center text-sm text-zinc-500">
            Te llevaremos directamente al paso que tienes pendiente.
          </p>
        </div>
      </section>

      <section
        v-else
        class="flex flex-col rounded-2xl border border-uniacc-orange/30 bg-white p-5 shadow-md ring-1 ring-uniacc-orange/10"
          aria-labelledby="alumno-avance-title"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h2 id="alumno-avance-title" class="text-lg font-semibold text-zinc-900">
                Tu rematrícula
              </h2>
              <p class="mt-1 text-sm text-zinc-600">
                {{ pasosCompletados }} de {{ avance.length }} pasos con avance guardado
              </p>
            </div>
            <RouterLink class="ml-auto shrink-0" :to="{ name: cta.routeName }">
              <Button
                type="button"
                class="cursor-pointer rounded-full bg-uniacc-orange px-6 font-semibold text-white shadow-md transition-colors duration-200 hover:bg-uniacc-orange/90"
              >
                {{ cta.label }}
              </Button>
            </RouterLink>
          </div>

          <AvancePasosAlumno class="mt-6" />

          <p class="mt-5 flex items-center gap-2 text-sm text-zinc-500">
            <Phone class="h-4 w-4 shrink-0 text-uniacc-orange" aria-hidden="true" />
            ¿Necesitas ayuda?
            <span class="font-semibold text-zinc-800">(+56 2) 2640 6000</span>
          </p>
      </section>
    </template>
  </div>
</template>
