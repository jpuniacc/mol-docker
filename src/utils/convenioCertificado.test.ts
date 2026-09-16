import { describe, expect, it } from 'vitest'

import type { MnpMvBeneficioPeriodoRow, PlanPagosMvRow } from '@/types/supabase'

import { detectarCertificadosRequeridos } from './convenioCertificado'

function planConCodigos(codigos: string[]): PlanPagosMvRow {
  return {
    beneficios_detalle: codigos.map((cod_beneficio) => ({
      cod_beneficio,
      descripcion: null,
      monto: null,
      porc_apr: null,
      aplicable: null,
      estado: null,
    })),
  } as PlanPagosMvRow
}

function catalogo(
  rows: Array<Pick<MnpMvBeneficioPeriodoRow, 'codigo_beneficio' | 'requiere_certificado' | 'tipo_certificado' | 'beneficio'>>,
): MnpMvBeneficioPeriodoRow[] {
  return rows as MnpMvBeneficioPeriodoRow[]
}

describe('detectarCertificadosRequeridos', () => {
  const cat = catalogo([
    {
      codigo_beneficio: '89',
      beneficio: 'CAJA LA ARAUCANA',
      requiere_certificado: true,
      tipo_certificado: 'AFILIACION',
    },
    {
      codigo_beneficio: '749',
      beneficio: 'CARABINEROS',
      requiere_certificado: true,
      tipo_certificado: 'ANTIGUEDAD_LABORAL',
    },
    {
      codigo_beneficio: '1552',
      beneficio: 'CAJA LOS ANDES',
      requiere_certificado: true,
      tipo_certificado: 'AFILIACION',
    },
    {
      codigo_beneficio: '1565',
      beneficio: 'SINDICATO BANCOESTADO',
      requiere_certificado: true,
      tipo_certificado: 'AFILIACION',
    },
    {
      codigo_beneficio: '1744',
      beneficio: 'Talento',
      requiere_certificado: false,
      tipo_certificado: null,
    },
  ])

  it('pide certificado solo si está en el plan y en el catálogo', () => {
    expect(detectarCertificadosRequeridos(planConCodigos(['1552', '1744']), cat)).toEqual([
      {
        codigoBeneficio: '1552',
        beneficio: 'CAJA LOS ANDES',
        tipoCertificado: 'AFILIACION',
      },
    ])
  })

  it('cubre los cuatro códigos de certificado 2027-01', () => {
    const encontrados = detectarCertificadosRequeridos(
      planConCodigos(['89', '749', '1552', '1565', '1744']),
      cat,
    ).map((c) => c.codigoBeneficio)
    expect(encontrados).toEqual(['89', '749', '1552', '1565'])
  })

  it('no pide si el código no está en el plan', () => {
    expect(detectarCertificadosRequeridos(planConCodigos(['1744']), cat)).toEqual([])
  })
})
