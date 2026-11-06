import { describe, expect, it } from 'vitest'
import {
  chipBandejaDesdeSenales,
  particionChipsExclusiva,
  type ChipBandeja,
} from './seguimientoBandejaChip'

describe('chipBandejaDesdeSenales', () => {
  it('particiona 5/6/7 sin intersección', () => {
    const rows: Array<{ id: string; chip: ChipBandeja }> = [
      {
        id: 'a',
        chip: chipBandejaDesdeSenales({
          etapaActual: 'forma_pago',
          tufirmaEnviadaPendiente: false,
        }),
      },
      {
        id: 'b',
        chip: chipBandejaDesdeSenales({
          etapaActual: 'forma_pago',
          tufirmaEnviadaPendiente: true,
        }),
      },
      {
        id: 'c',
        chip: chipBandejaDesdeSenales({
          etapaActual: 'firma',
          tufirmaEnviadaPendiente: true,
        }),
      },
    ]
    expect(rows[0].chip).toBe('forma_pago')
    expect(rows[1].chip).toBe('contrato_pdte')
    expect(rows[2].chip).toBe('firmado_pdte_u')
    const p = particionChipsExclusiva(rows)
    expect(p.ok).toBe(true)
    expect(p.interseccion56).toEqual([])
    expect(p.interseccion67).toEqual([])
  })
})
