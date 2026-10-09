import { describe, expect, it } from 'vitest'

import { resumenPagosWebpay } from '@/utils/resumenPagosWebpay'
import type { WebpayPagoDetalle } from '@/utils/webpayPagoDetalle'

const debito: WebpayPagoDetalle = {
  forma: 'debito',
  autorizacion: '1415',
  cuotas: null,
  fecha: null,
  hora: null,
  ultimos4: null,
}
const credito: WebpayPagoDetalle = {
  forma: 'credito',
  autorizacion: '555',
  cuotas: 6,
  fecha: null,
  hora: null,
  ultimos4: null,
}

describe('resumenPagosWebpay', () => {
  it('muestra lo cobrado, débito sin cuotas y cada autorización', () => {
    const resumen = resumenPagosWebpay({
      medioMatricula: 'webpay',
      medioArancel: 'webpay',
      montoMatricula: 250_000,
      montoArancel: 4_140_000,
      detalleMatricula: debito,
      detalleArancel: { ...debito, autorizacion: '1416' },
    })
    expect(resumen?.bloques).toEqual([
      {
        titulo: 'Matrícula',
        pagado: 250_000,
        saldo: null,
        descuento: null,
        tarjeta: 'Débito',
        cuotas: 'Sin cuotas',
        autorizacion: '1415',
      },
      {
        titulo: 'Arancel',
        pagado: 3_933_000,
        saldo: 4_140_000,
        descuento: 207_000,
        tarjeta: 'Débito',
        cuotas: 'Sin cuotas',
        autorizacion: '1416',
      },
    ])
    expect(resumen?.total).toBe(4_183_000)
  })

  it('informa las cuotas del crédito', () => {
    const resumen = resumenPagosWebpay({
      medioMatricula: 'pagare',
      medioArancel: 'webpay',
      montoMatricula: 250_000,
      montoArancel: 1_000_000,
      detalleMatricula: debito,
      detalleArancel: credito,
    })
    expect(resumen?.bloques.map((b) => b.titulo)).toEqual(['Arancel'])
    expect(resumen?.bloques[0]).toMatchObject({
      tarjeta: 'Crédito',
      cuotas: '6 cuotas',
      autorizacion: '555',
      pagado: 950_000,
    })
  })

  it('trata el crédito de una cuota como contado', () => {
    const resumen = resumenPagosWebpay({
      medioMatricula: 'webpay',
      medioArancel: null,
      montoMatricula: 100,
      montoArancel: null,
      detalleMatricula: {
        forma: 'credito',
        autorizacion: '9',
        cuotas: 1,
        fecha: null,
        hora: null,
        ultimos4: null,
      },
      detalleArancel: null,
    })
    expect(resumen?.bloques[0]?.cuotas).toBe('1 cuota')
  })

  it('no arma bloque si ningún concepto es Webpay', () => {
    expect(
      resumenPagosWebpay({
        medioMatricula: 'pagare',
        medioArancel: 'pagare',
        montoMatricula: 1,
        montoArancel: 1,
        detalleMatricula: null,
        detalleArancel: null,
      }),
    ).toBeNull()
  })
})
