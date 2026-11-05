import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { obtenerEstadoRetencion } from '@/services/retencionEstadoApi'
import { parcheDesdeWebpayAutorizadas } from '@/utils/conciliarWebpayRetencion'
import {
  procesoRematriculaIncompleto,
  type SenalesRetencionRematricula,
} from '@/utils/procesoRematriculaIncompleto'
import { rutaPasoPendienteRetencion } from '@/utils/conciliarWebpayRetencion'
import { claveBorradorValida } from '@/utils/borradorRematriculaSync'

export type ResultadoConciliacionRetencion = {
  ok: boolean
  incompleto: boolean
  ruta:
    | 'matricula-alumno-forma-pago'
    | 'matricula-alumno-firma'
    | 'matricula-alumno-resumen'
    | null
}

export async function conciliarRetencionAlumno(input: {
  rut: string
  codcli: string
}): Promise<ResultadoConciliacionRetencion> {
  const alumnoCtx = useMatriculaAlumnoContextStore()
  const periodo = usePeriodoActivoStore()
  const anio = periodo.anio
  const semestre = periodo.semestre
  if (anio == null || (semestre !== 1 && semestre !== 2)) {
    return { ok: false, incompleto: false, ruta: null }
  }

  const clave = claveBorradorValida(input.codcli, anio, semestre)
  if (clave) {
    await alumnoCtx.sincronizarBorradorServidor(clave)
  }

  const remoto = await obtenerEstadoRetencion({
    rut: input.rut,
    codcli: input.codcli,
    anio,
    semestre,
  })
  if (!remoto) {
    const senalesLocal: SenalesRetencionRematricula = {
      medioMatricula: alumnoCtx.medioMatricula,
      medioArancel: alumnoCtx.medioArancel,
      webpayMatriculaEstado: alumnoCtx.webpayMatriculaEstado,
      webpayArancelEstado: alumnoCtx.webpayArancelEstado,
      pagoMatricula: alumnoCtx.pagoMatricula,
      firmaCompletada: alumnoCtx.firmaCompletada,
      arancelPorPagar: alumnoCtx.webpayMontoArancel,
      periodoActivo: true,
    }
    return {
      ok: alumnoCtx.hidratacionBorradorLista,
      incompleto: procesoRematriculaIncompleto(senalesLocal),
      ruta: rutaPasoPendienteRetencion(senalesLocal),
    }
  }

  const parche = parcheDesdeWebpayAutorizadas({
    matriculaAutorizada: remoto.matriculaAutorizada,
    arancelAutorizado: remoto.arancelAutorizado,
    firmaCompletadaServidor: remoto.firmaCompletada,
  })
  alumnoCtx.aplicarParcheRetencion(parche)
  await alumnoCtx.flushBorrador()

  const senales: SenalesRetencionRematricula = {
    medioMatricula: alumnoCtx.medioMatricula,
    medioArancel: alumnoCtx.medioArancel,
    webpayMatriculaEstado: alumnoCtx.webpayMatriculaEstado,
    webpayArancelEstado: alumnoCtx.webpayArancelEstado,
    pagoMatricula: alumnoCtx.pagoMatricula,
    firmaCompletada: alumnoCtx.firmaCompletada,
    arancelPorPagar: alumnoCtx.webpayMontoArancel,
    periodoActivo: true,
  }

  return {
    ok: true,
    incompleto: procesoRematriculaIncompleto(senales),
    ruta: rutaPasoPendienteRetencion(senales),
  }
}
