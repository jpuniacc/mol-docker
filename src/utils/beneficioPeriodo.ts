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
