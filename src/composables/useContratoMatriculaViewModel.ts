import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import clausulasFixture from '@/assets/contrato/clausulas.json'
import { useMockAlumnoFuente } from '@/composables/useMockAlumnoFuente'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'
import { useMatriculaFlujoPreflightStore } from '@/stores/datos_erp/matricula_flujo_preflight'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type { ContratoMatriculaViewModel } from '@/types/contratoMatricula'

function dash(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t.length > 0 && t !== '—' ? t : '—'
}

function formatClp(n: number): string {
  return new Intl.NumberFormat('es-CL').format(Math.round(n))
}

function jornadaLabel(raw: string): string {
  const u = raw.trim().toUpperCase()
  if (u === 'D' || u === 'DIURNA' || u === 'DIURNO') return 'DIURNO'
  if (u === 'V' || u === 'VESPERTINA' || u === 'VESPERTINO') return 'VESPERTINO'
  if (u === 'AD' || u.includes('DISTANCIA')) return 'A DISTANCIA'
  if (u === 'S' || u.includes('SEMI')) return 'SEMIPRESENCIAL'
  if (u === 'NA') return 'NO APLICA'
  return raw.trim() || '—'
}

function fechaHoyLabel(): string {
  const d = new Date()
  return d.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatFecven(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

function domiciliadoPorGenero(genero: string): string {
  const g = genero.trim().toUpperCase()
  if (g === 'F' || g === 'FEMENINO' || g === 'MUJER') return 'domiciliada'
  return 'domiciliado'
}

export function useContratoMatriculaViewModel() {
  const mockCtx = useMockMatriculaContextStore()
  const fuente = useMockAlumnoFuente()
  const preflight = useMatriculaFlujoPreflightStore()
  const periodoActivo = usePeriodoActivoStore()
  const { pagoMatricula } = storeToRefs(mockCtx)

  const tienePlanConfirmado = computed(() => pagoMatricula.value != null)

  const viewModel = computed((): ContratoMatriculaViewModel | null => {
    const pago = pagoMatricula.value
    if (!pago) return null

    const asignaturasNuevo = false

    const direccion = dash(fuente.direccionMostrada.value)
    const comuna = dash(fuente.comunaMostrada.value)
    const ciudad = dash(fuente.ciudadMostrada.value)
    const domicilioLinea = [direccion, comuna, ciudad].filter((x) => x !== '—').join(', ') || '—'

    const cuotasDetalle = pago.cuotasDetalle ?? []
    const matSum = cuotasDetalle
      .filter((c) => c.item === 1)
      .reduce((a, c) => a + (Number(c.monto) || 0), 0)
    const araSum = cuotasDetalle
      .filter((c) => c.item === 2)
      .reduce((a, c) => a + (Number(c.monto) || 0), 0)

    let valorMatricula = matSum
    let valorArancel = araSum
    if (valorMatricula <= 0 && valorArancel <= 0 && pago.monto > 0) {
      // Sin desglose: mostrar total en arancel y 0 matrícula
      valorArancel = pago.monto
    }

    const preAno = preflight.steps?.contrato.ano
    const prePer = preflight.steps?.contrato.periodo
    const periodoAcademico =
      periodoActivo.label ??
      (preAno && prePer ? `${preAno}/${prePer}` : '—')

    const sostNombre = dash(fuente.nombreApoderadoMostrado.value)
    const sostRut = dash(fuente.rutApoderadoMostrado.value)

    return {
      numOperacion: String(pago.numOperacion ?? '—'),
      contrato: String(pago.contrato ?? '—'),
      fechaContratoLabel: fechaHoyLabel(),
      ciudadFirma: 'Santiago',
      periodoAcademico,
      alumno: {
        nombre: dash(fuente.nombreMostrado.value),
        rut: dash(fuente.rutMostrado.value),
        domicilio: domicilioLinea,
        comuna,
        ciudad,
        nacionalidad: dash(fuente.nacionalidadMostrada.value),
        estadoCivil: '—',
        profesion: '—',
        domiciliadoLabel: domiciliadoPorGenero(fuente.generoMostrado.value),
        carrera: dash(fuente.carreraMostrada.value),
        jornada: jornadaLabel(fuente.jornadaMostrada.value),
      },
      sostenedor: {
        nombre: sostNombre === '—' ? dash(fuente.nombreMostrado.value) : sostNombre,
        rut: sostRut === '—' ? dash(fuente.rutMostrado.value) : sostRut,
        domicilio: domicilioLinea,
        comuna,
        ciudad,
        nacionalidad: 'Chilena',
        estadoCivil: '—',
        profesion: '—',
        domiciliadoLabel: 'domiciliado',
      },
      emailAlumno: dash(fuente.correoPersonalMostrado.value),
      emailApoderado:
        fuente.mailApoderadoMostrado.value === '—'
          ? null
          : fuente.mailApoderadoMostrado.value,
      valorMatricula,
      valorArancel,
      cuotas: cuotasDetalle.map((c) => ({
        documento: c.correlativo || c.documento,
        tipoDocumento: c.documento,
        valor: c.monto,
        fechaVencimiento: formatFecven(c.vencimiento),
        cuota: c.cuota,
        totalCuotas: c.totalCuotas,
        item: c.item,
      })),
      representante: {
        nombre: '',
        rut: '',
      },
      asignaturasNuevo,
    }
  })

  return {
    clausulasFixture,
    tienePlanConfirmado,
    viewModel,
    formatClp,
  }
}

export type { ContratoMatriculaViewModel }
