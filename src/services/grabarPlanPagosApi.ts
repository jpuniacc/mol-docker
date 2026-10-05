import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { rutSinDv } from '@/services/alumnoDeudaNetApi'
import type { MockPagoMatricula } from '@/stores/mockMatriculaContext'

export type GrabarPlanPagosPayload = {
  codcli: string
  codcliAcademico: string
  codcarr: string
  ano: number
  periodo: number
  contrato: string
  caja: number
  codapod: string
  montoMatricula: number
  montoArancel: number
  cuotas: number
  fechaInicio: string
  corrpagMatricula: string
  corrpagArancel: string
  beneficios: BeneficioPlanPagos[]
}

export type BeneficioPlanPagos = {
  codben: number
  porcSol: number
  porcApr: number
  montoSol: number
  montoApr: number
  monto: number
  aplicable: number
  concepto: 'M' | 'A'
  corrpag: string
}

export type GrabarPlanPagosResponse =
  | { ok: true; numOperacion: string; already: boolean }
  | { ok: false; error: string }

const TIMEOUT_MS = 120_000

function sumaItem(pago: MockPagoMatricula, item: 1 | 2): number {
  return (pago.cuotasDetalle ?? [])
    .filter((c) => c.item === item)
    .reduce((a, c) => a + Math.round(Number(c.monto) || 0), 0)
}

function folioItem(pago: MockPagoMatricula, item: 1 | 2): string {
  const row = (pago.cuotasDetalle ?? []).find((c) => c.item === item)
  return (row?.ctapagnum ?? '').trim()
}

export function armarGrabarPlanPagos(input: {
  rut: string
  codcliAcademico: string
  codigoCarrera: string
  ano: number | null
  periodo: number | null
  caja: number | null
  pago: MockPagoMatricula | null
}): { ok: true; payload: GrabarPlanPagosPayload } | { ok: false; error: string } {
  const pago = input.pago
  if (!pago || pago.medio !== 'pagare') {
    return { ok: false, error: 'El plan confirmado no es pagaré' }
  }
  const codcli = rutSinDv(input.rut)
  if (!/^\d{7,8}$/.test(codcli)) {
    return { ok: false, error: 'Falta el RUT del alumno para grabar el plan' }
  }
  const codcliAcademico = input.codcliAcademico.trim()
  if (!/^[0-9A-Za-z]{10,20}$/.test(codcliAcademico) || !/[A-Za-z]/.test(codcliAcademico)) {
    return { ok: false, error: 'Falta el código académico del alumno para cerrar la ficha' }
  }
  const codcarr = input.codigoCarrera.trim()
  const contrato = (pago.contrato ?? '').trim()
  const fechaInicio = (pago.fechaInicio ?? '').trim()
  const cuotas = pago.cuotas
  if (!codcarr || !contrato || !fechaInicio || (cuotas !== 10 && cuotas !== 12)) {
    return { ok: false, error: 'Faltan carrera, contrato, cuotas o fecha de inicio del plan' }
  }
  if (input.ano == null || (input.periodo !== 1 && input.periodo !== 2)) {
    return { ok: false, error: 'Falta el periodo académico para grabar el plan' }
  }
  const montoMatricula = sumaItem(pago, 1)
  const montoArancel = sumaItem(pago, 2)
  if (montoMatricula <= 0 || montoArancel <= 0) {
    return {
      ok: false,
      error: 'El grabado en TEST cubre matrícula y arancel en pagaré. Falta uno de los dos montos.',
    }
  }
  const corrpagMatricula = folioItem(pago, 1)
  const corrpagArancel = folioItem(pago, 2)
  if (!/^\d+$/.test(corrpagMatricula) || !/^\d+$/.test(corrpagArancel)) {
    return { ok: false, error: 'Faltan los folios CORRPAGNUM del plan' }
  }
  const caja = input.caja != null && input.caja > 0 ? input.caja : 997
  const beneficios = beneficiosDelPlan(pago)
  return {
    ok: true,
    payload: {
      codcli,
      codcliAcademico,
      codcarr,
      ano: input.ano,
      periodo: input.periodo,
      contrato,
      caja,
      codapod: codcli,
      montoMatricula,
      montoArancel,
      cuotas,
      fechaInicio,
      corrpagMatricula,
      corrpagArancel,
      beneficios,
    },
  }
}

function beneficiosDelPlan(pago: MockPagoMatricula): BeneficioPlanPagos[] {
  const vistos = new Set<number>()
  const beneficios: BeneficioPlanPagos[] = []
  for (const descuento of pago.descuentos ?? []) {
    const codigo = (descuento.codben ?? '').trim()
    const corrpag = (descuento.documento ?? '').trim()
    if (!/^\d+$/.test(codigo) || !/^\d+$/.test(corrpag)) continue
    const codben = Number(codigo)
    if (!Number.isInteger(codben) || codben <= 0 || vistos.has(codben)) continue
    if (!(descuento.monto > 0)) continue
    vistos.add(codben)
    const porc = descuento.porc ?? 0
    beneficios.push({
      codben,
      porcSol: porc,
      porcApr: porc,
      montoSol: descuento.montoSolicitado ?? descuento.monto,
      montoApr: descuento.monto,
      monto: descuento.monto,
      aplicable: 1,
      concepto: descuento.concepto === 'matricula' ? 'M' : 'A',
      corrpag,
    })
  }
  return beneficios
}

export async function postGrabarPlanPagos(
  payload: GrabarPlanPagosPayload,
): Promise<GrabarPlanPagosResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${admisionApiBaseUrl()}/api/rematricula/alumno/plan-pagos/grabar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status} al grabar el plan` }
    }
    if (!res.ok) {
      const rec = body as { error?: string; message?: string }
      return { ok: false, error: rec.error || rec.message || `Error HTTP ${res.status}` }
    }
    const rec = body as { numOperacion?: unknown; already?: unknown }
    if (typeof rec.numOperacion !== 'string' || !rec.numOperacion) {
      return { ok: false, error: 'El SP no devolvió número de operación' }
    }
    return { ok: true, numOperacion: rec.numOperacion, already: rec.already === true }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, error: 'Tiempo de espera agotado al grabar el plan en TEST' }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo grabar el plan' }
  } finally {
    clearTimeout(timer)
  }
}
