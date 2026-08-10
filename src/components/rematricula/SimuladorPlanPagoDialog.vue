<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { Calculator, FileDown, History, Loader2 } from "lucide-vue-next";

import {
  downloadAlumnoPdfOficial,
  previewAlumnoPdfBorrador,
} from "@/services/planPagoPdfBatch";
import { fmtMontoClp } from "@/services/fetchPlanPagosMv";
import { useAuthStore } from "@/stores/auth";
import { useSimuladorPlanPagoStore } from "@/stores/simuladorPlanPago";
import { useConvenioStore } from "@/stores/convenio";
import { useTipoPagoStore } from "@/stores/tipoPago";
import type { SimulacionPlanPagoRow } from "@/types/simuladorPlanPago";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const sim = useSimuladorPlanPagoStore();
const auth = useAuthStore();
const tipoPagoStore = useTipoPagoStore()
const convenioStore = useConvenioStore();
const {
  open,
  loadingCatalogos,
  loadingHistorial,
  saving,
  error,
  row,
  catalogos,
  form,
  resultado,
  historial,
} = storeToRefs(sim);

const fmtMonto = fmtMontoClp;

const nombreAlumno = computed(() => {
  if (!row.value) return "—";
  const p = [
    row.value.nombre_alumno,
    row.value.apellido_paterno_alumno,
    row.value.apellido_materno_alumno,
  ]
    .filter(Boolean)
    .join(" ");
  return p || row.value.nombre_alumno || "—";
});

const tiposPago = computed(() => tipoPagoStore.opciones)
const conveniosCatalogo = computed(() => convenioStore.opciones);

const beneficiosErp = computed(() => row.value?.beneficios_detalle ?? []);

function onOpenChange(v: boolean) {
  if (!v) sim.cerrar();
}

function patch<K extends keyof typeof form.value>(
  key: K,
  value: (typeof form.value)[K],
) {
  if (!form.value) return;
  sim.patchForm({ [key]: value } as Partial<typeof form.value>);
}

const pdfLoading = ref(false);
const pdfError = ref<string | null>(null);

async function guardar() {
  await sim.guardar(auth.email);
}

async function verBorradorPdf() {
  if (!row.value || !form.value || !resultado.value) return;
  pdfLoading.value = true;
  pdfError.value = null;
  try {
    const { error: err } = await previewAlumnoPdfBorrador({
      row: row.value,
      resultado: resultado.value,
      form: form.value,
      createdBy: auth.email,
    });
    if (err) pdfError.value = err;
  } finally {
    pdfLoading.value = false;
  }
}

async function descargarOficialPdf(h: SimulacionPlanPagoRow) {
  pdfLoading.value = true;
  pdfError.value = null;
  try {
    const { error: err } = await downloadAlumnoPdfOficial(h, row.value);
    if (err) pdfError.value = err;
  } finally {
    pdfLoading.value = false;
  }
}

watch(open, (v) => {
  if (v && form.value) sim.recalcular();
});
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      class="flex max-h-[95vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
    >
      <div
        class="sticky top-0 z-10 shrink-0 bg-uniacc-orange px-4 py-3 text-white"
      >
        <DialogHeader class="space-y-1 text-left text-white">
          <DialogTitle class="text-lg text-white">
            Simulador Plan de Pago
          </DialogTitle>
          <DialogDescription class="text-white/90">
            Precarga desde ERP · {{ row?.codcli ?? "—" }}
          </DialogDescription>
        </DialogHeader>
      </div>

      <div v-if="loadingCatalogos" class="flex items-center justify-center py-16">
        <Loader2 class="h-8 w-8 animate-spin text-zinc-400" />
      </div>

      <template v-else-if="row && form && catalogos">
        <div
          class="sticky top-[52px] z-10 shrink-0 border-b border-zinc-200 bg-white px-4 py-3"
        >
          <p class="text-lg font-bold uppercase text-zinc-900">
            {{ nombreAlumno }}
          </p>
          <div
            class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600"
          >
            <span
              ><strong>Cod. Carrera:</strong>
              {{ row.cod_carrera ?? "—" }}</span
            >
            <span
              ><strong>Carrera:</strong>
              {{ row.nombre_carrera ?? row.carrera ?? "—" }}</span
            >
            <span
              ><strong>Año ingreso:</strong> {{ row.ano_ingreso ?? "—" }}</span
            >
          </div>
          <div class="mt-2 flex flex-wrap gap-4 text-sm tabular-nums">
            <span
              ><strong>Matrícula:</strong>
              {{ fmtMonto(row.monto_matricula) }}</span
            >
            <span
              ><strong>Arancel:</strong>
              {{ fmtMonto(row.monto_arancel) }}</span
            >
            <label class="flex items-center gap-2">
              <Checkbox
                :checked="form.arancel_un_semestre"
                @update:checked="
                  (v) => patch('arancel_un_semestre', v === true)
                "
              />
              <span>Arancel un semestre</span>
            </label>
          </div>
          <p
            v-if="resultado?.errores.length"
            class="mt-2 text-xs text-red-600"
          >
            {{ resultado.errores.join(" · ") }}
          </p>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div
            v-if="error"
            class="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {{ error }}
          </div>

          <div class="grid gap-6 lg:grid-cols-2">
            <div class="space-y-4 text-sm">
              <div class="space-y-1">
                <Label for="validez">Validez propuesta</Label>
                <Input
                  id="validez"
                  type="date"
                  :model-value="form.validez_propuesta"
                  @update:model-value="
                    (v) => patch('validez_propuesta', String(v ?? ''))
                  "
                />
              </div>

              <div class="space-y-1">
                <Label>Tipo de pago matrícula</Label>
                <select
                  class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  :value="form.tipo_pago_matricula_id ?? ''"
                  @change="
                    patch(
                      'tipo_pago_matricula_id',
                      ($event.target as HTMLSelectElement).value || null,
                    )
                  "
                >
                  <option value="">Seleccionar</option>
                  <option
                    v-for="t in tiposPago"
                    :key="t.id"
                    :value="t.id"
                  >
                    {{ t.descripcion_tipo_pago }}
                  </option>
                </select>
              </div>

              <div class="space-y-1">
                <Label>Número de cuotas matrícula</Label>
                <Input
                  type="number"
                  min="1"
                  :max="12"
                  :model-value="form.n_cuotas_matricula"
                  @update:model-value="
                    (v) => patch('n_cuotas_matricula', Number(v) || 1)
                  "
                />
              </div>

              <div class="space-y-1">
                <Label>Tipo de pago arancel anual</Label>
                <select
                  class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  :value="form.tipo_pago_arancel_id ?? ''"
                  @change="
                    patch(
                      'tipo_pago_arancel_id',
                      ($event.target as HTMLSelectElement).value || null,
                    )
                  "
                >
                  <option value="">Seleccionar</option>
                  <option v-for="t in tiposPago" :key="t.id" :value="t.id">
                    {{ t.descripcion_tipo_pago }}
                  </option>
                </select>
              </div>

              <div class="space-y-1">
                <Label>Número de cuotas arancel</Label>
                <Input
                  type="number"
                  min="1"
                  :max="12"
                  :model-value="form.n_cuotas_arancel"
                  @update:model-value="
                    (v) => patch('n_cuotas_arancel', Number(v) || 1)
                  "
                />
              </div>

              <div class="space-y-1">
                <Label>Convenio</Label>
                <select
                  class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  :value="form.convenio_id ?? ''"
                  @change="
                    patch(
                      'convenio_id',
                      ($event.target as HTMLSelectElement).value || null,
                    )
                  "
                >
                  <option value="">Seleccionar</option>
                  <option
                    v-for="c in conveniosCatalogo"
                    :key="c.id"
                    :value="c.id"
                  >
                    {{ c.descripcion_convenio }}
                  </option>
                </select>
              </div>

              <div class="space-y-1">
                <Label>Beca estado</Label>
                <select
                  class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  :value="form.beca_estado_id ?? ''"
                  @change="
                    patch(
                      'beca_estado_id',
                      ($event.target as HTMLSelectElement).value || null,
                    )
                  "
                >
                  <option value="">Seleccionar</option>
                  <option
                    v-for="b in catalogos.becasEstado"
                    :key="b.id"
                    :value="b.id"
                  >
                    {{ b.nombre }}
                  </option>
                </select>
              </div>

              <div class="space-y-1">
                <Label>Beneficio adicional (ERP)</Label>
                <select
                  class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  :value="form.beneficio_adicional_codigo ?? ''"
                  @change="
                    patch(
                      'beneficio_adicional_codigo',
                      ($event.target as HTMLSelectElement).value || null,
                    )
                  "
                >
                  <option value="">Sin beneficio adicional</option>
                  <option
                    v-for="b in beneficiosErp"
                    :key="`${b.cod_beneficio}`"
                    :value="String(b.cod_beneficio ?? '')"
                  >
                    {{ b.descripcion ?? b.cod_beneficio }}
                  </option>
                </select>
              </div>

              <div class="space-y-1">
                <Label>% beneficio adicional (opcional)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  :model-value="form.beneficio_adicional_pct"
                  @update:model-value="
                    (v) => patch('beneficio_adicional_pct', Number(v) || 0)
                  "
                />
              </div>

              <div class="space-y-1">
                <Label>Abono resolución VRAF</Label>
                <Input
                  type="number"
                  min="0"
                  :model-value="form.abono_resolucion"
                  @update:model-value="
                    (v) => patch('abono_resolucion', Number(v) || 0)
                  "
                />
              </div>

              <div class="space-y-1">
                <Label>Abono contado arancel</Label>
                <Input
                  type="number"
                  min="0"
                  :model-value="form.abono_contado_arancel"
                  @update:model-value="
                    (v) => patch('abono_contado_arancel', Number(v) || 0)
                  "
                />
              </div>

              <div class="flex flex-wrap items-center gap-4">
                <label class="flex items-center gap-2">
                  <Checkbox
                    :checked="form.marca_cae"
                    @update:checked="(v) => patch('marca_cae', v === true)"
                  />
                  <span>Marcar con CAE</span>
                </label>
                <div v-if="form.marca_cae" class="flex-1 space-y-1">
                  <Label>Monto CAE</Label>
                  <Input
                    type="number"
                    min="0"
                    :model-value="form.monto_cae"
                    @update:model-value="
                      (v) => patch('monto_cae', Number(v) || 0)
                    "
                  />
                </div>
              </div>

              <div class="space-y-1">
                <Label>Descuento medio de pago (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  :model-value="form.descuento_medio_pago_pct"
                  @update:model-value="
                    (v) => patch('descuento_medio_pago_pct', Number(v) || 0)
                  "
                />
              </div>
            </div>

            <div
              v-if="resultado"
              class="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4"
            >
              <h3 class="mb-3 flex items-center gap-2 font-semibold text-zinc-800">
                <Calculator class="h-4 w-4" />
                Resultado simulación
              </h3>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <dt>Matrícula anual</dt>
                  <dd class="font-bold tabular-nums">
                    {{ fmtMonto(resultado.matricula.bruto) }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt>Arancel anual</dt>
                  <dd class="font-bold tabular-nums">
                    {{ fmtMonto(resultado.arancel.bruto) }}
                  </dd>
                </div>
                <div class="flex justify-between text-zinc-600">
                  <dt>Beneficio ERP matrícula</dt>
                  <dd class="tabular-nums text-emerald-700">
                    − {{ fmtMonto(resultado.matricula.beneficio_erp) }}
                  </dd>
                </div>
                <div class="flex justify-between text-zinc-600">
                  <dt>Beneficio ERP arancel</dt>
                  <dd class="tabular-nums text-emerald-700">
                    − {{ fmtMonto(resultado.arancel.beneficio_erp) }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt>Total beca estado</dt>
                  <dd class="tabular-nums">
                    {{ fmtMonto(resultado.totales.total_beca_estado) }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt>Total beca arancel</dt>
                  <dd>{{ resultado.totales.total_beca_arancel_pct }}%</dd>
                </div>
                <div class="flex justify-between">
                  <dt>Monto a financiar con becas</dt>
                  <dd class="font-medium tabular-nums">
                    {{ fmtMonto(resultado.totales.monto_financiar_becas) }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt>Monto a financiar con CAE</dt>
                  <dd class="tabular-nums">
                    {{ fmtMonto(resultado.totales.monto_financiar_cae) }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt>Abono contado arancel</dt>
                  <dd class="tabular-nums">
                    {{ fmtMonto(form.abono_contado_arancel) }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt>Monto arancel a financiar</dt>
                  <dd class="font-bold tabular-nums">
                    {{ fmtMonto(resultado.totales.monto_arancel_financiar) }}
                  </dd>
                </div>
                <div class="flex justify-between border-t pt-2">
                  <dt>Valor cuota matrícula</dt>
                  <dd class="font-semibold tabular-nums">
                    {{ fmtMonto(resultado.matricula.valor_cuota) }}
                    <span class="text-xs font-normal text-zinc-500">
                      ({{ resultado.matricula.n_cuotas }} cuotas)
                    </span>
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt>Valor cuota arancel</dt>
                  <dd class="font-semibold tabular-nums">
                    {{ fmtMonto(resultado.arancel.valor_cuota) }}
                    <span class="text-xs font-normal text-zinc-500">
                      ({{ resultado.arancel.n_cuotas }} cuotas)
                    </span>
                  </dd>
                </div>
                <div
                  class="flex justify-between rounded-md bg-zinc-200/60 px-2 py-2 font-bold"
                >
                  <dt>Monto neto a financiar</dt>
                  <dd class="tabular-nums">
                    {{ fmtMonto(resultado.totales.monto_neto_financiar) }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div v-if="historial.length" class="mt-6 border-t pt-4">
            <h4 class="mb-2 flex items-center gap-2 text-sm font-medium">
              <History class="h-4 w-4" />
              Historial guardado
              <Badge variant="secondary">{{ historial.length }}</Badge>
              <Loader2
                v-if="loadingHistorial"
                class="h-3 w-3 animate-spin"
              />
            </h4>
            <p v-if="pdfError" class="mb-2 text-xs text-red-600">{{ pdfError }}</p>
            <ul class="space-y-1 text-xs text-zinc-600">
              <li
                v-for="h in historial"
                :key="h.id"
                class="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-100 px-2 py-1.5"
              >
                <span>{{ new Date(h.created_at).toLocaleString("es-CL") }}</span>
                <div class="flex items-center gap-2">
                  <span class="tabular-nums font-medium">{{
                    fmtMonto(h.monto_neto_financiar)
                  }}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-7 gap-1 px-2 text-xs"
                    :disabled="pdfLoading"
                    @click="descargarOficialPdf(h)"
                  >
                    <FileDown class="h-3 w-3" />
                    PDF
                  </Button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div
          class="sticky bottom-0 flex shrink-0 flex-wrap justify-end gap-2 border-t bg-white px-4 py-3"
        >
          <Button variant="outline" @click="sim.cerrar()">Cerrar</Button>
          <Button
            variant="outline"
            class="gap-1"
            :disabled="!resultado || pdfLoading"
            @click="verBorradorPdf()"
          >
            <FileDown class="h-4 w-4" />
            Ver borrador PDF
          </Button>
          <Button
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="!sim.puedeGuardar || saving"
            @click="guardar()"
          >
            <Loader2 v-if="saving" class="mr-2 h-4 w-4 animate-spin" />
            Guardar
          </Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
