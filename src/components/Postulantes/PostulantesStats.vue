<script setup lang="ts">
import { ref } from 'vue'
import { Users, TrendingUp, Calendar, Award, GraduationCap, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PostulanteStats } from '@/types/postulante'

defineProps<{
  stats: PostulanteStats | null
  isLoading?: boolean
}>()

// Estado para controlar si el acordeón principal está abierto
const isCarrerasAccordionOpen = ref<boolean>(true)

// Estado para controlar qué acordeones de carreras individuales están abiertos
const openAccordions = ref<Set<number>>(new Set())

function toggleCarrerasAccordion() {
  isCarrerasAccordionOpen.value = !isCarrerasAccordionOpen.value
}

function toggleAccordion(index: number) {
  if (openAccordions.value.has(index)) {
    openAccordions.value.delete(index)
  } else {
    openAccordions.value.add(index)
  }
}
</script>

<template>
  <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-5 relative z-0">
    <!-- Total de postulantes -->
    <Card class="overflow-hidden border-l-4 border-l-blue-500">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle class="text-xs font-medium">Total Postulantes</CardTitle>
        <div class="rounded-full bg-blue-100 p-1.5 dark:bg-blue-900">
          <Users class="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
      </CardHeader>
      <CardContent class="pb-3">
        <div v-if="isLoading" class="h-7 w-16 animate-pulse rounded bg-muted"></div>
        <div v-else class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ stats?.total || 0 }}</div>
        <p class="text-[10px] text-muted-foreground mt-0.5">Año 2026</p>
      </CardContent>
    </Card>

    <!-- Nuevos hoy -->
    <Card class="overflow-hidden border-l-4 border-l-green-500">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle class="text-xs font-medium">Nuevos Hoy</CardTitle>
        <div class="rounded-full bg-green-100 p-1.5 dark:bg-green-900">
          <TrendingUp class="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        </div>
      </CardHeader>
      <CardContent class="pb-3">
        <div v-if="isLoading" class="h-7 w-16 animate-pulse rounded bg-muted"></div>
        <div v-else class="text-2xl font-bold text-green-600 dark:text-green-400">{{ stats?.nuevosHoy || 0 }}</div>
        <p class="text-[10px] text-muted-foreground mt-0.5">Registros de hoy</p>
      </CardContent>
    </Card>

    <!-- Nuevos esta semana -->
    <Card class="overflow-hidden border-l-4 border-l-purple-500">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle class="text-xs font-medium">Esta Semana</CardTitle>
        <div class="rounded-full bg-purple-100 p-1.5 dark:bg-purple-900">
          <Calendar class="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        </div>
      </CardHeader>
      <CardContent class="pb-3">
        <div v-if="isLoading" class="h-7 w-16 animate-pulse rounded bg-muted"></div>
        <div v-else class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ stats?.nuevosEstaSemana || 0 }}</div>
        <p class="text-[10px] text-muted-foreground mt-0.5">Últimos 7 días</p>
      </CardContent>
    </Card>

    <!-- Carrera más popular -->
    <Card class="overflow-hidden border-l-4 border-l-orange-500">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle class="text-xs font-medium">Carrera Top</CardTitle>
        <div class="rounded-full bg-orange-100 p-1.5 dark:bg-orange-900">
          <Award class="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
        </div>
      </CardHeader>
      <CardContent class="pb-3">
        <div v-if="isLoading" class="h-7 w-16 animate-pulse rounded bg-muted"></div>
        <template v-else-if="stats && stats.porCarrera.length > 0">
          <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">{{ stats.porCarrera[0].count }}</div>
          <p class="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{{ stats.porCarrera[0].carrera }}</p>
        </template>
        <div v-else class="text-2xl font-bold text-orange-600">0</div>
      </CardContent>
    </Card>

    <!-- Matriculados -->
    <Card class="overflow-hidden border-l-4 border-l-teal-500">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle class="text-xs font-medium">Matriculados</CardTitle>
        <div class="rounded-full bg-teal-100 p-1.5 dark:bg-teal-900">
          <GraduationCap class="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
        </div>
      </CardHeader>
      <CardContent class="pb-3">
        <div v-if="isLoading" class="h-7 w-16 animate-pulse rounded bg-muted"></div>
        <div v-else>
          <div class="text-2xl font-bold text-teal-600 dark:text-teal-400">{{ stats?.matriculados || 0 }}</div>
          <div class="flex flex-col gap-0.5 mt-1">
            <p class="text-[10px] text-muted-foreground">
              <span class="font-semibold text-teal-600">{{ stats?.matriculadosPrimeraOpcion || 0 }}</span> en 1ª opción
            </p>
            <p class="text-[10px] text-muted-foreground">
              <span class="font-semibold text-orange-600">{{ stats?.matriculadosOtrasOpciones || 0 }}</span> en otras
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>

  <!-- Tarjetas de Estados -->
  <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-5 mt-3 relative z-0">
    <!-- Pendientes -->
    <Card class="overflow-hidden border-l-4 border-l-orange-500">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle class="text-xs font-medium">Pendiente actualización datos U+</CardTitle>
        <div class="rounded-full bg-orange-100 p-1.5 dark:bg-orange-900">
          <Clock class="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
        </div>
      </CardHeader>
      <CardContent class="pb-3">
        <div v-if="isLoading" class="h-7 w-16 animate-pulse rounded bg-muted"></div>
        <div v-else class="text-2xl font-bold text-orange-600 dark:text-orange-400">{{ stats?.pendientes || 0 }}</div>
        <p class="text-[10px] text-muted-foreground mt-0.5">Pendiente actualización datos U+</p>
      </CardContent>
    </Card>

    <!-- En Espera -->
    <Card class="overflow-hidden border-l-4 border-l-indigo-500">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle class="text-xs font-medium">En espera de aprobación</CardTitle>
        <div class="rounded-full bg-indigo-100 p-1.5 dark:bg-indigo-900">
          <AlertCircle class="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
      </CardHeader>
      <CardContent class="pb-3">
        <div v-if="isLoading" class="h-7 w-16 animate-pulse rounded bg-muted"></div>
        <div v-else class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ stats?.enEspera || 0 }}</div>
        <p class="text-[10px] text-muted-foreground mt-0.5">En espera de aprobación de postulación</p>
      </CardContent>
    </Card>

    <!-- Aprobados -->
    <Card class="overflow-hidden border-l-4 border-l-emerald-500">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle class="text-xs font-medium">Postulaciones aprobadas</CardTitle>
        <div class="rounded-full bg-emerald-100 p-1.5 dark:bg-emerald-900">
          <CheckCircle class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
      </CardHeader>
      <CardContent class="pb-3">
        <div v-if="isLoading" class="h-7 w-16 animate-pulse rounded bg-muted"></div>
        <div v-else class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ stats?.aprobados || 0 }}</div>
        <p class="text-[10px] text-muted-foreground mt-0.5">Postulación aprobada</p>
      </CardContent>
    </Card>

    <!-- Desistidos -->
    <Card class="overflow-hidden border-l-4 border-l-red-500">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle class="text-xs font-medium">Desistidos</CardTitle>
        <div class="rounded-full bg-red-100 p-1.5 dark:bg-red-900">
          <XCircle class="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        </div>
      </CardHeader>
      <CardContent class="pb-3">
        <div v-if="isLoading" class="h-7 w-16 animate-pulse rounded bg-muted"></div>
        <div v-else class="text-2xl font-bold text-red-600 dark:text-red-400">{{ stats?.desistidos || 0 }}</div>
        <p class="text-[10px] text-muted-foreground mt-0.5">Postulantes desistidos</p>
      </CardContent>
    </Card>

    <!-- Alumnos Vigentes -->
    <Card class="overflow-hidden border-l-4 border-l-cyan-500">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
        <CardTitle class="text-xs font-medium">Alumnos Vigentes</CardTitle>
        <div class="rounded-full bg-cyan-100 p-1.5 dark:bg-cyan-900">
          <Users class="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
        </div>
      </CardHeader>
      <CardContent class="pb-3">
        <div v-if="isLoading" class="h-7 w-16 animate-pulse rounded bg-muted"></div>
        <div v-else class="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{{ stats?.alumnosVigentes || 0 }}</div>
        <p class="text-[10px] text-muted-foreground mt-0.5">Detectados automáticamente</p>
      </CardContent>
    </Card>
  </div>

  <!-- Gráfico de carreras más populares -->
  <Card v-if="stats && stats.porCarrera.length > 0" class="mt-3 relative z-0" style="isolation: isolate;">
    <CardHeader class="pb-3">
      <button
        type="button"
        @click="toggleCarrerasAccordion"
        class="flex w-full items-center justify-between text-left hover:opacity-80 transition-opacity"
      >
        <div class="flex-1">
          <CardTitle class="text-base">Carreras Más Populares</CardTitle>
          <CardDescription class="text-xs">Top 10 carreras con más postulaciones</CardDescription>
        </div>
        <ChevronDown 
          class="h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2"
          :class="{ 'rotate-180': isCarrerasAccordionOpen }"
        />
      </button>
    </CardHeader>
    <CardContent v-show="isCarrerasAccordionOpen">
      <div class="space-y-1">
        <div
          v-for="(carrera, index) in stats.porCarrera.slice(0, 10)"
          :key="index"
          class="border-b last:border-b-0"
        >
          <!-- Trigger del acordeón -->
          <button
            type="button"
            @click="toggleAccordion(index)"
            class="flex w-full items-center justify-between py-2 text-sm font-medium transition-all hover:bg-muted/50 rounded-md px-1 -mx-1"
          >
            <div class="flex items-start gap-1.5 flex-1 min-w-0">
              <span class="text-[10px] font-semibold text-muted-foreground shrink-0">
                #{{ index + 1 }}
              </span>
              <span class="text-xs font-medium leading-tight break-words text-left">
                {{ carrera.carrera }}
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-xs font-bold text-primary">
                {{ carrera.count }}
              </span>
              <ChevronDown 
                class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200"
                :class="{ 'rotate-180': openAccordions.has(index) }"
              />
            </div>
          </button>
          
          <!-- Contenido del acordeón -->
          <div
            v-show="openAccordions.has(index)"
            class="overflow-hidden transition-all duration-200"
          >
            <div class="px-1 pb-2 pt-1 space-y-2">
              <div
                v-for="(codigoItem, codigoIndex) in carrera.codigos"
                :key="codigoIndex"
                class="flex items-center justify-between text-xs py-1 border-b last:border-b-0"
              >
                <span class="font-mono font-semibold text-primary">{{ codigoItem.codigo || 'N/A' }}</span>
                <span class="font-semibold text-muted-foreground">{{ codigoItem.count }} postulaciones</span>
              </div>
            </div>
          </div>
          
          <!-- Barra de progreso -->
          <div class="relative mt-1 mb-2">
            <div class="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
                :style="{
                  width: `${(carrera.count / stats.porCarrera[0].count) * 100}%`,
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resumen -->
      <div class="mt-3 border-t pt-3">
        <p class="text-xs text-muted-foreground">
          <span class="font-semibold">Total:</span>
          {{ stats.porCarrera.reduce((sum, c) => sum + c.count, 0) }} en top 10
        </p>
      </div>
    </CardContent>
  </Card>
</template>

