import { describe, expect, it } from 'vitest'

import {
  TIPO_DOC_BECAS_ESTATALES,
  TIPO_DOC_BECAS_INTERNAS,
  TIPO_DOC_CAE,
  TIPO_DOC_CONVENIOS,
  TIPO_DOC_DESCUENTO_MATRICULA,
  asignarDocumentosDescuento,
} from '@/utils/documentosDescuentoContrato'

describe('asignarDocumentosDescuento', () => {
  it('deja peek y peek+1 al pagaré y numera cada descuento', () => {
    const docs = asignarDocumentosDescuento({
      peek: '90121338251',
      vencimiento: '29/12/2026',
      lineas: [
        {
          concepto: 'arancel',
          flujo: 'MOL_DVU',
          descripcion: 'Beca Talento Presencial',
          monto: 2495000,
        },
        {
          concepto: 'arancel',
          flujo: 'MOL_DVU',
          descripcion: 'Beneficio Apoyo UNIACC',
          monto: 748500,
        },
        {
          concepto: 'arancel',
          flujo: 'CONVENIO',
          descripcion: 'Caja Los Andes',
          monto: 915000,
        },
      ],
    })
    expect(docs.map((d) => d.documento)).toEqual([
      '90121338253',
      '90121338254',
      '90121338255',
    ])
    expect(docs[0]?.tipoDocumento).toBe(TIPO_DOC_BECAS_INTERNAS)
    expect(docs[2]?.tipoDocumento).toBe(TIPO_DOC_CONVENIOS)
  })

  it('numera primero los descuentos de matrícula', () => {
    const docs = asignarDocumentosDescuento({
      peek: '100',
      vencimiento: '29/12/2026',
      lineas: [
        { concepto: 'arancel', flujo: 'CONVENIO', descripcion: 'Convenio', monto: 10 },
        { concepto: 'matricula', flujo: 'MOL_DVU', descripcion: 'Interna', monto: 5 },
      ],
    })
    expect(docs.map((d) => ({ concepto: d.concepto, documento: d.documento }))).toEqual([
      { concepto: 'matricula', documento: '102' },
      { concepto: 'arancel', documento: '103' },
    ])
  })

  it('numera el descuento de matrícula con su tipo y antes que el arancel', () => {
    const docs = asignarDocumentosDescuento({
      peek: '90121338251',
      vencimiento: '29/12/2026',
      lineas: [
        {
          concepto: 'arancel',
          flujo: 'CONVENIO',
          descripcion: 'Caja Los Andes',
          monto: 915000,
        },
        {
          concepto: 'matricula',
          flujo: 'DESCUENTO_MATRICULA',
          descripcion: 'Matricula Anticipada Noviembre',
          monto: 50000,
        },
      ],
    })
    expect(docs.map((d) => ({ concepto: d.concepto, documento: d.documento, tipoDocumento: d.tipoDocumento }))).toEqual([
      {
        concepto: 'matricula',
        documento: '90121338253',
        tipoDocumento: TIPO_DOC_DESCUENTO_MATRICULA,
      },
      {
        concepto: 'arancel',
        documento: '90121338254',
        tipoDocumento: TIPO_DOC_CONVENIOS,
      },
    ])
  })

  it('numera convenio, beca estatal y CAE con el correlativo siguiente al pagaré', () => {
    const docs = asignarDocumentosDescuento({
      peek: '90121338251',
      vencimiento: '29/12/2026',
      lineas: [
        { concepto: 'arancel', flujo: 'ESTATAL', descripcion: 'Beca ministerial', monto: 500000 },
        { concepto: 'arancel', flujo: 'CONVENIO', descripcion: 'Caja Los Andes', monto: 915000 },
        { concepto: 'arancel', flujo: 'CAE', descripcion: 'Crédito Aval del Estado', monto: 0 },
      ],
    })
    expect(docs.map((d) => ({ documento: d.documento, tipoDocumento: d.tipoDocumento }))).toEqual([
      { documento: '90121338253', tipoDocumento: TIPO_DOC_BECAS_ESTATALES },
      { documento: '90121338254', tipoDocumento: TIPO_DOC_CONVENIOS },
      { documento: '90121338255', tipoDocumento: TIPO_DOC_CAE },
    ])
  })
})
