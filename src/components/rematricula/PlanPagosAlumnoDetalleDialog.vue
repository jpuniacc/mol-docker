<script setup lang="ts">
import { computed } from 'vue'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { filaFueraCarteraOficial } from '@/constants/carteraOficial'
import { fmtMontoClp } from '@/services/fetchPlanPagosMv'
import type { PlanPagosMvBeneficioDetalle, PlanPagosMvRow } from '@/types/supabase'

const props = defineProps<{
  open: boolean
  row: PlanPagosMvRow | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const fmtMonto = fmtMontoClp

function onOpenChange(v: boolean) {
  emit('update:open', v)
}

function beneficiosLista(r: PlanPagosMvRow | null): PlanPagosMvBeneficioDetalle[] {
  const raw = r?.beneficios_detalle
  if (!raw || !Array.isArray(raw)) return []
  return raw
}

function esSi(v: string | null | undefined): boolean {
  return (v ?? '').trim().toLowerCase() === 'si'
}

function fmtCuotas(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n)) || Number(n) <= 0) return 'Sin cuotas'
  return Number(n) === 1 ? '1 cuota' : `${Number(n)} cuotas`
}

function montoBeneficios(r: PlanPagosMvRow | null): number {
  if (!r) return 0
  const total = Number(r.monto_total_beneficios)
  if (Number.isFinite(total) && total > 0) return total
  return Number(r.beca_matricula ?? 0) + Number(r.beca_arancel ?? 0)
}

function montoBrutoPlan(r: PlanPagosMvRow | null): number {
  if (!r) return 0
  return Number(r.monto_matricula ?? 0) + Number(r.monto_arancel ?? 0)
}

function montoNetoPlan(r: PlanPagosMvRow | null): number {
  if (!r) return 0
  return montoBrutoPlan(r) - montoBeneficios(r)
}

function beneficioPeriodoLabel(r: PlanPagosMvRow | null): string {
  if (!r?.beneficio_ano || !r?.beneficio_periodo) return '—'
  return `${r.beneficio_ano}-${r.beneficio_periodo}`
}

function aplicableLabel(v: string | null | undefined): string {
  const raw = (v ?? '').trim()
  const norm = raw.toUpperCase()
  if (!raw) return 'Sin clasificar'
  if (norm === 'M' || norm === 'MATRICULA') return 'Matrícula'
  if (norm === 'A' || norm === 'ARANCEL' || norm === 'S' || norm === 'SI') return 'Arancel'
  return raw
}

function fmtTexto(v: string | number | null | undefined, fallback = '—'): string {
  if (v == null) return fallback
  const s = String(v).trim()
  return s === '' ? fallback : s
}

function nombreCompletoAlumno(r: PlanPagosMvRow | null): string {
  if (!r) return '—'
  const partes = [r.nombre_alumno, r.apellido_paterno_alumno, r.apellido_materno_alumno]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
  return partes.length ? partes.join(' ') : fmtTexto(r.nombre_alumno)
}

function nombreCompletoApoderado(r: PlanPagosMvRow | null): string {
  if (!r) return '—'
  const partes = [
    r.nombre_apoderado,
    r.apellido_paterno_apoderado,
    r.apellido_materno_apoderado,
  ]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
  return partes.length ? partes.join(' ') : fmtTexto(r.nombre_apoderado)
}

function ubicacionLabel(r: PlanPagosMvRow | null): string {
  if (!r) return '—'
  const partes = [r.direccion, r.comuna, r.ciudad].map((p) => (p ?? '').trim()).filter(Boolean)
  return partes.length ? partes.join(', ') : '—'
}

function discapacidadLabel(r: PlanPagosMvRow | null): string {
  const raw = (r?.discapacidad ?? '').trim()
  if (!raw) return 'No registrada'
  const norm = raw.toLowerCase()
  if (norm === 'no' || norm === 'n') return 'No'
  return raw
}

function tieneMontoConcepto(v: number | null | undefined): boolean {
  const n = Number(v)
  return Number.isFinite(n) && n > 0
}

function estadoConceptoPago(r: PlanPagosMvRow | null, tipo: 'matricula' | 'arancel'): string {
  if (!r) return 'Sin documento de pago'
  const monto = tipo === 'matricula' ? r.monto_matricula : r.monto_arancel
  if (!tieneMontoConcepto(monto)) return 'Sin documento de pago'
  return fmtMonto(monto)
}

function montoConceptoBruto(r: PlanPagosMvRow | null, tipo: 'matricula' | 'arancel'): number {
  if (!r) return 0
  return tipo === 'matricula' ? Number(r.monto_matricula ?? 0) : Number(r.monto_arancel ?? 0)
}

function montoConceptoBeneficio(r: PlanPagosMvRow | null, tipo: 'matricula' | 'arancel'): number {
  if (!r) return 0
  return tipo === 'matricula' ? Number(r.beca_matricula ?? 0) : Number(r.beca_arancel ?? 0)
}

function montoConceptoNeto(r: PlanPagosMvRow | null, tipo: 'matricula' | 'arancel'): number {
  if (!r) return 0
  const neto = tipo === 'matricula' ? r.valor_total_matricula : r.valor_total_arancel
  if (neto != null && Number.isFinite(Number(neto))) return Number(neto)
  return Math.max(0, montoConceptoBruto(r, tipo) - montoConceptoBeneficio(r, tipo))
}

function cuotasConcepto(r: PlanPagosMvRow | null, tipo: 'matricula' | 'arancel'): string {
  if (!r) return '—'
  const n = tipo === 'matricula' ? r.cuota_matricula : r.cuota_arancel
  if (!tieneMontoConcepto(montoConceptoBruto(r, tipo))) return '—'
  return fmtCuotas(n)
}

function valorCuotaConcepto(r: PlanPagosMvRow | null, tipo: 'matricula' | 'arancel'): string {
  if (!r || !tieneMontoConcepto(montoConceptoBruto(r, tipo))) return '—'
  const cuotas = tipo === 'matricula' ? r.cuota_matricula : r.cuota_arancel
  const nCuotas = Number(cuotas)
  if (!Number.isFinite(nCuotas) || nCuotas <= 0) return '—'
  return fmtMonto(montoConceptoNeto(r, tipo) / nCuotas)
}

function jornadaModalidadLabel(r: PlanPagosMvRow | null): string {
  if (!r) return '—'
  const carrera = (r.nombre_carrera ?? r.carrera ?? '').toUpperCase()
  const cod = (r.cod_carrera ?? '').toUpperCase()
  const hints: [string, string][] = [
    ['DIURNA', 'Diurna'],
    ['VESPERTINA', 'Vespertina'],
    ['ONLINE', 'Online'],
    ['DISTANCIA', 'A distancia'],
    ['SEMIPRESENCIAL', 'Semipresencial'],
  ]
  for (const [needle, label] of hints) {
    if (carrera.includes(needle) || cod.includes(needle.slice(0, 3))) return label
  }
  return '—'
}

function montoBeneficioItem(b: PlanPagosMvBeneficioDetalle): number {
  const apr = Number(b.monto_aprobado)
  if (Number.isFinite(apr) && apr > 0) return apr
  const m = Number(b.monto)
  return Number.isFinite(m) ? m : 0
}

function porcentajeBeneficio(b: PlanPagosMvBeneficioDetalle): string {
  const p = b.porc_apr
  if (p == null || Number.isNaN(Number(p))) return '—'
  return `${Number(p)}%`
}

function codigoBeneficioLabel(b: PlanPagosMvBeneficioDetalle): string {
  return fmtTexto(b.cod_beneficio, 'Sin código')
}

function fmtFechaSync(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(ts))
  } catch {
    return ts
  }
}

const detalleNombreCompleto = computed(() => nombreCompletoAlumno(props.row))
const detalleTieneBeneficios = computed(
  () =>
    (props.row?.cantidad_beneficios ?? 0) > 0 ||
    beneficiosLista(props.row).length > 0 ||
    esSi(props.row?.tiene_beneficio),
)
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader class="space-y-3 border-b border-zinc-100 pb-4">
        <div class="space-y-1">
          <DialogTitle class="text-xl leading-tight">
            {{ detalleNombreCompleto }}
          </DialogTitle>
          <DialogDescription class="text-sm">
            <span class="font-mono">{{ row?.codcli ?? '—' }}</span>
            · RUT {{ row?.rut ?? '—' }}
            · Período {{ row?.periodo_rematricula ?? row?.periodo ?? '—' }}
          </DialogDescription>
          <p v-if="row" class="text-sm font-medium text-zinc-700">
            {{ row.nombre_carrera ?? row.carrera ?? '—' }}
          </p>
        </div>
        <div v-if="row" class="flex flex-wrap gap-2">
          <Badge :variant="esSi(row.alumno_cae) ? 'success' : 'outline'">
            CAE: {{ row.alumno_cae ?? 'No' }}
          </Badge>
          <Badge :variant="detalleTieneBeneficios ? 'success' : 'outline'">
            Beneficio: {{ row.tiene_beneficio ?? 'No' }}
          </Badge>
          <Badge variant="secondary">
            {{ row.estado_academico ?? 'Estado no informado' }}
          </Badge>
          <Badge
            v-if="filaFueraCarteraOficial(row)"
            class="bg-red-600 hover:bg-red-600/90"
          >
            Fuera de cartera oficial
          </Badge>
        </div>
      </DialogHeader>

      <div v-if="row" class="space-y-4 text-sm">
        <div
          class="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-3"
        >
          <div>
            <p class="text-xs text-zinc-500">Bruto plan</p>
            <p class="text-lg font-semibold tabular-nums">
              {{ fmtMonto(montoBrutoPlan(row)) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-zinc-500">Beneficios</p>
            <p class="text-lg font-semibold tabular-nums text-emerald-700">
              {{ fmtMonto(montoBeneficios(row)) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-zinc-500">Neto plan</p>
            <p class="text-lg font-semibold tabular-nums text-zinc-900">
              {{ fmtMonto(montoNetoPlan(row)) }}
            </p>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <Card class="border-zinc-200 shadow-none">
            <CardHeader class="pb-2">
              <CardTitle class="text-base">Datos personales</CardTitle>
            </CardHeader>
            <CardContent class="space-y-0">
              <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                <span class="text-zinc-500">RUT</span>
                <span class="font-mono text-right">{{ fmtTexto(row.rut) }}</span>
              </div>
              <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                <span class="text-zinc-500">Nombre completo</span>
                <span class="text-right">{{ detalleNombreCompleto }}</span>
              </div>
              <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                <span class="text-zinc-500">Correo</span>
                <span class="text-right break-all">{{ fmtTexto(row.mail) }}</span>
              </div>
              <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                <span class="text-zinc-500">Teléfono</span>
                <span class="text-right">{{ fmtTexto(row.telefono) }}</span>
              </div>
              <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                <span class="text-zinc-500">Ubicación</span>
                <span class="max-w-[60%] text-right">{{ ubicacionLabel(row) }}</span>
              </div>
              <div class="flex justify-between gap-4 py-2">
                <span class="text-zinc-500">Discapacidad</span>
                <span class="text-right">{{ discapacidadLabel(row) }}</span>
              </div>
            </CardContent>
          </Card>

          <Card class="border-zinc-200 shadow-none">
            <CardHeader class="pb-2">
              <CardTitle class="text-base">Datos apoderado</CardTitle>
            </CardHeader>
            <CardContent class="space-y-0">
              <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                <span class="text-zinc-500">RUT apoderado</span>
                <span class="font-mono text-right">{{ fmtTexto(row.rut_apoder) }}</span>
              </div>
              <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                <span class="text-zinc-500">Nombre completo</span>
                <span class="text-right">{{ nombreCompletoApoderado(row) }}</span>
              </div>
              <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                <span class="text-zinc-500">Responsable financiero</span>
                <span class="text-right">{{ fmtTexto(row.es_responsable_financiero) }}</span>
              </div>
              <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                <span class="text-zinc-500">Teléfono</span>
                <span class="text-right">{{
                  fmtTexto(row.telefono_apoder ?? row.telefono_apoderado)
                }}</span>
              </div>
              <div class="flex justify-between gap-4 py-2">
                <span class="text-zinc-500">Email</span>
                <span class="text-right">{{ fmtTexto(row.mail_apoder) }}</span>
              </div>
            </CardContent>
          </Card>

          <Card class="border-zinc-200 shadow-none md:col-span-2">
            <CardHeader class="pb-2">
              <CardTitle class="text-base">Carrera y situación académica</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2 sm:col-span-2">
                  <span class="text-zinc-500">Carrera</span>
                  <span class="max-w-[65%] text-right">{{
                    fmtTexto(row.nombre_carrera ?? row.carrera)
                  }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Código carrera</span>
                  <span class="font-mono text-right">{{ fmtTexto(row.cod_carrera) }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Jornada / modalidad</span>
                  <span class="text-right">{{ jornadaModalidadLabel(row) }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Plan de estudio</span>
                  <span class="text-right">{{ fmtTexto(row.nombre_planestudios) }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Código plan</span>
                  <span class="font-mono text-right">{{ fmtTexto(row.codigo_planestudio) }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Año / periodo ingreso</span>
                  <span class="text-right">
                    {{
                      row.ano_ingreso != null && row.periodo_ingreso != null
                        ? `${row.ano_ingreso}-${row.periodo_ingreso}`
                        : '—'
                    }}
                  </span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Categoría alumno</span>
                  <span class="text-right">{{ row.categoria_alumno ?? '—' }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Última matrícula</span>
                  <span class="text-right">{{ fmtTexto(row.ult_matricula) }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Última situación</span>
                  <span class="max-w-[65%] text-right">{{ fmtTexto(row.ultima_situacion) }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Periodo rematrícula</span>
                  <span class="text-right">{{ fmtTexto(row.periodo_rematricula) }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Ramos aprobados</span>
                  <span class="tabular-nums text-right">{{ row.ramos_aprobados ?? '—' }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Ramos reprobados</span>
                  <span class="tabular-nums text-right">{{ row.ramos_reprobados ?? '—' }}</span>
                </div>
                <div class="flex justify-between gap-4 border-b border-zinc-100 py-2">
                  <span class="text-zinc-500">Promedio último período</span>
                  <span class="tabular-nums text-right">{{ row.prom_ultimo_periodo ?? '—' }}</span>
                </div>
                <div class="flex justify-between gap-4 py-2">
                  <span class="text-zinc-500">Promedio anual</span>
                  <span class="tabular-nums text-right">{{ row.prom_anio ?? '—' }}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card class="border-zinc-200 shadow-none md:col-span-2">
            <CardHeader class="pb-2">
              <CardTitle class="text-base">Plan de pago</CardTitle>
              <CardDescription>
                Valores por concepto según documentos sincronizados del ERP
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid gap-3 rounded-lg border border-zinc-100 p-3 sm:grid-cols-2">
                <div class="space-y-2">
                  <p class="font-medium text-zinc-800">Matrícula</p>
                  <div class="flex justify-between gap-2 text-xs">
                    <span class="text-zinc-500">Estado</span>
                    <span
                      :class="
                        tieneMontoConcepto(row.monto_matricula)
                          ? 'font-medium tabular-nums'
                          : 'text-amber-700'
                      "
                    >
                      {{ estadoConceptoPago(row, 'matricula') }}
                    </span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-zinc-500">Cuotas</span>
                    <span>{{ cuotasConcepto(row, 'matricula') }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-zinc-500">Valor cuota</span>
                    <span class="tabular-nums">{{ valorCuotaConcepto(row, 'matricula') }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-zinc-500">Beneficio</span>
                    <span class="tabular-nums text-emerald-700">{{
                      fmtMonto(montoConceptoBeneficio(row, 'matricula'))
                    }}</span>
                  </div>
                  <div class="flex justify-between gap-2 border-t pt-2">
                    <span class="font-medium text-zinc-700">Neto</span>
                    <span class="font-semibold tabular-nums">{{
                      tieneMontoConcepto(row.monto_matricula)
                        ? fmtMonto(montoConceptoNeto(row, 'matricula'))
                        : '—'
                    }}</span>
                  </div>
                </div>
                <div class="space-y-2">
                  <p class="font-medium text-zinc-800">Arancel</p>
                  <div class="flex justify-between gap-2 text-xs">
                    <span class="text-zinc-500">Estado</span>
                    <span
                      :class="
                        tieneMontoConcepto(row.monto_arancel)
                          ? 'font-medium tabular-nums'
                          : 'text-amber-700'
                      "
                    >
                      {{ estadoConceptoPago(row, 'arancel') }}
                    </span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-zinc-500">Cuotas</span>
                    <span>{{ cuotasConcepto(row, 'arancel') }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-zinc-500">Valor cuota</span>
                    <span class="tabular-nums">{{ valorCuotaConcepto(row, 'arancel') }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-zinc-500">Beneficio</span>
                    <span class="tabular-nums text-emerald-700">{{
                      fmtMonto(montoConceptoBeneficio(row, 'arancel'))
                    }}</span>
                  </div>
                  <div class="flex justify-between gap-2 border-t pt-2">
                    <span class="font-medium text-zinc-700">Neto</span>
                    <span class="font-semibold tabular-nums">{{
                      tieneMontoConcepto(row.monto_arancel)
                        ? fmtMonto(montoConceptoNeto(row, 'arancel'))
                        : '—'
                    }}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card class="border-zinc-200 shadow-none md:col-span-2">
            <CardHeader class="pb-2">
              <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle class="text-base">Beneficios</CardTitle>
                  <CardDescription>
                    Período auditado: {{ beneficioPeriodoLabel(row) }} ·
                    {{ row.cantidad_beneficios ?? beneficiosLista(row).length }} registro(s)
                  </CardDescription>
                </div>
                <Badge v-if="detalleTieneBeneficios" variant="success" class="w-fit">
                  {{ fmtMonto(montoBeneficios(row)) }}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p
                v-if="!beneficiosLista(row).length"
                class="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-center text-zinc-500"
              >
                Sin beneficios aprobados para el período consolidado.
              </p>
              <div v-else class="space-y-2">
                <div
                  v-for="(b, i) in beneficiosLista(row)"
                  :key="`${b.cod_beneficio}-${i}`"
                  class="rounded-lg border border-zinc-200 p-3"
                >
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div class="min-w-0 flex-1">
                      <p class="font-medium text-zinc-900">
                        {{ b.descripcion ?? 'Sin descripción' }}
                      </p>
                      <p class="mt-0.5 font-mono text-xs text-zinc-500">
                        Código {{ codigoBeneficioLabel(b) }}
                      </p>
                    </div>
                    <div class="flex shrink-0 flex-wrap gap-1.5">
                      <Badge variant="outline">{{ aplicableLabel(b.aplicable) }}</Badge>
                      <Badge
                        v-if="b.estado"
                        :variant="
                          (b.estado ?? '').toUpperCase() === 'ASIGNADO' ? 'success' : 'secondary'
                        "
                      >
                        {{ b.estado }}
                      </Badge>
                    </div>
                  </div>
                  <div class="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div>
                      <p class="text-zinc-500">Monto aprobado</p>
                      <p class="font-semibold tabular-nums">
                        {{ fmtMonto(montoBeneficioItem(b)) }}
                      </p>
                    </div>
                    <div>
                      <p class="text-zinc-500">% aprobado</p>
                      <p class="font-semibold tabular-nums">{{ porcentajeBeneficio(b) }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <p class="text-xs text-zinc-500 md:col-span-2">
            Sincronizado: {{ fmtFechaSync(row.synced_at) }} · Snapshot
            {{ row.anio_matricula ?? '—' }}-{{ row.periodo_matricula ?? '—' }}
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
