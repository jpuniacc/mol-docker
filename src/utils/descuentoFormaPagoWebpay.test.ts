import { describe, expect, it } from 'vitest'
import { descuentoFormaPagoArancel, montoWebpayArancel } from '@/utils/descuentoFormaPagoWebpay'

describe('descuentoFormaPagoWebpay', () => {
  it('aplica el 5 % al saldo del arancel que se ve en el diálogo', () => {
    expect(descuentoFormaPagoArancel(4_140_000)).toBe(207_000)
    expect(montoWebpayArancel(4_140_000)).toBe(3_933_000)
  })

  it('redondea al peso, como el 5 % de Felipe', () => {
    expect(descuentoFormaPagoArancel(2_667_000)).toBe(133_350)
    expect(montoWebpayArancel(2_667_000)).toBe(2_533_650)
  })
})
