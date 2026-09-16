import { describe, expect, it } from 'vitest'

import { aplicarPrelacionArancel, type ItemPrelacionInput } from './prelacionArancel'

function item(partial: Partial<ItemPrelacionInput> & Pick<ItemPrelacionInput, 'codigo' | 'flujo' | 'monto'>): ItemPrelacionInput {
  return {
    descripcion: partial.descripcion ?? partial.codigo,
    disminucion: partial.disminucion ?? 0,
    pierde: partial.pierde ?? false,
    ...partial,
  }
}

describe('aplicarPrelacionArancel', () => {
  it('aplica una interna sobre el arancel bruto', () => {
    const r = aplicarPrelacionArancel({
      arancelBruto: 4_000_000,
      items: [item({ codigo: '1744', flujo: 'MOL_DVU', monto: 400_000 })],
    })
    expect(r.descuentoInterna).toBe(400_000)
    expect(r.descuentoEstatal).toBe(0)
    expect(r.arancelNeto).toBe(3_600_000)
    expect(r.items.find((i) => i.codigo === '1744')?.aplica).toBe(true)
  })

  it('con dos internas deja solo la de mayor % (Art. 9)', () => {
    const r = aplicarPrelacionArancel({
      arancelBruto: 4_000_000,
      items: [
        item({ codigo: '1744', flujo: 'MOL_DVU', monto: 400_000 }),
        item({ codigo: '1745', flujo: 'MOL_DVU', monto: 800_000 }),
      ],
    })
    expect(r.items.find((i) => i.codigo === '1745')?.aplica).toBe(true)
    expect(r.items.find((i) => i.codigo === '1744')?.aplica).toBe(false)
    expect(r.items.find((i) => i.codigo === '1744')?.motivo).toBe('No acumula (Art. 9)')
    expect(r.descuentoInterna).toBe(800_000)
  })

  it('Apoyo UNIACC 1756 se acumula con la interna ganadora', () => {
    const r = aplicarPrelacionArancel({
      arancelBruto: 4_000_000,
      items: [
        item({ codigo: '1744', flujo: 'MOL_DVU', monto: 800_000 }),
        item({ codigo: '1756', flujo: 'MOL_DVU', monto: 200_000 }),
      ],
    })
    expect(r.items.filter((i) => i.aplica).map((i) => i.codigo)).toEqual(['1744', '1756'])
    // 1744 20% de 4.000.000 = 800.000 → saldo 3.200.000
    // 1756 5% de 3.200.000 = 160.000
    expect(r.descuentoInterna).toBe(960_000)
    expect(r.arancelNeto).toBe(3_040_000)
  })

  it('estatal e interna van en cascada, no suman sobre el bruto', () => {
    const r = aplicarPrelacionArancel({
      arancelBruto: 4_000_000,
      items: [
        item({ codigo: '9', flujo: 'ESTATAL', monto: 2_000_000 }),
        item({ codigo: '1744', flujo: 'MOL_DVU', monto: 800_000 }),
      ],
    })
    // estatal 50% → 2.000.000, saldo 2.000.000
    // interna 20% de 2.000.000 = 400.000
    expect(r.descuentoEstatal).toBe(2_000_000)
    expect(r.descuentoInterna).toBe(400_000)
    expect(r.descuentoTotal).toBe(2_400_000)
    expect(r.arancelNeto).toBe(1_600_000)
  })

  it('Art. 13 baja el % antes de aplicar sobre el saldo', () => {
    const r = aplicarPrelacionArancel({
      arancelBruto: 4_000_000,
      items: [item({ codigo: '1744', flujo: 'MOL_DVU', monto: 400_000, disminucion: 0.15 })],
    })
    // 10% × 0.85 = 8.5% de 4.000.000 = 340.000
    expect(r.descuentoInterna).toBe(340_000)
    expect(r.arancelNeto).toBe(3_660_000)
  })

  it('recorta internas al 70% del arancel bruto', () => {
    const r = aplicarPrelacionArancel({
      arancelBruto: 1_000_000,
      items: [item({ codigo: '1744', flujo: 'MOL_DVU', monto: 800_000 })],
    })
    expect(r.descuentoInterna).toBe(700_000)
    expect(r.recorteTope).toBe(100_000)
    expect(r.arancelNeto).toBe(300_000)
  })

  it('no deja el arancel bajo 0 si el % derivado supera 100%', () => {
    const r = aplicarPrelacionArancel({
      arancelBruto: 1_000_000,
      items: [item({ codigo: '9', flujo: 'ESTATAL', monto: 2_000_000 })],
    })
    expect(r.descuentoEstatal).toBe(1_000_000)
    expect(r.arancelNeto).toBe(0)
    expect(r.descuentoTotal).toBe(1_000_000)
  })

  it('deja fuera forma de pago, no renovables y pérdida Art. 13', () => {
    const r = aplicarPrelacionArancel({
      arancelBruto: 4_000_000,
      items: [
        item({ codigo: '1829', flujo: 'FORMA_PAGO', monto: 200_000 }),
        item({ codigo: '1811', flujo: 'NO_RENOVABLE', monto: 100_000 }),
        item({ codigo: '1744', flujo: 'MOL_DVU', monto: 400_000, pierde: true }),
      ],
    })
    expect(r.descuentoTotal).toBe(0)
    expect(r.items.every((i) => i.aplica === false)).toBe(true)
  })
})
