<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
import SeguimientoFiltrosSidebar from '@/components/seguimiento/SeguimientoFiltrosSidebar.vue'
import SeguimientoListaTabla from '@/components/seguimiento/SeguimientoListaTabla.vue'
import SeguimientoBoard from '@/components/seguimiento/SeguimientoBoard.vue'
import SeguimientoCasoDrawer from '@/components/seguimiento/SeguimientoCasoDrawer.vue'
import { useAuthStore } from '@/stores/auth'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import {
  fetchSeguimientoBandeja,
  fetchSeguimientoBoard,
  fetchSeguimientoCaso,
  fetchSeguimientoKpi,
  postSeguimientoContacto,
  type CasoSeguimientoDetalle,
  type ColumnaBoardSeguimiento,
  type ContactoSeguimiento,
  type FilaBandejaSeguimiento,
  type FiltroAuxSeguimiento,
  type KpiBandejaSeguimiento,
  type SubetapaFormaPago,
} from '@/services/seguimientoRematriculaApi'
import { type ChipBandeja } from '@/utils/seguimientoBandejaChip'
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
const columnasBoard = ref<ColumnaBoardSeguimiento[]>([])
const total = ref(0)
const cargando = ref(false)
const error = ref<string | null>(null)

const chipActivo = ref<ChipBandeja | null>(null)
const subetapa = ref<SubetapaFormaPago>(null)
const filtroAux = ref<FiltroAuxSeguimiento | null>(null)
const q = ref('')
const page = ref(0)
const pageSize = 25
/** Supervisor: '' = Ver todas (sin override API); email = acota cartera. */
const filtroEjecutivo = ref('')

type VistaCrm = 'lista' | 'board'
const vista = ref<VistaCrm>('lista')

const casoAbierto = ref<CasoSeguimientoDetalle | null>(null)
const bitacora = ref<ContactoSeguimiento[]>([])
const dialogContacto = ref(false)
const canalContacto = ref('nota')
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

const filtroEjecutivoSelect = computed({
  get: () =>
    filtroEjecutivo.value.trim()
      ? filtroEjecutivo.value.trim().toLowerCase()
      : SELECT_TODAS,
  set: (v: string) => {
    filtroEjecutivo.value = !v || v === SELECT_TODAS ? '' : v
    page.value = 0
  },
})

const carteraLabel = computed(() => {
  if (!esSupervisor.value) {
    return `Mía (${alcance.value.email ?? auth.email ?? '—'})`
  }
  if (filtroEjecutivo.value.trim()) return filtroEjecutivo.value.trim()
  return 'Ver todas'
})

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
      toast.warning(
        `Progreso no refrescado: ${refreshError}. Los datos pueden estar desactualizados.`,
      )
    }

    const kpiRes = await fetchSeguimientoKpi(anio, semestre, emailOverride)
    if (kpiRes.error) {
      error.value = kpiRes.error
      return
    }
    kpi.value = kpiRes.data

    if (vista.value === 'board') {
      const board = await fetchSeguimientoBoard({
        anio,
        semestre,
        q: q.value,
        filtroAux: filtroAux.value,
        emailEjecutivoOverride: emailOverride,
      })
      if (board.error) {
        error.value = board.error
        return
      }
      columnasBoard.value = board.columnas
    } else {
      const list = await fetchSeguimientoBandeja({
        anio,
        semestre,
        chip: chipActivo.value,
        subetapa: chipActivo.value === 'forma_pago' ? subetapa.value : null,
        q: q.value,
        filtroAux: filtroAux.value,
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
    }
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
      vista.value,
      filtroAux.value,
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

function seleccionarAlerta(alerta: FiltroAuxSeguimiento): void {
  // Filtrado real en Task 4; UI preparada (toggle visual + param en API).
  filtroAux.value = filtroAux.value === alerta ? null : alerta
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
    canalContacto.value = 'nota'
    await abrirCaso(casoAbierto.value)
    await cargar()
  } finally {
    guardandoContacto.value = false
  }
}

function setVista(v: VistaCrm): void {
  vista.value = v
}
</script>

<template>
  <div class="flex h-full min-h-[calc(100vh-4rem)] flex-col bg-slate-50">
    <header
      class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 md:px-6"
    >
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-[#1E3A5F]">Seguimiento rematrícula</h1>
        <p class="text-xs text-zinc-500">
          CRM · Periodo {{ periodoActivo.label ?? '—' }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <template v-if="esSupervisor">
          <Select v-model="filtroEjecutivoSelect">
            <SelectTrigger class="w-56 cursor-pointer">
              <SelectValue placeholder="Ver todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="SELECT_TODAS">Ver todas</SelectItem>
              <SelectItem v-for="em in ejecutivosEnCarga" :key="em" :value="em">
                {{ em }}
              </SelectItem>
            </SelectContent>
          </Select>
        </template>

        <Input
          v-model="q"
          placeholder="Buscar nombre / RUT"
          class="w-48 md:w-56"
          @keyup.enter="page = 0; cargar()"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="cursor-pointer rounded-full"
          :disabled="cargando"
          @click="page = 0; cargar()"
        >
          {{ cargando ? 'Cargando…' : 'Actualizar' }}
        </Button>

        <div class="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-0.5">
          <button
            type="button"
            class="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition"
            :class="
              vista === 'lista'
                ? 'bg-[#FF5B00] text-white'
                : 'text-zinc-600 hover:text-[#1E3A5F]'
            "
            @click="setVista('lista')"
          >
            Lista
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition"
            :class="
              vista === 'board'
                ? 'bg-[#FF5B00] text-white'
                : 'text-zinc-600 hover:text-[#1E3A5F]'
            "
            @click="setVista('board')"
          >
            Board
          </button>
        </div>
      </div>
    </header>

    <p
      v-if="error"
      class="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 md:mx-6"
    >
      {{ error }}
    </p>

    <div class="flex min-h-0 flex-1">
      <SeguimientoFiltrosSidebar
        :kpi="kpi"
        :chip-activo="chipActivo"
        :filtro-aux="filtroAux"
        :es-supervisor="esSupervisor"
        :cartera-label="carteraLabel"
        @seleccionar-chip="seleccionarChip"
        @seleccionar-alerta="seleccionarAlerta"
      />

      <main class="min-w-0 flex-1 p-4 md:p-5">
        <div v-if="filtroAux" class="mb-3 flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center gap-2 rounded-full border border-[#FF5B00]/40 bg-orange-50 px-3 py-1 text-xs font-medium text-[#FF5B00]"
          >
            Alerta:
            {{
              filtroAux === 'sin_contactar_7d'
                ? 'Sin contactar +7d'
                : filtroAux === 'mail_2h_pdte'
                  ? 'Mail 2h pdte'
                  : 'SMS 24h pdte'
            }}
            <button
              type="button"
              class="cursor-pointer underline"
              @click="filtroAux = null"
            >
              quitar
            </button>
          </span>
        </div>
        <div
          v-if="chipActivo === 'forma_pago' && kpi"
          class="mb-3 flex flex-wrap gap-2"
        >
          <Button
            v-for="s in [
              { id: null, label: `Todas ${kpi.forma_pago}` },
              { id: 'cae', label: `CAE ${kpi.forma_pago_cae}` },
              { id: 'ministerial', label: `Benef. min. ${kpi.forma_pago_ministerial}` },
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

        <SeguimientoListaTabla
          v-if="vista === 'lista'"
          :filas="filas"
          :cargando="cargando"
          :total="total"
          :page="page"
          :page-size="pageSize"
          @abrir="abrirCaso"
          @update:page="(p) => (page = p)"
        />
        <SeguimientoBoard
          v-else
          :columnas="columnasBoard"
          :chip-enfasis="chipActivo"
          :cargando="cargando"
          @abrir="abrirCaso"
        />
      </main>
    </div>

    <SeguimientoCasoDrawer
      v-if="casoAbierto"
      :caso="casoAbierto"
      :bitacora="bitacora"
      :anio="periodoActivo.anio!"
      :semestre="periodoActivo.semestre!"
      @cerrar="cerrarCaso"
      @agregar-nota="dialogContacto = true"
      @enviado="abrirCaso(casoAbierto)"
    />

    <Dialog :open="dialogContacto" @update:open="(v) => (dialogContacto = v)">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar nota</DialogTitle>
        </DialogHeader>
        <div class="space-y-3">
          <div>
            <Label>Canal</Label>
            <Select v-model="canalContacto">
              <SelectTrigger class="mt-1 w-full">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nota">Nota</SelectItem>
                <SelectItem value="llamada">Llamada</SelectItem>
                <SelectItem value="correo">Correo</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
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
          <Button
            type="button"
            variant="outline"
            class="cursor-pointer"
            @click="dialogContacto = false"
          >
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
