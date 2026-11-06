import { describe, expect, it } from 'vitest'
import { estadoOutboxUi } from './seguimientoBandejaOutbox'

describe('estadoOutboxUi', () => {
  it('P sin fila → n/a (CORTE 1 esperado)', () => {
    expect(estadoOutboxUi({ aplicaRetencionP: true, fila: null })).toBe('n/a')
  })

  it('!P → n/a', () => {
    expect(
      estadoOutboxUi({
        aplicaRetencionP: false,
        fila: { estado: 'pendiente', sent_at: null },
      }),
    ).toBe('n/a')
  })
})
