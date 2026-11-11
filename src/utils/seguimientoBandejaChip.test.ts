import { describe, expect, it } from 'vitest'
import {
  chipBandejaDesdeSenales,
  colorEtapaChip,
  etiquetaSubetapaFormaPago,
  numeroChipBandeja,
  ORDEN_CHIPS_BANDEJA,
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

describe('utils chip bandeja UI v3', () => {
  it('numera chips 1–8 en orden wireframe', () => {
    ORDEN_CHIPS_BANDEJA.forEach((chip, i) => {
      expect(numeroChipBandeja(chip)).toBe(i + 1)
    })
  })

  it('humaniza subetapa forma de pago', () => {
    expect(etiquetaSubetapaFormaPago('cae')).toBe('CAE')
    expect(etiquetaSubetapaFormaPago('ministerial')).toBe('Beneficio min.')
    expect(etiquetaSubetapaFormaPago('ambos')).toBe('Ambos')
    expect(etiquetaSubetapaFormaPago('resto')).toBe('Resto')
    expect(etiquetaSubetapaFormaPago(null)).toBe('—')
  })

  it('colorEtapaChip distingue forma_pago de ingreso', () => {
    expect(colorEtapaChip('forma_pago').bg).not.toBe(colorEtapaChip('ingreso').bg)
  })

  it('backoffice y conflicto son chips terminales propios', () => {
    expect(chipBandejaDesdeSenales({ etapaActual: 'matriculado_bo', tufirmaEnviadaPendiente: false })).toBe('matriculado_bo')
    expect(chipBandejaDesdeSenales({ etapaActual: 'conflicto_mol_bo', tufirmaEnviadaPendiente: true })).toBe('conflicto_mol_bo')
  })
})
