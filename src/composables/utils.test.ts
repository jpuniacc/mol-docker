import { describe, expect, it } from 'vitest'
import { sanitizeUsernameInput } from './utils'

describe('sanitizeUsernameInput', () => {
  it('conserva letras, puntos, guiones y dígitos de la cartera', () => {
    expect(sanitizeUsernameInput('thannia.saint-jean')).toBe('thannia.saint-jean')
    expect(sanitizeUsernameInput('avril-max.diaz')).toBe('avril-max.diaz')
    expect(sanitizeUsernameInput('cristobal.ruiz-tagle')).toBe('cristobal.ruiz-tagle')
    expect(sanitizeUsernameInput('catalina.garcia-huid')).toBe('catalina.garcia-huid')
    expect(sanitizeUsernameInput('alejandra.valenzuela1')).toBe('alejandra.valenzuela1')
    expect(sanitizeUsernameInput('Ana.Perez')).toBe('Ana.Perez')
  })

  it('elimina espacios, tildes, arroba y símbolos ajenos', () => {
    expect(sanitizeUsernameInput(' thannia.saint-jean ')).toBe('thannia.saint-jean')
    expect(sanitizeUsernameInput('josé.núñez')).toBe('jos.nez')
    expect(sanitizeUsernameInput('user_name@uniacc.cl')).toBe('usernameuniacc.cl')
  })
})
