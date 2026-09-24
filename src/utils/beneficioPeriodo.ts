export type BeneficioFlujo =
  | 'ESTATAL'
  | 'MOL_DVU'
  | 'CONVENIO'
  | 'FORMA_PAGO'
  | 'NO_RENOVABLE'
  | 'NO_VIGENTE'
  | 'EN_REVISION'

export type TipoCertificado = 'AFILIACION' | 'ANTIGUEDAD_LABORAL'

export type ClasificacionBeneficio = {
  flujo: BeneficioFlujo
  aplica: boolean
  requiereCertificado: boolean
  tipoCertificado: TipoCertificado | null
}

/** Periodo del catálogo Excel: 2027-01 o 2027-02. */
export const PERIODO_CATALOGO_RE = /^\d{4}-0[12]$/

const ETIQUETA_QUE_ES: Record<BeneficioFlujo, string> = {
  ESTATAL: 'Beca estatal',
  MOL_DVU: 'Beca MOL',
  CONVENIO: 'Convenio',
  NO_VIGENTE: 'Convenio',
  FORMA_PAGO: 'Forma de pago',
  NO_RENOVABLE: 'No renovable',
  EN_REVISION: 'En revisión',
}

/** Qué es el código en pantalla. NO_VIGENTE sigue siendo un convenio. */
export function etiquetaQueEs(flujo: BeneficioFlujo): string {
  return ETIQUETA_QUE_ES[flujo]
}

/**
 * La copia solo procede si el destino tiene formato de periodo, es distinto
 * del origen y todavía no tiene filas.
 */
export function validarCopiaPeriodo(input: {
  origen: string
  destino: string
  filasDestino: number
}): string | null {
  const origen = input.origen.trim()
  const destino = input.destino.trim()
  if (!PERIODO_CATALOGO_RE.test(destino)) {
    return 'El periodo destino debe usar el formato 2027-01.'
  }
  if (destino === origen) {
    return 'El periodo destino tiene que ser distinto del origen.'
  }
  if (input.filasDestino > 0) {
    return 'Ese periodo ya tiene filas.'
  }
  return null
}

function norm(valor: string | null | undefined): string {
  return (valor ?? '').trim().toUpperCase()
}

export function clasificarBeneficioExcel(input: {
  renovable: string | null | undefined
  convenio: string | null | undefined
}): ClasificacionBeneficio {
  const convenio = norm(input.convenio)
  const renovable = norm(input.renovable)

  if (convenio.includes('NO VIGENTE')) {
    return {
      flujo: 'NO_VIGENTE',
      aplica: false,
      requiereCertificado: false,
      tipoCertificado: null,
    }
  }

  if (convenio.startsWith('SI')) {
    const tipoCertificado: TipoCertificado | null = convenio.includes('AFILIACION')
      ? 'AFILIACION'
      : convenio.includes('ANTIG')
        ? 'ANTIGUEDAD_LABORAL'
        : null
    return {
      flujo: 'CONVENIO',
      aplica: true,
      requiereCertificado: tipoCertificado !== null,
      tipoCertificado,
    }
  }

  if (renovable.includes('EN REVISION')) {
    return {
      flujo: 'EN_REVISION',
      aplica: false,
      requiereCertificado: false,
      tipoCertificado: null,
    }
  }

  if (renovable.includes('BECA ESTATAL')) {
    return {
      flujo: 'ESTATAL',
      aplica: true,
      requiereCertificado: false,
      tipoCertificado: null,
    }
  }

  if (renovable.includes('DESCUENTO POR FORMA DE PAGO')) {
    return {
      flujo: 'FORMA_PAGO',
      aplica: true,
      requiereCertificado: false,
      tipoCertificado: null,
    }
  }

  if (renovable.includes('NO ES BECA') || renovable.includes('NO RENOVABLE')) {
    return {
      flujo: 'NO_RENOVABLE',
      aplica: false,
      requiereCertificado: false,
      tipoCertificado: null,
    }
  }

  if (
    renovable.includes('BECA DVU') ||
    renovable.includes('RENOVACION') ||
    renovable.includes('SIN REQUISITO DE NOTAS')
  ) {
    return {
      flujo: 'MOL_DVU',
      aplica: true,
      requiereCertificado: false,
      tipoCertificado: null,
    }
  }

  return {
    flujo: 'EN_REVISION',
    aplica: false,
    requiereCertificado: false,
    tipoCertificado: null,
  }
}
