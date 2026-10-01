<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchKpiProgresoRematricula, refreshProgresoRematricula } from '@/services/progresoRematriculaApi'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type { EtapaProgresoRematricula, KpiProgresoRematricula } from '@/types/supabase'
import { etiquetaEtapaProgreso } from '@/utils/etapaProgresoRematricula'

const ORDEN_EMBUDO_ASC: EtapaProgresoRematricula[] = [
  'sin_ingreso',
  'ingreso',
  'tyc',
  'datos',
  'forma_pago',
  'firma',
  'matriculado',
]

const periodoActivo = usePeriodoActivoStore()

const loading = ref(false)
const refreshing = ref(false)
const kpi = ref<KpiProgresoRematricula | null>(null)

const tienePeriodo = computed(() => {
  return periodoActivo.anio != null && periodoActivo.semestre != null
})

const periodoLabel = computed(() => {
  return periodoActivo.label ?? '—'
})

const embudoEtapas = computed(() => {
  if (!kpi.value) return []

  return ORDEN_EMBUDO_ASC.map(etapa => ({
    etapa,
    label: etiquetaEtapaProgreso(etapa),
    count: kpi.value![etapa] ?? 0,
  }))
})

async function cargarKpi() {
  if (!tienePeriodo.value) return
  
  loading.value = true
  try {
    const { data, error } = await fetchKpiProgresoRematricula(
      periodoActivo.anio!,
      periodoActivo.semestre!
    )
    if (error) {
      toast.error(`Error al cargar KPI: ${error}`)
      return
    }
    kpi.value = data
  } finally {
    loading.value = false
  }
}

async function actualizarProgreso() {
  if (!tienePeriodo.value) return
  
  refreshing.value = true
  try {
    const { error } = await refreshProgresoRematricula(
      periodoActivo.anio!,
      periodoActivo.semestre!
    )
    if (error) {
      toast.error(`Error al actualizar progreso: ${error}`)
      return
    }
    
    await cargarKpi()
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  await periodoActivo.ensureLoaded()
  if (tienePeriodo.value) {
    await actualizarProgreso()
  }
})
</script>

<template>
  <div class="mx-auto max-w-[1200px] space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>KPI Rematrícula</CardTitle>
        <CardDescription>
          Periodo {{ periodoLabel }}. Vista general del progreso de rematrícula.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="!tienePeriodo" class="text-sm text-muted-foreground">
          No hay periodo activo configurado. 
          <router-link 
            to="/dashboard/mantenedor-periodo-activo" 
            class="text-uniacc-celeste underline"
          >
            Ir al mantenedor de periodo
          </router-link>
        </div>
        <div v-else class="space-y-4">
          <Button 
            type="button" 
            :disabled="loading || refreshing" 
            @click="actualizarProgreso"
          >
            {{ refreshing ? 'Actualizando...' : 'Actualizar progreso' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <div v-if="tienePeriodo && kpi" class="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle class="text-2xl">{{ kpi.total_cartera ?? 0 }}</CardTitle>
          <CardDescription>Total cartera</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-2xl">{{ kpi.excluidos_mol ?? 0 }}</CardTitle>
          <CardDescription>Excluidos MOL</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-2xl">{{ kpi.sin_match ?? 0 }}</CardTitle>
          <CardDescription>Sin match MOL</CardDescription>
        </CardHeader>
      </Card>
    </div>

    <Card v-if="tienePeriodo && kpi && embudoEtapas.length > 0">
      <CardHeader>
        <CardTitle>Embudo de etapas</CardTitle>
        <CardDescription>
          Distribución de alumnos por etapa del proceso de rematrícula
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-3">
          <div 
            v-for="item in embudoEtapas" 
            :key="item.etapa"
            class="flex items-center justify-between rounded-lg border p-3"
          >
            <div class="flex items-center gap-3">
              <Badge variant="outline">{{ item.label }}</Badge>
            </div>
            <div class="text-lg font-semibold">{{ item.count }}</div>
          </div>
        </div>
      </CardContent>
    </Card>

    <div v-if="loading && !kpi" class="text-center text-sm text-muted-foreground">
      Cargando KPI...
    </div>
  </div>
</template>
