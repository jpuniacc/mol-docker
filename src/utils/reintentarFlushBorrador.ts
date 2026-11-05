export type ReintentarFlushOpciones = {
  maxIntentos?: number
  /** Delay del primer reintento; luego *2 cada vez. */
  baseMs?: number
  sleep?: (ms: number) => Promise<void>
}

async function sleepDefault(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/** Reintenta flush del borrador con backoff exponencial. */
export async function reintentarFlushBorrador(
  flush: () => Promise<boolean>,
  opciones: ReintentarFlushOpciones = {},
): Promise<{ ok: boolean; intentos: number }> {
  const maxIntentos = Math.max(1, opciones.maxIntentos ?? 3)
  const baseMs = Math.max(0, opciones.baseMs ?? 1_000)
  const sleep = opciones.sleep ?? sleepDefault

  let intentos = 0
  while (intentos < maxIntentos) {
    intentos += 1
    const ok = await flush()
    if (ok) return { ok: true, intentos }
    if (intentos < maxIntentos) {
      const espera = baseMs * 2 ** (intentos - 1)
      await sleep(espera)
    }
  }
  return { ok: false, intentos }
}
