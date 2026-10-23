import { describe, expect, it } from 'vitest'

import {
  MSG_ARANCEL_DIFERENCIADO,
  cantidadCodcliArancelDiferenciado,
  esCodcliArancelDiferenciado,
} from './arancelDiferenciado'

describe('esCodcliArancelDiferenciado', () => {
  it('cubre los 71 codcli de arancel diferenciado', () => {
    expect(cantidadCodcliArancelDiferenciado()).toBe(71)
    expect(esCodcliArancelDiferenciado('20251trso2ae027')).toBe(true)
    expect(esCodcliArancelDiferenciado('20251BIBL2AE019')).toBe(true)
    expect(esCodcliArancelDiferenciado('20231ADPU1AR033')).toBe(false)
    expect(MSG_ARANCEL_DIFERENCIADO).toContain('situación académica')
    expect(MSG_ARANCEL_DIFERENCIADO).toContain('Portal de Solicitudes UNIACC')
    expect(MSG_ARANCEL_DIFERENCIADO).not.toContain('servicio.estudiante')
  })
})
