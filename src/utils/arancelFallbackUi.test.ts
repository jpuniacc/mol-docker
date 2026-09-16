import { describe, expect, it } from 'vitest'

import { etiquetaFallbackArancelAno } from './arancelFallbackUi'

describe('etiquetaFallbackArancelAno', () => {
  it('indica que se usa 2026 porque no hay 2027', () => {
    expect(
      etiquetaFallbackArancelAno({ anoSolicitado: 2027, fallbackAno: 2026 }),
    ).toBe('Arancel 2026 (no hay tarifa 2027)')
  })

  it('no muestra etiqueta si no hubo fallback de año', () => {
    expect(etiquetaFallbackArancelAno({ ano: 2027 })).toBeNull()
    expect(etiquetaFallbackArancelAno(undefined)).toBeNull()
  })
})
