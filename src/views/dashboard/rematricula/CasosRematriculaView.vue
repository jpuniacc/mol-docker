<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { listarCasosRematricula, resolverCasoRematricula } from '@/services/casoRematriculaApi'
import { CONVENIO_DOC_BUCKET } from '@/services/convenioDocumento'
import { supabase } from '@/services/supabaseClient'
import { useAuthStore } from '@/stores/auth'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type { MnpCasoRematriculaRow } from '@/types/supabase'
import { periodoCatalogoLabel } from '@/utils/periodoCatalogo'

const auth = useAuthStore()
const periodoActivo = usePeriodoActivoStore()

const rows = ref<MnpCasoRematriculaRow[]>([])
const loading = ref(false)
const filtroTipo = ref<string>('todos')
const filtroEstado = ref<string>('EN_REVISION')
const busqueda = ref('')
const seleccionado = ref<MnpCasoRematriculaRow | null>(null)
const motivo = ref('')
const resolviendo = ref(false)
const urlArchivo = ref<string | null>(null)

const periodoDefault = computed(() => {
  const anio = periodoActivo.anio
  const sem = periodoActivo.semestre
  if (anio == null || sem == null) return '2027-01'
  return periodoCatalogoLabel(anio, sem)
})

const etiquetasTipo: Record<string, string> = {
  CONVENIO_CERTIFICADO: 'Certificado convenio',
  APODERADO_DATOS: 'Apoderado',
  CAE_RESOLUCION: 'CAE',
  ESTATAL_MINEDUC: 'Beca ministerial',
  TYC_RECHAZO: 'TyC no aceptados',
}

const filasVisibles = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((row) => {
    const rut = (row.rut_alumno ?? '').toLowerCase()
    const nombre = (row.nombre_alumno ?? '').toLowerCase()
    const codcli = (row.codcli ?? '').toLowerCase()
    return rut.includes(q) || nombre.includes(q) || codcli.includes(q)
  })
})

function payloadTexto(row: MnpCasoRematriculaRow, key: string): string | null {
  const v = row.payload[key]
  return typeof v === 'string' && v.trim() ? v : null
}

async function cargar() {
  loading.value = true
  try {
    await periodoActivo.ensureLoaded()
    const { data, error } = await listarCasosRematricula({
      periodo: periodoDefault.value,
      tipo: filtroTipo.value === 'todos' ? null : filtroTipo.value,
      estado: filtroEstado.value === 'todos' ? null : filtroEstado.value,
    })
    if (error) {
      toast.error(error)
      rows.value = []
      return
    }
    rows.value = data
  } finally {
    loading.value = false
  }
}

async function abrirDetalle(row: MnpCasoRematriculaRow) {
  seleccionado.value = row
  motivo.value = ''
  urlArchivo.value = null
  const path = payloadTexto(row, 'storage_path')
  if (row.tipo === 'CONVENIO_CERTIFICADO' && path) {
    const { data, error } = await supabase.storage
      .from(CONVENIO_DOC_BUCKET)
      .createSignedUrl(path, 300)
    if (!error) urlArchivo.value = data?.signedUrl ?? null
  }
}

async function resolver(estado: 'APROBADO' | 'RECHAZADO') {
  const row = seleccionado.value
  if (!row) return
  if (estado === 'RECHAZADO' && !motivo.value.trim()) {
    toast.error('Indica el motivo del rechazo.')
    return
  }
  resolviendo.value = true
  try {
    const quien = auth.email?.trim() || auth.displayNombreCompleto?.trim() || 'consejero'
    const { error } = await resolverCasoRematricula({
      id: row.id,
      estado,
      resueltoPor: quien,
      motivo: motivo.value.trim() || null,
    })
    if (error) {
      toast.error(error)
      return
    }
    toast.success(estado === 'APROBADO' ? 'Caso aprobado.' : 'Caso rechazado.')
    seleccionado.value = null
    await cargar()
  } finally {
    resolviendo.value = false
  }
}

watch([filtroTipo, filtroEstado], () => {
  void cargar()
})

onMounted(() => {
  void cargar()
})
</script>

<template>
  <div class="mx-auto max-w-[1200px] space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Casos rematrícula</CardTitle>
        <CardDescription>
          Periodo {{ periodoDefault }}. Cola de alumnos detenidos: certificado, CAE, ministerial,
          apoderado y TyC no aceptados.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Tabs v-model="filtroTipo">
          <TabsList class="flex h-auto flex-wrap">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="CONVENIO_CERTIFICADO">Certificado</TabsTrigger>
            <TabsTrigger value="CAE_RESOLUCION">CAE</TabsTrigger>
            <TabsTrigger value="ESTATAL_MINEDUC">Ministerial</TabsTrigger>
            <TabsTrigger value="APODERADO_DATOS">Apoderado</TabsTrigger>
            <TabsTrigger value="TYC_RECHAZO">TyC no aceptados</TabsTrigger>
          </TabsList>
        </Tabs>
        <div class="flex flex-wrap gap-3">
          <Select v-model="filtroEstado">
            <SelectTrigger class="w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EN_REVISION">En revisión</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="APROBADO">Aprobado</SelectItem>
              <SelectItem value="RECHAZADO">Rechazado</SelectItem>
              <SelectItem value="CERRADO">Cerrado</SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-model="busqueda"
            class="w-64"
            placeholder="Buscar RUT, nombre o codcli"
          />
          <Button type="button" variant="outline" :disabled="loading" @click="cargar">
            Actualizar
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RUT</TableHead>
              <TableHead>Alumno</TableHead>
              <TableHead>Carrera</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Título</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in filasVisibles" :key="row.id">
              <TableCell>{{ row.rut_alumno ?? '—' }}</TableCell>
              <TableCell>{{ row.nombre_alumno ?? row.codcli }}</TableCell>
              <TableCell>{{ row.carrera ?? '—' }}</TableCell>
              <TableCell>{{ etiquetasTipo[row.tipo] ?? row.tipo }}</TableCell>
              <TableCell>
                <Badge variant="outline">{{ row.estado }}</Badge>
              </TableCell>
              <TableCell>{{ row.titulo }}</TableCell>
              <TableCell>
                <Button type="button" size="sm" variant="outline" @click="abrirDetalle(row)">
                  Ver
                </Button>
              </TableCell>
            </TableRow>
            <TableRow v-if="!loading && filasVisibles.length === 0">
              <TableCell colspan="7" class="text-muted-foreground">Sin casos.</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card v-if="seleccionado">
      <CardHeader>
        <CardTitle>{{ seleccionado.titulo }}</CardTitle>
        <CardDescription>
          {{ seleccionado.rut_alumno }} · {{ seleccionado.carrera }} · {{ seleccionado.jornada }}
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <p class="text-sm">{{ seleccionado.detalle }}</p>
        <p v-if="seleccionado.motivo" class="text-sm text-red-700">Motivo: {{ seleccionado.motivo }}</p>
        <a
          v-if="urlArchivo"
          :href="urlArchivo"
          target="_blank"
          rel="noreferrer"
          class="text-sm text-uniacc-orange underline"
        >
          Ver documento
        </a>
        <template
          v-if="
            seleccionado.tipo === 'CONVENIO_CERTIFICADO' &&
            seleccionado.estado === 'EN_REVISION'
          "
        >
          <div class="space-y-2">
            <Label for="motivo-rechazo">Motivo (obligatorio al rechazar)</Label>
            <Input id="motivo-rechazo" v-model="motivo" />
          </div>
          <div class="flex gap-2">
            <Button type="button" :disabled="resolviendo" @click="resolver('APROBADO')">
              Aprobar
            </Button>
            <Button
              type="button"
              variant="outline"
              :disabled="resolviendo"
              @click="resolver('RECHAZADO')"
            >
              Rechazar
            </Button>
          </div>
        </template>
        <p v-else class="text-sm text-muted-foreground">
          Este tipo se lista para seguimiento. La resolución detallada se suma en una siguiente
          iteración.
        </p>
        <Button type="button" variant="ghost" @click="seleccionado = null">Cerrar</Button>
      </CardContent>
    </Card>
  </div>
</template>
