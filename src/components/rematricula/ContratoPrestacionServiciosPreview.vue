<script setup lang="ts">
import { computed } from 'vue'

import clausulasFixture from '@/assets/contrato/clausulas.json'
import type { ContratoMatriculaViewModel } from '@/types/contratoMatricula'

const props = defineProps<{
  model: ContratoMatriculaViewModel
}>()

function formatClp(n: number): string {
  return new Intl.NumberFormat('es-CL').format(Math.round(n))
}

function fill(template: string): string {
  const m = props.model
  const emailApSuffix =
    m.emailApoderado && m.emailApoderado !== '—'
      ? ` y/o ${m.emailApoderado}`
      : ''
  return template
    .replaceAll('{{representanteNombre}}', m.representante.nombre)
    .replaceAll('{{representanteRut}}', m.representante.rut)
    .replaceAll('{{sostenedorNombre}}', m.sostenedor.nombre)
    .replaceAll('{{sostenedorNacionalidad}}', m.sostenedor.nacionalidad)
    .replaceAll('{{sostenedorProfesion}}', m.sostenedor.profesion)
    .replaceAll('{{sostenedorEstadoCivil}}', m.sostenedor.estadoCivil)
    .replaceAll('{{sostenedorRut}}', m.sostenedor.rut)
    .replaceAll('{{sostenedorDomiciliado}}', m.sostenedor.domiciliadoLabel)
    .replaceAll('{{sostenedorDomicilio}}', m.sostenedor.domicilio)
    .replaceAll('{{sostenedorComuna}}', m.sostenedor.comuna)
    .replaceAll('{{emailAlumno}}', m.emailAlumno)
    .replaceAll('{{emailApoderadoSuffix}}', emailApSuffix)
}

const preambulo = computed(() => fill(clausulasFixture.preambuloIntro))

const cuotasMat = computed(() => props.model.cuotas.filter((c) => c.item === 1))
const cuotasAra = computed(() => props.model.cuotas.filter((c) => c.item === 2))
const descuentosMatricula = computed(() =>
  props.model.descuentos.filter((d) => d.concepto === 'matricula' && d.monto > 0),
)
const descuentosArancel = computed(() =>
  props.model.descuentos.filter((d) => d.concepto === 'arancel' && d.monto > 0),
)
const saldoPagareMatricula = computed(() =>
  cuotasMat.value.reduce((sum, c) => sum + (Number(c.valor) || 0), 0),
)
const saldoPagareArancel = computed(() =>
  cuotasAra.value.reduce((sum, c) => sum + (Number(c.valor) || 0), 0),
)
const documentoPagareMatricula = computed(
  () => cuotasMat.value.find((c) => c.ctapagnum)?.ctapagnum ?? '—',
)
const documentoPagareArancel = computed(
  () => cuotasAra.value.find((c) => c.ctapagnum)?.ctapagnum ?? '—',
)
const vencimientoPagareMatricula = computed(
  () => cuotasMat.value[cuotasMat.value.length - 1]?.fechaVencimiento ?? '—',
)
const vencimientoPagareArancel = computed(
  () => cuotasAra.value[cuotasAra.value.length - 1]?.fechaVencimiento ?? '—',
)
</script>

<template>
  <article
    class="contrato-preview space-y-4 bg-white p-4 text-[11px] leading-relaxed text-zinc-900 shadow-sm sm:p-6 sm:text-xs"
  >
    <header class="space-y-2 border-b border-zinc-200 pb-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <img
          src="/Logo/logoUniaccNew.svg"
          alt="UNIACC"
          class="h-10 w-auto sm:h-12"
        />
        <div class="text-right">
          <p class="font-semibold">N° {{ model.numOperacion }}</p>
          <p class="text-muted-foreground">{{ model.ciudadFirma }} de Chile, a {{ model.fechaContratoLabel }}</p>
        </div>
      </div>
      <h1 class="text-center text-sm font-bold uppercase tracking-wide sm:text-base">
        {{ clausulasFixture.titulo }}
      </h1>
    </header>

    <section class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1 rounded border border-zinc-200 p-3">
        <p class="text-[10px] font-semibold uppercase text-zinc-500">Nombre del estudiante o alumno</p>
        <p class="font-medium">{{ model.alumno.nombre }}</p>
        <p class="text-[10px] font-semibold uppercase text-zinc-500">Cédula de Identidad N°</p>
        <p>{{ model.alumno.rut }}</p>
        <p class="text-[10px] font-semibold uppercase text-zinc-500">Domicilio del estudiante o alumno</p>
        <p>{{ model.alumno.domicilio }}</p>
      </div>
      <div class="space-y-1 rounded border border-zinc-200 p-3">
        <p class="text-[10px] font-semibold uppercase text-zinc-500">Carrera o Programa Académico</p>
        <p class="font-medium">{{ model.alumno.carrera }}</p>
        <p class="text-[10px] font-semibold uppercase text-zinc-500">Jornada</p>
        <p>{{ model.alumno.jornada }}</p>
        <p class="text-[10px] font-semibold uppercase text-zinc-500">Periodo Académico</p>
        <p>{{ model.periodoAcademico }}</p>
      </div>
      <div class="space-y-1 rounded border border-zinc-200 p-3 sm:col-span-2">
        <p class="text-[10px] font-semibold uppercase text-zinc-500">Nombre del Sostenedor</p>
        <p class="font-medium">{{ model.sostenedor.nombre }}</p>
        <div class="mt-1 grid gap-2 sm:grid-cols-2">
          <div>
            <p class="text-[10px] font-semibold uppercase text-zinc-500">Cédula de Identidad N°</p>
            <p>{{ model.sostenedor.rut }}</p>
          </div>
          <div>
            <p class="text-[10px] font-semibold uppercase text-zinc-500">Domicilio del sostenedor financiero</p>
            <p>{{ model.sostenedor.domicilio }}</p>
          </div>
        </div>
      </div>
    </section>

    <p class="text-justify">{{ preambulo }}</p>

    <section class="space-y-2">
      <h2 class="font-bold">{{ clausulasFixture.definiciones.titulo }}</h2>
      <p>{{ clausulasFixture.definiciones.intro }}</p>
      <div
        v-for="(item, i) in clausulasFixture.definiciones.items"
        :key="i"
        class="text-justify"
      >
        <span class="font-semibold">{{ item.label }}: </span>{{ item.text }}
      </div>
    </section>

    <p class="text-justify">{{ clausulasFixture.reglamentos }}</p>

    <section
      v-for="cl in clausulasFixture.clausulas"
      :key="cl.id"
      class="space-y-2"
    >
      <h2 class="font-bold">{{ cl.titulo }}</h2>
      <template v-for="(p, idx) in cl.parrafos" :key="idx">
        <div
          v-if="p === '__PLAN_PAGO__'"
          class="space-y-3 rounded border border-zinc-300 bg-zinc-50 p-3"
        >
          <div class="flex flex-wrap gap-6 font-semibold">
            <span>valor matrícula {{ formatClp(model.valorMatricula) }}</span>
            <span>valor arancel {{ formatClp(model.valorArancel) }}</span>
          </div>
          <div v-if="descuentosMatricula.length" class="overflow-x-auto">
            <p class="mb-1 font-semibold">Matrícula — Descuentos</p>
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-zinc-300">
                  <th class="py-1 pr-2">Documento</th>
                  <th class="py-1 pr-2">Tipo de documento</th>
                  <th class="py-1 pr-2">Valor</th>
                  <th class="py-1">Fecha de vencimiento</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(d, i) in descuentosMatricula"
                  :key="'dm-' + i"
                  class="border-b border-zinc-200"
                >
                  <td class="py-1 pr-2 font-mono text-[10px]">{{ d.documento }}</td>
                  <td class="py-1 pr-2">{{ d.tipoDocumento }}</td>
                  <td class="py-1 pr-2">{{ formatClp(d.monto) }}</td>
                  <td class="py-1">{{ d.vencimiento }}</td>
                </tr>
                <tr v-if="saldoPagareMatricula > 0" class="border-b border-zinc-200 font-semibold">
                  <td class="py-1 pr-2 font-mono text-[10px]">{{ documentoPagareMatricula }}</td>
                  <td class="py-1 pr-2">PAGARÉ</td>
                  <td class="py-1 pr-2">{{ formatClp(saldoPagareMatricula) }}</td>
                  <td class="py-1">{{ vencimientoPagareMatricula }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="cuotasMat.length" class="overflow-x-auto">
            <p class="mb-1 font-semibold">Matrícula — Plan de pago</p>
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-zinc-300">
                  <th class="py-1 pr-2">Documento</th>
                  <th class="py-1 pr-2">Tipo</th>
                  <th class="py-1 pr-2">Valor</th>
                  <th class="py-1">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(c, i) in cuotasMat" :key="'m-' + i" class="border-b border-zinc-200">
                  <td class="py-1 pr-2 font-mono text-[10px]">{{ c.documento }}</td>
                  <td class="py-1 pr-2">{{ c.tipoDocumento }} {{ c.cuota }}/{{ c.totalCuotas }}</td>
                  <td class="py-1 pr-2">{{ formatClp(c.valor) }}</td>
                  <td class="py-1">{{ c.fechaVencimiento }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="descuentosArancel.length" class="overflow-x-auto">
            <p class="mb-1 font-semibold">Arancel — Descuentos</p>
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-zinc-300">
                  <th class="py-1 pr-2">Documento</th>
                  <th class="py-1 pr-2">Tipo de documento</th>
                  <th class="py-1 pr-2">Valor</th>
                  <th class="py-1">Fecha de vencimiento</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(d, i) in descuentosArancel"
                  :key="'d-' + i"
                  class="border-b border-zinc-200"
                >
                  <td class="py-1 pr-2 font-mono text-[10px]">{{ d.documento }}</td>
                  <td class="py-1 pr-2">{{ d.tipoDocumento }}</td>
                  <td class="py-1 pr-2">{{ formatClp(d.monto) }}</td>
                  <td class="py-1">{{ d.vencimiento }}</td>
                </tr>
                <tr v-if="saldoPagareArancel > 0" class="border-b border-zinc-200 font-semibold">
                  <td class="py-1 pr-2 font-mono text-[10px]">{{ documentoPagareArancel }}</td>
                  <td class="py-1 pr-2">PAGARÉ</td>
                  <td class="py-1 pr-2">{{ formatClp(saldoPagareArancel) }}</td>
                  <td class="py-1">{{ vencimientoPagareArancel }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="cuotasAra.length" class="overflow-x-auto">
            <p class="mb-1 font-semibold">Arancel — Plan de pago</p>
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-zinc-300">
                  <th class="py-1 pr-2">Documento</th>
                  <th class="py-1 pr-2">Tipo</th>
                  <th class="py-1 pr-2">Valor</th>
                  <th class="py-1">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(c, i) in cuotasAra" :key="'a-' + i" class="border-b border-zinc-200">
                  <td class="py-1 pr-2 font-mono text-[10px]">{{ c.documento }}</td>
                  <td class="py-1 pr-2">{{ c.tipoDocumento }} {{ c.cuota }}/{{ c.totalCuotas }}</td>
                  <td class="py-1 pr-2">{{ formatClp(c.valor) }}</td>
                  <td class="py-1">{{ c.fechaVencimiento }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!model.cuotas.length" class="text-muted-foreground">
            Sin detalle de cuotas (medio {{ model.contrato }}).
          </p>
        </div>
        <p v-else class="text-justify">{{ fill(p) }}</p>
      </template>
    </section>

    <section class="grid gap-8 border-t border-zinc-200 pt-6 sm:grid-cols-3">
      <div class="text-center">
        <div class="mb-8 border-b border-zinc-400" />
        <p class="font-semibold">Estudiante o Alumno</p>
        <p class="text-[10px]">{{ model.alumno.nombre }}</p>
      </div>
      <div class="text-center">
        <div class="mb-8 border-b border-zinc-400" />
        <p class="font-semibold">pp. {{ clausulasFixture.institucion.nombre }}</p>
      </div>
      <div class="text-center">
        <div class="mb-8 border-b border-zinc-400" />
        <p class="font-semibold">Sostenedor Financiero</p>
        <p class="text-[10px]">{{ model.sostenedor.nombre }}</p>
      </div>
    </section>

    <section class="space-y-2 border-t border-zinc-200 pt-4">
      <h2 class="text-center font-bold">{{ clausulasFixture.anexo.titulo }}</h2>
      <h3 class="text-center font-semibold">{{ clausulasFixture.anexo.subtitulo }}</h3>
      <p class="text-center text-[10px]">{{ clausulasFixture.anexo.url }}</p>
      <div v-for="(sec, i) in clausulasFixture.anexo.secciones" :key="i" class="space-y-1">
        <p class="font-semibold">{{ sec.titulo }}</p>
        <ol class="list-decimal space-y-0.5 pl-5">
          <li v-for="(item, j) in sec.items" :key="j">{{ item }}</li>
        </ol>
      </div>
      <p class="font-semibold">Importante: {{ clausulasFixture.anexo.importante }}</p>
    </section>

    <p class="pt-2 text-center text-[10px] text-zinc-500">{{ clausulasFixture.piePagina }}</p>
  </article>
</template>
