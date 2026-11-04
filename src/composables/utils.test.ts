import { describe, expect, it } from 'vitest'
import { sanitizeUsernameInput } from './utils'

describe('sanitizeUsernameInput', () => {
  it('conserva letras, dígitos, puntos y guiones', () => {
    expect(sanitizeUsernameInput('thannia.saint-jean')).toBe('thannia.saint-jean')
    expect(sanitizeUsernameInput('alejandra.valenzuela1')).toBe('alejandra.valenzuela1')
    expect(sanitizeUsernameInput('Ana.Perez')).toBe('Ana.Perez')
  })

  it('elimina espacios, tildes y símbolos ajenos', () => {
    expect(sanitizeUsernameInput(' thannia.saint-jean ')).toBe('thannia.saint-jean')
    expect(sanitizeUsernameInput('josé.núñez')).toBe('jos.nez')
    expect(sanitizeUsernameInput('user_name@x')).toBe('usernamex')
  })
})
