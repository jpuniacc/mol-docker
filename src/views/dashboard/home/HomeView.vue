<script setup lang="ts">
import { computed } from 'vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  MSG_FUERA_CARTERA_OFICIAL,
  TITULO_FUERA_CARTERA_OFICIAL,
} from '@/constants/carteraOficial'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { GraduationCap, LayoutDashboard, Sparkles } from 'lucide-vue-next'

const appStore = useAppStore()
const auth = useAuthStore()
const datosMnp = useDatosAlumnoMnpStore()

const saludo = computed(() => auth.displayNombreCompleto || auth.username || 'Usuario')
const bloqueoFueraCartera = computed(() => datosMnp.fueraCarteraOficial)
</script>

<template>
  <div class="space-y-8">
    <div
      class="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200/80"
    >
      <div
        class="px-4 py-3 text-center text-sm font-semibold leading-snug text-white md:text-[15px]"
        style="background: linear-gradient(90deg, #ff5b00 0%, #ee2183 50%, #4d98c5 100%)"
      >
        Bienvenido al {{ appStore.appName }}
      </div>
      <div class="space-y-2 px-4 py-6 md:px-8 md:py-8">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">Inicio</h1>
            <p class="mt-1 text-sm text-zinc-600 md:text-base">
              Hola, <span class="font-semibold text-zinc-900">{{ saludo }}</span>. Desde aquí puedes
              acceder al flujo de rematrícula y a las herramientas del portal.
            </p>
          </div>
          <div class="hidden items-center gap-2 text-uniacc-orange sm:flex">
            <Sparkles class="h-5 w-5 shrink-0" aria-hidden="true" />
            <span class="text-sm font-medium">Periodo académico activo</span>
          </div>
        </div>
      </div>
    </div>

    <Alert
      v-if="bloqueoFueraCartera"
      class="border-red-300 bg-red-50 text-red-950"
    >
      <AlertTitle>{{ TITULO_FUERA_CARTERA_OFICIAL }}</AlertTitle>
      <AlertDescription>{{ MSG_FUERA_CARTERA_OFICIAL }}</AlertDescription>
    </Alert>

    <Card
      v-if="!bloqueoFueraCartera"
      class="border border-uniacc-orange/30 bg-white shadow-md ring-1 ring-uniacc-orange/10"
    >
      <CardHeader class="flex flex-row items-start gap-3 space-y-0 pb-2">
        <GraduationCap class="h-8 w-8 shrink-0 text-uniacc-orange" />
        <div class="space-y-1">
          <CardTitle class="text-lg text-zinc-900">Simular rematrícula</CardTitle>
          <CardDescription class="text-zinc-700">
            Demostración del flujo de rematrícula para alumnos sin fila en
            <code class="rounded bg-uniacc-orange/10 px-1 py-0.5 text-zinc-800">mv_usuario</code>
            (validación alternativa). En producción podrías restringirlo a
            <code class="rounded bg-uniacc-orange/10 px-1 py-0.5 text-zinc-800">authSource === 'pixarron'</code>.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <RouterLink :to="{ name: 'matricula-mock-seleccion-alumno' }">
          <Button
            type="button"
            class="rounded-full bg-uniacc-orange px-6 font-semibold text-white shadow-md hover:bg-uniacc-orange/90"
          >
            Iniciar simulación de rematrícula
          </Button>
        </RouterLink>
      </CardContent>
    </Card>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card class="border-zinc-200 shadow-sm">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium text-zinc-900">Resumen</CardTitle>
          <LayoutDashboard class="h-4 w-4 text-uniacc-orange" />
        </CardHeader>
        <CardContent>
          <p class="text-sm leading-relaxed text-zinc-600">
            El panel mostrará indicadores y accesos directos cuando los módulos de negocio estén
            conectados.
          </p>
        </CardContent>
      </Card>

      <Card class="border-zinc-200 shadow-sm">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-zinc-900">Tu sesión</CardTitle>
        </CardHeader>
        <CardContent class="space-y-2 text-sm text-zinc-600">
          <p>
            <span class="font-medium text-zinc-800">Usuario:</span>
            {{ auth.username ?? '—' }}
          </p>
          <p v-if="auth.email">
            <span class="font-medium text-zinc-800">Correo:</span>
            {{ auth.email }}
          </p>
        </CardContent>
      </Card>

      <Card class="border-zinc-200 shadow-sm md:col-span-2 lg:col-span-1">
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium text-zinc-900">Ayuda</CardTitle>
          <CardDescription class="text-zinc-600">
            ¿Necesitas asistencia con la rematrícula?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-zinc-600">
            Contacta a
            <span class="font-semibold text-uniacc-orange">(+56 2) 2640 6000</span>
            o revisa la guía desde el inicio de sesión.
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
