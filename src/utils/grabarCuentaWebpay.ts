import { rutSinDv } from '@/services/alumnoDeudaNetApi'
import type { BeneficioPlanPagos, GrabarPlanPagosPayload } from '@/services/grabarPlanPagosApi'
import type { DocumentoDescuentoAsignado } from '@/utils/documentosDescuentoContrato'

export type GrabarCuentaWebpayInput = {
  rut: string
  codcliAcademico: string
  codigoCarrera: string
  ano: number | null
  periodo: number | null
  caja: number | null
  contrato: string
  fechaInicio: string
  montoMatricula: number
  montoArancel: number
  descuentos: DocumentoDescuentoAsignado[]
  cerrarFicha: boolean
}

type ArmadoCuentaWebpay =
  | { ok: true; payload: GrabarPlanPagosPayload }
  | { ok: false; error: string }

function beneficiosDeLaCuenta(
  descuentos: DocumentoDescuentoAsignado[],
): { ok: true; beneficios: BeneficioPlanPagos[] } | { ok: false; error: string } {
  const beneficios: BeneficioPlanPagos[] = []
  for (const descuento of descuentos) {
    if (!(descuento.monto > 0)) continue
    const codigo = (descuento.codben ?? '').trim()
    if (!/^\d+$/.test(codigo)) return { ok: false, error: 'Falta el CODBEN de un beneficio' }
    const corrpag = (descuento.documento ?? '').trim()
    if (!/^\d+$/.test(corrpag)) return { ok: false, error: 'Falta el folio de un beneficio' }
    const porc = descuento.porc ?? 0
    beneficios.push({
      codben: Number(codigo),
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
  return { ok: true, beneficios }
}

export function armarGrabarCuentaWebpay(input: GrabarCuentaWebpayInput): ArmadoCuentaWebpay {
  const codcli = rutSinDv(input.rut)
  if (!/^\d{7,8}$/.test(codcli)) {
    return { ok: false, error: 'Falta el RUT del alumno para grabar el plan' }
  }
  const codcliAcademico = input.codcliAcademico.trim()
  if (!/^[0-9A-Za-z]{10,20}$/.test(codcliAcademico) || !/[A-Za-z]/.test(codcliAcademico)) {
    return { ok: false, error: 'Falta el código académico del alumno para cerrar la ficha' }
  }
  const codcarr = input.codigoCarrera.trim()
  const contrato = (input.contrato ?? '').trim()
  const fechaInicio = (input.fechaInicio ?? '').trim()
  if (!codcarr || !contrato || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
    return { ok: false, error: 'Faltan carrera, contrato o fecha de inicio del plan' }
  }
  if (input.ano == null || (input.periodo !== 1 && input.periodo !== 2)) {
    return { ok: false, error: 'Falta el periodo académico para grabar el plan' }
  }
  const { montoMatricula, montoArancel } = input
  if (
    !Number.isInteger(montoMatricula) ||
    montoMatricula <= 0 ||
    !Number.isInteger(montoArancel) ||
    montoArancel <= 0
  ) {
    return { ok: false, error: 'Falta el saldo de matrícula o de arancel' }
  }
  const beneficios = beneficiosDeLaCuenta(input.descuentos)
  if (!beneficios.ok) return beneficios
  const caja = input.caja != null && input.caja > 0 ? input.caja : 997
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
      cuotas: 1,
      fechaInicio,
      corrpagMatricula: '0',
      corrpagArancel: '0',
      beneficios: beneficios.beneficios,
      medioMatricula: 'webpay',
      medioArancel: 'webpay',
      cerrarFicha: input.cerrarFicha,
    },
  }
}
