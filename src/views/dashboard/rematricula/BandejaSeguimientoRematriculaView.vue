<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { MessageCircle, MessageSquare, Pencil, Phone } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import {
  fetchSeguimientoBandeja,
  fetchSeguimientoCaso,
  fetchSeguimientoKpi,
  postSeguimientoContacto,
  type ContactoSeguimiento,
  type FilaBandejaSeguimiento,
  type KpiBandejaSeguimiento,
  type SubetapaFormaPago,
} from '@/services/seguimientoRematriculaApi'
import {
  colorEtapaChip,
  ETIQUETA_CHIP_BANDEJA,
  etiquetaSubetapaFormaPago,
  numeroChipBandeja,
  ORDEN_CHIPS_BANDEJA,
  type ChipBandeja,
} from '@/utils/seguimientoBandejaChip'
import { etiquetaOutboxUi } from '@/utils/seguimientoBandejaOutbox'
import { alcanceCartera } from '@/utils/alcanceCarteraEjecutivo'
import { refreshProgresoRematricula } from '@/services/progresoRematriculaApi'
import { toast } from 'vue-sonner'

/** Sentinel Select (Radix no acepta ''); maps to filtroEjecutivo === '' = Ver todas. */
const SELECT_TODAS = '__todas__'

const auth = useAuthStore()
const periodoActivo = usePeriodoActivoStore()

const alcance = computed(() =>
  alcanceCartera(auth.perfil?.codigo_perfil_usuario ?? null, auth.email),
)
const esSupervisor = computed(() => alcance.value.tipo === 'completo')

const kpi = ref<KpiBandejaSeguimiento | null>(null)
const filas = ref<FilaBandejaSeguimiento[]>([])
const total = ref(0)
const cargando = ref(false)
const error = ref<string | null>(null)

const chipActivo = ref<ChipBandeja | null>(null)
const subetapa = ref<SubetapaFormaPago>(null)
const q = ref('')
const page = ref(0)
const pageSize = 25
/** Supervisor: '' = Ver todas (sin override API); email = acota cartera. Sin modo «mía» aquí. */
const filtroEjecutivo = ref('')

const casoAbierto = ref<FilaBandejaSeguimiento | null>(null)
const bitacora = ref<ContactoSeguimiento[]>([])
const dialogContacto = ref(false)
const canalContacto = ref('llamada')
const notaContacto = ref('')
const proximaAccion = ref('')
const guardandoContacto = ref(false)

const periodoOk = computed(
  () => periodoActivo.anio != null && periodoActivo.semestre != null,
)

const ejecutivosEnCarga = computed(() => {
  const set = new Set<string>()
  for (const f of filas.value) {
    const e = f.email_ejecutivo?.trim().toLowerCase()
    if (e) set.add(e)
  }
  return [...set].sort()
})

/** Bind Select ↔ filtroEjecutivo ('' = Ver todas). */
const filtroEjecutivoSelect = computed({
  get: () => (filtroEjecutivo.value.trim() ? filtroEjecutivo.value.trim().toLowerCase() : SELECT_TODAS),
  set: (v: string) => {
    filtroEjecutivo.value = !v || v === SELECT_TODAS ? '' : v
    page.value = 0
  },
})

function conteoChip(chip: ChipBandeja): number {
  if (!kpi.value) return 0
  if (chip === 'forma_pago') return kpi.value.forma_pago
  if (chip === 'contrato_pdte') return kpi.value.contrato_pdte
  if (chip === 'firmado_pdte_u') return kpi.value.firmado_pdte_u
  return Number(kpi.value[chip] ?? 0)
}

async function cargar(): Promise<void> {
  if (!periodoOk.value) return
  cargando.value = true
  error.value = null
  try {
    const anio = periodoActivo.anio!
    const semestre = periodoActivo.semestre!
    const emailOverride =
      esSupervisor.value && filtroEjecutivo.value.trim()
        ? filtroEjecutivo.value.trim()
        : null

    const { error: refreshError } = await refreshProgresoRematricula(anio, semestre)
    if (refreshError) {
      toast.warning(`Progreso no refrescado: ${refreshError}. Los datos pueden estar desactualizados.`)
    }

    const kpiRes = await fetchSeguimientoKpi(anio, semestre, emailOverride)
    if (kpiRes.error) {
      error.value = kpiRes.error
      return
    }
    kpi.value = kpiRes.data

    const list = await fetchSeguimientoBandeja({
      anio,
      semestre,
      chip: chipActivo.value,
      subetapa: chipActivo.value === 'forma_pago' ? subetapa.value : null,
      q: q.value,
      limit: pageSize,
      offset: page.value * pageSize,
      emailEjecutivoOverride: emailOverride,
    })
    if (list.error) {
      error.value = list.error
      return
    }
    filas.value = list.data
    total.value = list.total
  } finally {
    cargando.value = false
  }
}

watch(
  () =>
    [
      periodoActivo.anio,
      periodoActivo.semestre,
      chipActivo.value,
      subetapa.value,
      page.value,
      filtroEjecutivo.value,
    ] as const,
  () => {
    void cargar()
  },
  { immediate: true },
)

function seleccionarChip(chip: ChipBandeja): void {
  chipActivo.value = chipActivo.value === chip ? null : chip
  if (chipActivo.value !== 'forma_pago') subetapa.value = null
  page.value = 0
}

function cerrarCaso(): void {
  casoAbierto.value = null
}

function onKeydownEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape' && casoAbierto.value && !dialogContacto.value) {
    cerrarCaso()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydownEscape))
onUnmounted(() => window.removeEventListener('keydown', onKeydownEscape))

async function abrirCaso(fila: FilaBandejaSeguimiento): Promise<void> {
  if (!periodoOk.value) return
  const r = await fetchSeguimientoCaso(
    fila.codcli,
    periodoActivo.anio!,
    periodoActivo.semestre!,
  )
  if (r.error) {
    error.value = r.error
    return
  }
  casoAbierto.value = r.caso
  bitacora.value = r.bitacora
}

function iconoCanal(canal: string): Component {
  const c = canal.trim().toLowerCase()
  if (c === 'llamada' || c === 'telefono' || c === 'teléfono' || c === 'presencial') return Phone
  if (c === 'sms') return MessageSquare
  if (c === 'whatsapp') return MessageCircle
  return Pencil
}

async function guardarContacto(): Promise<void> {
  if (!casoAbierto.value || !periodoOk.value) return
  guardandoContacto.value = true
  try {
    const r = await postSeguimientoContacto(casoAbierto.value.codcli, {
      anio: periodoActivo.anio!,
      semestre: periodoActivo.semestre!,
      canal: canalContacto.value,
      nota: notaContacto.value.trim() || null,
      proxima_accion: proximaAccion.value.trim() || null,
    })
    if (r.error) {
      error.value = r.error
      return
    }
    dialogContacto.value = false
    notaContacto.value = ''
    proximaAccion.value = ''
    canalContacto.value = 'llamada'
    await abrirCaso(casoAbierto.value)
    await cargar()
  } finally {
    guardandoContacto.value = false
  }
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="space-y-6 p-4 md:p-6">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-[#1E3A5F]">Seguimiento rematrícula</h1>
        <p class="text-sm text-zinc-600">
          Periodo {{ periodoActivo.label ?? '—' }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="!esSupervisor"
          class="rounded-full bg-[#1E3A5F] px-3 py-1 text-xs font-medium text-white"
        >
          Cartera: mía ({{ alcance.email ?? auth.email ?? '—' }})
        </span>
        <template v-else>
          <span class="rounded-full bg-[#1E3A5F] px-3 py-1 text-xs font-medium text-white">
            {{
              filtroEjecutivo
                ? `Cartera: ${filtroEjecutivo}`
                : 'Cartera: Ver todas'
            }}
          </span>
          <Select v-model="filtroEjecutivoSelect">
            <SelectTrigger class="w-64 cursor-pointer">
              <SelectValue placeholder="Ver todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="SELECT_TODAS">Ver todas</SelectItem>
              <SelectItem v-for="em in ejecutivosEnCarga" :key="em" :value="em">
                {{ em }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="text-xs text-zinc-500">Ejecutivos en la carga actual</span>
        </template>
      </div>
    </header>

    <p v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {{ error }}
    </p>

    <section class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <button
        v-for="chip in ORDEN_CHIPS_BANDEJA"
        :key="chip"
        type="button"
        class="cursor-pointer rounded-xl border bg-white px-3 py-3 text-left shadow-sm transition hover:border-[#FF5B00]/50"
        :class="
          chipActivo === chip
            ? 'border-[#FF5B00] ring-2 ring-[#FF5B00]/30'
            : 'border-[#1E3A5F]/20'
        "
        @click="seleccionarChip(chip)"
      >
        <div class="text-xs font-medium text-zinc-500">
          {{ numeroChipBandeja(chip) }}. {{ ETIQUETA_CHIP_BANDEJA[chip] }}
        </div>
        <div class="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
          {{ conteoChip(chip) }}
        </div>
      </button>
    </section>

    <div
      v-if="chipActivo === 'forma_pago' && kpi"
      class="flex flex-wrap gap-2"
    >
      <Button
        v-for="s in [
          { id: null, label: `Todas ${kpi.forma_pago}` },
          { id: 'cae', label: `CAE ${kpi.forma_pago_cae}` },
          { id: 'ministerial', label: `Beneficio min. ${kpi.forma_pago_ministerial}` },
          { id: 'ambos', label: `Ambos ${kpi.forma_pago_ambos}` },
          { id: 'resto', label: `Resto ${kpi.forma_pago_resto}` },
        ] as const"
        :key="String(s.id)"
        type="button"
        size="sm"
        variant="outline"
        class="cursor-pointer rounded-full"
        :class="subetapa === s.id ? 'border-[#FF5B00] bg-orange-50' : ''"
        @click=";(subetapa = s.id as SubetapaFormaPago), (page = 0)"
      >
        {{ s.label }}
      </Button>
    </div>

    <div v-if="kpi" class="flex flex-wrap gap-2 text-sm">
      <span class="rounded-full border border-orange-200 bg-orange-50 px-3 py-1">
        Sin contactar +7d —
      </span>
      <span class="rounded-full border border-zinc-200 bg-white px-3 py-1">
        Mail 2h pdte {{ kpi.mail_2h_pdte }}
      </span>
      <span class="rounded-full border border-zinc-200 bg-white px-3 py-1">
        Mail 2h enviado {{ kpi.mail_2h_enviado }}
      </span>
      <span class="rounded-full border border-zinc-200 bg-white px-3 py-1">
        SMS 24h pdte {{ kpi.sms_24h_pdte }}
      </span>
      <span class="rounded-full border border-zinc-200 bg-white px-3 py-1">
        SMS 24h enviado {{ kpi.sms_24h_enviado }}
      </span>
    </div>

    <div class="flex flex-wrap gap-2">
      <Input
        v-model="q"
        placeholder="Buscar nombre / RUT"
        class="max-w-sm"
        @keyup.enter="page = 0; cargar()"
      />
      <Button type="button" class="cursor-pointer rounded-full bg-[#FF5B00] hover:bg-[#FF5B00]/90" @click="page = 0; cargar()">
        Buscar
      </Button>
      <Button type="button" variant="outline" class="cursor-pointer rounded-full" :disabled="cargando" @click="cargar()">
        {{ cargando ? 'Cargando…' : 'Actualizar' }}
      </Button>
    </div>

    <div class="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table class="min-w-full text-left text-sm">
        <thead class="border-b bg-slate-50 text-xs uppercase text-zinc-500">
          <tr>
            <th class="px-3 py-2">Alumno</th>
            <th class="px-3 py-2">Carrera</th>
            <th class="px-3 py-2">Etapa</th>
            <th class="px-3 py-2">Subetapa</th>
            <th class="px-3 py-2">Mat. Webpay</th>
            <th class="px-3 py-2">Mail 2h</th>
            <th class="px-3 py-2">SMS 24h</th>
            <th class="px-3 py-2">Último contacto</th>
            <th class="px-3 py-2">Próxima acción</th>
            <th class="px-3 py-2">Ejecutivo</th>
            <th class="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="fila in filas"
            :key="fila.codcli"
            class="border-b last:border-0 hover:bg-orange-50/40"
          >
            <td class="px-3 py-2">
              <div class="font-medium text-zinc-900">{{ fila.nombre_alumno ?? '—' }}</div>
              <div class="text-xs text-zinc-500">{{ fila.rut ?? fila.codcli }}</div>
            </td>
            <td class="px-3 py-2">{{ fila.nombre_carrera ?? '—' }}</td>
            <td class="px-3 py-2">
              <span
                class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold"
                :class="[
                  colorEtapaChip(fila.chip).bg,
                  colorEtapaChip(fila.chip).text,
                  colorEtapaChip(fila.chip).border,
                ]"
              >
                {{ ETIQUETA_CHIP_BANDEJA[fila.chip] }}
              </span>
            </td>
            <td class="px-3 py-2">{{ etiquetaSubetapaFormaPago(fila.subetapa_forma_pago) }}</td>
            <td class="px-3 py-2">
              {{ fila.mat_webpay_fecha ? `Sí ${fmtFecha(fila.mat_webpay_fecha)}` : '—' }}
            </td>
            <td class="px-3 py-2">{{ etiquetaOutboxUi(fila.mail_2h, fila.mail_2h_sent_at) }}</td>
            <td class="px-3 py-2">{{ etiquetaOutboxUi(fila.sms_24h, fila.sms_24h_sent_at) }}</td>
            <td class="px-3 py-2">
              <template v-if="fila.ultimo_contacto">
                {{ fila.ultimo_contacto_canal }} · {{ fmtFecha(fila.ultimo_contacto) }}
              </template>
              <template v-else>—</template>
            </td>
            <td class="px-3 py-2">{{ fila.proxima_accion ?? '—' }}</td>
            <td class="px-3 py-2 text-xs">{{ fila.email_ejecutivo ?? '—' }}</td>
            <td class="px-3 py-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                class="cursor-pointer rounded-full"
                @click="abrirCaso(fila)"
              >
                Abrir
              </Button>
            </td>
          </tr>
          <tr v-if="!cargando && filas.length === 0">
            <td colspan="11" class="px-3 py-8 text-center text-zinc-500">Sin filas</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between gap-2 text-sm">
      <span class="text-zinc-500">{{ total }} resultados</span>
      <div class="flex gap-2">
        <Button
          type="button"
          variant="outline"
          class="cursor-pointer rounded-full"
          :disabled="page === 0"
          @click="page -= 1"
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          class="cursor-pointer rounded-full"
          :disabled="(page + 1) * pageSize >= total"
          @click="page += 1"
        >
          Siguiente
        </Button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="casoAbierto"
        class="fixed inset-0 z-50 bg-black/40"
        aria-hidden="true"
        @click="cerrarCaso()"
      />
      <aside
        v-if="casoAbierto"
        class="fixed inset-y-0 right-0 z-[51] w-full max-w-md overflow-y-auto border-l bg-white p-5 shadow-xl"
      >
      <div class="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 class="text-lg font-bold text-zinc-900">{{ casoAbierto.nombre_alumno }}</h2>
          <p class="text-sm text-zinc-500">{{ casoAbierto.rut }} · {{ casoAbierto.codcli }}</p>
          <div class="mt-2 flex flex-wrap gap-1">
            <span
              class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold"
              :class="[
                colorEtapaChip(casoAbierto.chip).bg,
                colorEtapaChip(casoAbierto.chip).text,
                colorEtapaChip(casoAbierto.chip).border,
              ]"
            >
              {{ ETIQUETA_CHIP_BANDEJA[casoAbierto.chip] }}
            </span>
            <span
              v-if="casoAbierto.subetapa_forma_pago"
              class="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700"
            >
              {{ etiquetaSubetapaFormaPago(casoAbierto.subetapa_forma_pago) }}
            </span>
          </div>
        </div>
        <Button type="button" variant="ghost" class="cursor-pointer" @click="cerrarCaso()">
          Cerrar
        </Button>
      </div>

      <div class="space-y-2 text-sm">
        <p><span class="font-semibold">Email:</span> —</p>
        <p><span class="font-semibold">Teléfono:</span> —</p>
        <p><span class="font-semibold">Firmantes:</span> —</p>
        <p><span class="font-semibold">Carrera:</span> {{ casoAbierto.nombre_carrera ?? '—' }}</p>
        <p><span class="font-semibold">Ejecutivo:</span> {{ casoAbierto.email_ejecutivo ?? '—' }}</p>
        <p>
          <span class="font-semibold">Mat. Webpay:</span>
          {{ casoAbierto.mat_webpay_fecha ? `Sí ${fmtFecha(casoAbierto.mat_webpay_fecha)}` : '—' }}
        </p>
      </div>

      <div class="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
        <p class="font-semibold text-[#FF5B00]">Retención automática</p>
        <p>Correo 2h: {{ etiquetaOutboxUi(casoAbierto.mail_2h, casoAbierto.mail_2h_sent_at) }}</p>
        <p>SMS 24h: {{ etiquetaOutboxUi(casoAbierto.sms_24h, casoAbierto.sms_24h_sent_at) }}</p>
        <p
          v-if="casoAbierto.mail_2h === 'n/a' && casoAbierto.sms_24h === 'n/a'"
          class="mt-2 text-xs text-zinc-600"
        >
          No aplica: sin matrícula Webpay o firma ya completa
        </p>
      </div>

      <div class="mt-4 flex flex-col gap-2">
        <Button type="button" disabled class="rounded-full bg-[#FF5B00]/40">Enviar correo · corte 2</Button>
        <Button type="button" disabled variant="outline" class="rounded-full">Enviar SMS · corte 2</Button>
        <Button type="button" disabled variant="outline" class="rounded-full">WhatsApp · próximamente</Button>
        <Button
          type="button"
          class="cursor-pointer rounded-full bg-[#FF5B00] hover:bg-[#FF5B00]/90"
          @click="dialogContacto = true"
        >
          Agregar contacto
        </Button>
      </div>

      <div class="mt-6">
        <h3 class="mb-2 font-semibold text-zinc-900">Bitácora</h3>
        <ul class="space-y-3 text-sm">
          <li
            v-for="ev in bitacora"
            :key="ev.id"
            class="rounded-lg border border-zinc-100 bg-slate-50 px-3 py-2"
          >
            <div class="flex items-center gap-2 font-medium text-zinc-800">
              <component :is="iconoCanal(ev.canal)" class="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
              <span>{{ ev.canal }} · {{ ev.autor_email }}</span>
            </div>
            <div class="text-xs text-zinc-500">{{ fmtFecha(ev.created_at) }}</div>
            <p v-if="ev.nota" class="mt-1 text-zinc-700">{{ ev.nota }}</p>
          </li>
          <li v-if="bitacora.length === 0" class="text-zinc-500">Sin contactos aún</li>
        </ul>
      </div>
      </aside>
    </Teleport>

    <Dialog :open="dialogContacto" @update:open="(v) => (dialogContacto = v)">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar contacto</DialogTitle>
        </DialogHeader>
        <div class="space-y-3">
          <div>
            <Label>Canal</Label>
            <Select v-model="canalContacto">
              <SelectTrigger class="mt-1 w-full">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="llamada">Llamada</SelectItem>
                <SelectItem value="correo">Correo</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="nota">Nota</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nota</Label>
            <Textarea v-model="notaContacto" class="mt-1" rows="4" />
          </div>
          <div>
            <Label>Próxima acción (opcional)</Label>
            <Input v-model="proximaAccion" class="mt-1" />
          </div>
        </div>
        <DialogFooter class="gap-2">
          <Button type="button" variant="outline" class="cursor-pointer" @click="dialogContacto = false">
            Cancelar
          </Button>
          <Button
            type="button"
            class="cursor-pointer bg-[#FF5B00] hover:bg-[#FF5B00]/90"
            :disabled="guardandoContacto"
            @click="guardarContacto"
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
