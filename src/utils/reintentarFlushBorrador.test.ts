import { describe, expect, it, vi } from 'vitest'
import { reintentarFlushBorrador } from './reintentarFlushBorrador'

describe('reintentarFlushBorrador', () => {
  it('retorna ok en el primer intento exitoso', async () => {
    const flush = vi.fn().mockResolvedValue(true)
    const sleep = vi.fn().mockResolvedValue(undefined)
    const r = await reintentarFlushBorrador(flush, { maxIntentos: 3, sleep })
    expect(r).toEqual({ ok: true, intentos: 1 })
    expect(flush).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('reintenta con backoff y termina ok', async () => {
    const flush = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const sleep = vi.fn().mockResolvedValue(undefined)
    const r = await reintentarFlushBorrador(flush, {
      maxIntentos: 3,
      baseMs: 100,
      sleep,
    })
    expect(r).toEqual({ ok: true, intentos: 3 })
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenNthCalledWith(1, 100)
    expect(sleep).toHaveBeenNthCalledWith(2, 200)
  })

  it('falla tras agotar intentos', async () => {
    const flush = vi.fn().mockResolvedValue(false)
    const sleep = vi.fn().mockResolvedValue(undefined)
    const r = await reintentarFlushBorrador(flush, { maxIntentos: 2, baseMs: 50, sleep })
    expect(r).toEqual({ ok: false, intentos: 2 })
    expect(flush).toHaveBeenCalledTimes(2)
  })
})
