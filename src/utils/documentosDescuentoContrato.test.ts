import { describe, expect, it } from 'vitest'

import {
  TIPO_DOC_BECAS_INTERNAS,
  TIPO_DOC_CONVENIOS,
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
})
