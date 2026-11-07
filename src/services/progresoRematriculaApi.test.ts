import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/services/supabaseClient', () => ({ supabase: { rpc } }))
vi.mock('@/stores/carteraEjecutivo', () => ({ useCarteraEjecutivoStore: vi.fn() }))

type Response = { data: number | null; error: { message: string } | null }
function request(promise: Promise<Response>) {
  return Object.assign(promise, { abortSignal: vi.fn().mockReturnValue(promise) })
}
let refresh: typeof import('./progresoRematriculaApi')['refreshProgresoRematricula']
beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-07T21:00:00Z'))
  vi.resetModules()
  rpc.mockReset()
  refresh = (await import('./progresoRematriculaApi')).refreshProgresoRematricula
})
afterEach(() => vi.useRealTimers())

describe('refresh de progreso: TTL y recuperación', () => {
  it('comparte una sola petición concurrente por período', async () => {
    let resolve!: (r: Response) => void
    rpc.mockReturnValue(request(new Promise<Response>(r => { resolve = r })))
    const a = refresh(2027, 1)
    const b = refresh(2027, 1)
    expect(rpc).toHaveBeenCalledTimes(1)
    resolve({ data: 4096, error: null })
    expect(await a).toEqual({ count: 4096, error: null })
    expect(await b).toEqual({ count: 4096, error: null })
  })
  it('no recalcula antes de 60 segundos y sí al expirar', async () => {
    rpc.mockImplementation(() => request(Promise.resolve({ data: 4096, error: null })))
    await refresh(2027, 1)
    await vi.advanceTimersByTimeAsync(59_999)
    await refresh(2027, 1)
    expect(rpc).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await refresh(2027, 1)
    expect(rpc).toHaveBeenCalledTimes(2)
  })
  it('no mezcla períodos', async () => {
    rpc.mockImplementation(() => request(Promise.resolve({ data: 1, error: null })))
    await refresh(2027, 1)
    await refresh(2027, 2)
    expect(rpc).toHaveBeenCalledTimes(2)
  })
  it('devuelve errores y permite reintentar sin cachear el fallo', async () => {
    rpc.mockReturnValueOnce(request(Promise.resolve({ data: null, error: { message: 'sin conexión' } })))
    rpc.mockReturnValueOnce(request(Promise.resolve({ data: 4, error: null })))
    expect((await refresh(2027, 1)).error).toBe('sin conexión')
    expect(await refresh(2027, 1)).toEqual({ count: 4, error: null })
    expect(rpc).toHaveBeenCalledTimes(2)
  })
  it('convierte rechazos de red en resultado de error para poder listar con aviso', async () => {
    rpc.mockImplementation(() => request(Promise.reject(new Error('red caída'))))
    expect(await refresh(2027, 1)).toEqual({ count: null, error: 'red caída' })
  })
  it('limita la espera a 8 segundos, aborta y deja reintentar', async () => {
    const pending = request(new Promise<Response>(() => {}))
    rpc.mockReturnValueOnce(pending)
    const result = refresh(2027, 1)
    // Adjuntar await antes de avanzar evita promesas rechazadas sin observar.
    const observed = result.then(r => r)
    await vi.advanceTimersByTimeAsync(8_000)
    expect(await observed).toEqual({ count: null, error: 'Tiempo de espera agotado al refrescar el progreso (8 s)' })
    const signal = pending.abortSignal.mock.calls[0]?.[0] as AbortSignal
    expect(signal.aborted).toBe(true)
    rpc.mockReturnValueOnce(request(Promise.resolve({ data: 3, error: null })))
    expect(await refresh(2027, 1)).toEqual({ count: 3, error: null })
  })
})
