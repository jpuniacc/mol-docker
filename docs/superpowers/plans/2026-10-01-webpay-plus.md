# Webpay Plus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrar matrícula y arancel con Webpay Plus desde el diálogo real de MOL, una transacción por concepto, guardando el resultado en Supabase.

**Architecture:** `uniacc-api` habla con Transbank y escribe `mnp_webpay_transaccion`. La `return_url` es `POST|GET /api/rematricula/alumno/webpay/volver` en el mismo host de MOL (nginx ya manda `/api/` al API), porque un POST de Transbank no llega al body de Vue. Ese endpoint clasifica, persiste y responde 302 a `/dashboard/matricula-alumno/webpay/retorno?buy_order=`. MOL elige el paso siguiente y arma el formulario `token_ws`.

**Tech Stack:** Express + TypeScript + `node:test` en `uniacc-api-docker`. Vue 3 + Vitest en `mol-docker`. Postgres de Supabase. Webpay Plus REST v1.2.

## Global Constraints

- Producto: Webpay Plus, una transacción normal por cobro. No Mall, no captura diferida, no refund en el flujo del alumno.
- Matrícula y arancel por separado. Cada uno es `webpay` o `pagare`.
- Si ambos son Webpay, dos transacciones. La matrícula va primero. El arancel se crea solo si la matrícula quedó `autorizada`.
- Si hay un solo Webpay, ese cobro va primero. El plan de pagaré se arma después, y solo para el concepto que es pagaré.
- Los dos en pagaré siguen el flujo actual, sin filas Webpay.
- `buy_order` = `{codcli}{anio}-{periodo}-{correlativo}`. Ejemplo `123456782027-1-15`. Máximo 26. `codcli` es RUT sin DV, 7 u 8 dígitos. `periodo` es `1` o `2`. El correlativo lo da la secuencia de Postgres. No usar `CORRPAGNUM`.
- `session_id` = `{codcli}-{anio}-{periodo}-{concepto}-{correlativo}`. Máximo 61.
- Autorizado solo si `status` es `AUTHORIZED`, `response_code` es `0` y `amount` es el monto guardado. `vci` no decide.
- Si el arancel se aborta o se rechaza, la fila de matrícula `autorizada` no se toca.
- El ERP no se escribe. La pantalla mock de WebPay / Pagaré / TOKU no se toca.
- Ambiente de esta entrega: integración, host `https://webpay3gint.transbank.cl`. El código `597053102249` queda en env y no se usa mientras el ambiente sea integración.
- Credenciales solo en env de `uniacc-api`. El navegador no llama a Transbank.
- Monto: entero en pesos, mayor que cero, el neto que ya muestra la pantalla. El servidor no recalcula becas.

---

### Task 1: Orden de compra y session id

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/webpay-plus/buy-order.ts`
- Test: `/opt/uniacc-api-docker/src/services/webpay-plus/buy-order.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `armarBuyOrder(input: { codcli: string; anio: number; periodo: number; correlativo: number }): string`
  - `armarSessionId(input: { codcli: string; anio: number; periodo: number; concepto: 'matricula' | 'arancel'; correlativo: number }): string`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { armarBuyOrder, armarSessionId } from './buy-order'

describe('armarBuyOrder', () => {
  it('une codcli, año, periodo y correlativo sin el carácter +', () => {
    assert.equal(
      armarBuyOrder({ codcli: '12345678', anio: 2027, periodo: 1, correlativo: 15 }),
      '123456782027-1-15',
    )
  })

  it('rechaza un codcli con DV o un periodo distinto de 1 o 2', () => {
    assert.throws(() =>
      armarBuyOrder({ codcli: '12345678-9', anio: 2027, periodo: 1, correlativo: 1 }),
    )
    assert.throws(() =>
      armarBuyOrder({ codcli: '12345678', anio: 2027, periodo: 3, correlativo: 1 }),
    )
  })

  it('rechaza una orden de más de 26 caracteres', () => {
    assert.throws(() =>
      armarBuyOrder({
        codcli: '12345678',
        anio: 2027,
        periodo: 1,
        correlativo: 100_000_000_000,
      }),
    )
  })
})

describe('armarSessionId', () => {
  it('incluye concepto y correlativo', () => {
    assert.equal(
      armarSessionId({
        codcli: '12345678',
        anio: 2027,
        periodo: 1,
        concepto: 'matricula',
        correlativo: 15,
      }),
      '12345678-2027-1-matricula-15',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `/opt/uniacc-api-docker`:

```bash
npx tsx --test src/services/webpay-plus/buy-order.test.ts
```

Expected: FAIL, cannot find module `./buy-order`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type ConceptoWebpay = 'matricula' | 'arancel'

export function armarBuyOrder(input: {
  codcli: string
  anio: number
  periodo: number
  correlativo: number
}): string {
  if (!/^\d{7,8}$/.test(input.codcli)) {
    throw new Error('codcli inválido')
  }
  if (!Number.isInteger(input.anio) || input.anio < 2020 || input.anio > 2099) {
    throw new Error('año inválido')
  }
  if (input.periodo !== 1 && input.periodo !== 2) {
    throw new Error('periodo inválido')
  }
  if (!Number.isInteger(input.correlativo) || input.correlativo < 1) {
    throw new Error('correlativo inválido')
  }
  const order = `${input.codcli}${input.anio}-${input.periodo}-${input.correlativo}`
  if (order.length > 26) {
    throw new Error('buy_order supera 26')
  }
  return order
}

export function armarSessionId(input: {
  codcli: string
  anio: number
  periodo: number
  concepto: ConceptoWebpay
  correlativo: number
}): string {
  if (input.concepto !== 'matricula' && input.concepto !== 'arancel') {
    throw new Error('concepto inválido')
  }
  const id = `${input.codcli}-${input.anio}-${input.periodo}-${input.concepto}-${input.correlativo}`
  if (id.length > 61) {
    throw new Error('session_id supera 61')
  }
  return id
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `/opt/uniacc-api-docker`:

```bash
npx tsx --test src/services/webpay-plus/buy-order.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/webpay-plus/buy-order.ts src/services/webpay-plus/buy-order.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): armar buy_order y session_id de Webpay Plus

EOF
)"
```

---

### Task 2: Clasificar el regreso de Transbank

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/webpay-plus/clasificar-retorno.ts`
- Test: `/opt/uniacc-api-docker/src/services/webpay-plus/clasificar-retorno.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `clasificarRetorno(params: { token_ws?: string; TBK_TOKEN?: string; TBK_ORDEN_COMPRA?: string; TBK_ID_SESION?: string }): ClasificacionRetorno`

```ts
export type ClasificacionRetorno =
  | { tipo: 'confirmar'; token: string }
  | { tipo: 'timeout'; buyOrder: string; sessionId: string }
  | { tipo: 'anulado'; token: string; buyOrder: string; sessionId: string }
  | { tipo: 'ambiguo'; token: string; buyOrder: string; sessionId: string }
  | { tipo: 'invalido' }
```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { clasificarRetorno } from './clasificar-retorno'

describe('clasificarRetorno', () => {
  it('confirma solo cuando llega token_ws', () => {
    assert.deepEqual(clasificarRetorno({ token_ws: 'abc' }), {
      tipo: 'confirmar',
      token: 'abc',
    })
  })

  it('trata el timeout como aborto sin token', () => {
    assert.deepEqual(
      clasificarRetorno({ TBK_ORDEN_COMPRA: 'orden', TBK_ID_SESION: 'sesion' }),
      { tipo: 'timeout', buyOrder: 'orden', sessionId: 'sesion' },
    )
  })

  it('no confirma cuando el alumno anula', () => {
    assert.deepEqual(
      clasificarRetorno({
        TBK_TOKEN: 'tok',
        TBK_ORDEN_COMPRA: 'orden',
        TBK_ID_SESION: 'sesion',
      }),
      { tipo: 'anulado', token: 'tok', buyOrder: 'orden', sessionId: 'sesion' },
    )
  })

  it('no confirma a ciegas si llegan token_ws y TBK_TOKEN', () => {
    assert.equal(
      clasificarRetorno({
        token_ws: 'abc',
        TBK_TOKEN: 'tok',
        TBK_ORDEN_COMPRA: 'orden',
        TBK_ID_SESION: 'sesion',
      }).tipo,
      'ambiguo',
    )
  })

  it('un token_ws vacío no es confirmar', () => {
    assert.equal(clasificarRetorno({ token_ws: '  ' }).tipo, 'invalido')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `/opt/uniacc-api-docker`:

```bash
npx tsx --test src/services/webpay-plus/clasificar-retorno.test.ts
```

Expected: FAIL, cannot find module `./clasificar-retorno`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type ClasificacionRetorno =
  | { tipo: 'confirmar'; token: string }
  | { tipo: 'timeout'; buyOrder: string; sessionId: string }
  | { tipo: 'anulado'; token: string; buyOrder: string; sessionId: string }
  | { tipo: 'ambiguo'; token: string; buyOrder: string; sessionId: string }
  | { tipo: 'invalido' }

function limpio(v: string | undefined): string | undefined {
  const t = v?.trim()
  return t ? t : undefined
}

export function clasificarRetorno(params: {
  token_ws?: string
  TBK_TOKEN?: string
  TBK_ORDEN_COMPRA?: string
  TBK_ID_SESION?: string
}): ClasificacionRetorno {
  const tokenWs = limpio(params.token_ws)
  const tbkToken = limpio(params.TBK_TOKEN)
  const buyOrder = limpio(params.TBK_ORDEN_COMPRA)
  const sessionId = limpio(params.TBK_ID_SESION)

  if (tokenWs && tbkToken && buyOrder && sessionId) {
    return { tipo: 'ambiguo', token: tbkToken, buyOrder, sessionId }
  }
  if (tokenWs && !tbkToken && !buyOrder && !sessionId) {
    return { tipo: 'confirmar', token: tokenWs }
  }
  if (!tokenWs && tbkToken && buyOrder && sessionId) {
    return { tipo: 'anulado', token: tbkToken, buyOrder, sessionId }
  }
  if (!tokenWs && !tbkToken && buyOrder && sessionId) {
    return { tipo: 'timeout', buyOrder, sessionId }
  }
  return { tipo: 'invalido' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `/opt/uniacc-api-docker`:

```bash
npx tsx --test src/services/webpay-plus/clasificar-retorno.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/webpay-plus/clasificar-retorno.ts src/services/webpay-plus/clasificar-retorno.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): clasificar el regreso de Webpay Plus

EOF
)"
```

---

### Task 3: Tabla en Supabase

**Files:**
- Create: `/opt/mol-docker/supabase/migrations/20261001120000_mnp_webpay_transaccion.sql`

**Interfaces:**
- Consumes: nada
- Produces: tabla `public.mnp_webpay_transaccion` y secuencia `public.mnp_webpay_transaccion_correlativo_seq`. La Task 6 lee `nextval` de esa secuencia.

- [ ] **Step 1: Write the migration**

```sql
CREATE SEQUENCE IF NOT EXISTS public.mnp_webpay_transaccion_correlativo_seq AS bigint;

CREATE TABLE IF NOT EXISTS public.mnp_webpay_transaccion (
  buy_order text PRIMARY KEY,
  session_id text NOT NULL,
  concepto text NOT NULL,
  codcli text NOT NULL,
  anio_periodo integer NOT NULL,
  semestre_periodo integer NOT NULL,
  correlativo bigint NOT NULL UNIQUE,
  monto integer NOT NULL,
  token text,
  estado text NOT NULL,
  authorization_code text,
  response_code integer,
  payment_type_code text,
  card_last4 text,
  transaction_date timestamptz,
  ambiente text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mnp_webpay_concepto_chk CHECK (concepto IN ('matricula', 'arancel')),
  CONSTRAINT mnp_webpay_estado_chk CHECK (estado IN ('creada', 'autorizada', 'rechazada', 'abortada')),
  CONSTRAINT mnp_webpay_periodo_chk CHECK (semestre_periodo IN (1, 2)),
  CONSTRAINT mnp_webpay_monto_chk CHECK (monto > 0),
  CONSTRAINT mnp_webpay_ambiente_chk CHECK (ambiente IN ('integracion', 'produccion'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mnp_webpay_token
  ON public.mnp_webpay_transaccion (token)
  WHERE token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mnp_webpay_alumno
  ON public.mnp_webpay_transaccion (codcli, anio_periodo, semestre_periodo, concepto, estado);

ALTER TABLE public.mnp_webpay_transaccion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_webpay_no_anon ON public.mnp_webpay_transaccion;
CREATE POLICY mnp_webpay_no_anon ON public.mnp_webpay_transaccion
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS mnp_webpay_no_auth ON public.mnp_webpay_transaccion;
CREATE POLICY mnp_webpay_no_auth ON public.mnp_webpay_transaccion
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE ON public.mnp_webpay_transaccion TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.mnp_webpay_transaccion_correlativo_seq TO service_role;
```

- [ ] **Step 2: Apply it on the dev database**

Run the SQL against the Supabase Postgres that ya usa MOL en dev (el mismo de `SUPABASE_PG_*` de `uniacc-api`). No lo apliques a producción.

Expected: la tabla existe y `\d public.mnp_webpay_transaccion` muestra `buy_order` como primary key.

- [ ] **Step 3: Commit**

```bash
cd /opt/mol-docker
git add supabase/migrations/20261001120000_mnp_webpay_transaccion.sql
git commit -m "$(cat <<'EOF'
feat(rematricula): tabla de transacciones Webpay Plus

EOF
)"
```

---

### Task 4: Cliente HTTP de Transbank

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/webpay-plus/transbank-client.ts`
- Test: `/opt/uniacc-api-docker/src/services/webpay-plus/transbank-client.test.ts`

**Interfaces:**
- Consumes: nada de Tasks 1–3
- Produces:

```ts
export type CommitWebpay = {
  amount: number
  status: string
  buyOrder: string
  sessionId: string
  authorizationCode: string | null
  paymentTypeCode: string | null
  responseCode: number
  cardLast4: string | null
  transactionDate: string | null
}

export type TransbankCliente = {
  crear(input: {
    buyOrder: string
    sessionId: string
    amount: number
    returnUrl: string
  }): Promise<{ token: string; url: string }>
  confirmar(token: string): Promise<CommitWebpay>
  estado(token: string): Promise<CommitWebpay>
}

export function crearClienteTransbank(opts: {
  host: string
  commerceCode: string
  apiKey: string
  fetchImpl: typeof fetch
}): TransbankCliente
```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { crearClienteTransbank } from './transbank-client'

describe('crearClienteTransbank', () => {
  it('crea con headers de comercio y no llama a producción', async () => {
    const llamadas: Array<{ url: string; init: RequestInit }> = []
    const fetchImpl: typeof fetch = async (url, init) => {
      llamadas.push({ url: String(url), init: init ?? {} })
      return new Response(JSON.stringify({ token: 'tok', url: 'https://webpay3gint.transbank.cl/webpayserver/initTransaction' }), {
        status: 200,
      })
    }
    const cliente = crearClienteTransbank({
      host: 'https://webpay3gint.transbank.cl',
      commerceCode: '597055555532',
      apiKey: 'llave-prueba',
      fetchImpl,
    })
    const res = await cliente.crear({
      buyOrder: '123456782027-1-15',
      sessionId: '12345678-2027-1-matricula-15',
      amount: 50000,
      returnUrl: 'https://mol-dev.uniacc.cl/api/rematricula/alumno/webpay/volver',
    })
    assert.equal(res.token, 'tok')
    assert.equal(llamadas[0].url, 'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions')
    const headers = new Headers(llamadas[0].init.headers)
    assert.equal(headers.get('Tbk-Api-Key-Id'), '597055555532')
    assert.equal(headers.get('Tbk-Api-Key-Secret'), 'llave-prueba')
    assert.equal(JSON.parse(String(llamadas[0].init.body)).amount, 50000)
  })

  it('confirma por PUT y mapea el monto', async () => {
    const fetchImpl: typeof fetch = async (url, init) => {
      assert.equal(init?.method, 'PUT')
      assert.match(String(url), /\/transactions\/tok$/)
      return new Response(
        JSON.stringify({
          amount: 50000,
          status: 'AUTHORIZED',
          buy_order: '123456782027-1-15',
          session_id: '12345678-2027-1-matricula-15',
          authorization_code: '1213',
          payment_type_code: 'VN',
          response_code: 0,
          card_detail: { card_number: '6623' },
          transaction_date: '2019-05-22T16:41:21.063Z',
        }),
        { status: 200 },
      )
    }
    const cliente = crearClienteTransbank({
      host: 'https://webpay3gint.transbank.cl',
      commerceCode: '597055555532',
      apiKey: 'llave-prueba',
      fetchImpl,
    })
    const commit = await cliente.confirmar('tok')
    assert.equal(commit.amount, 50000)
    assert.equal(commit.responseCode, 0)
    assert.equal(commit.cardLast4, '6623')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `/opt/uniacc-api-docker`:

```bash
npx tsx --test src/services/webpay-plus/transbank-client.test.ts
```

Expected: FAIL, cannot find module `./transbank-client`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type CommitWebpay = {
  amount: number
  status: string
  buyOrder: string
  sessionId: string
  authorizationCode: string | null
  paymentTypeCode: string | null
  responseCode: number
  cardLast4: string | null
  transactionDate: string | null
}

export type TransbankCliente = {
  crear(input: {
    buyOrder: string
    sessionId: string
    amount: number
    returnUrl: string
  }): Promise<{ token: string; url: string }>
  confirmar(token: string): Promise<CommitWebpay>
  estado(token: string): Promise<CommitWebpay>
}

type Json = Record<string, unknown>

function mapCommit(body: Json): CommitWebpay {
  const card = body.card_detail as { card_number?: string } | undefined
  return {
    amount: Number(body.amount),
    status: String(body.status ?? ''),
    buyOrder: String(body.buy_order ?? ''),
    sessionId: String(body.session_id ?? ''),
    authorizationCode: body.authorization_code != null ? String(body.authorization_code) : null,
    paymentTypeCode: body.payment_type_code != null ? String(body.payment_type_code) : null,
    responseCode: Number(body.response_code),
    cardLast4: card?.card_number ?? null,
    transactionDate: body.transaction_date != null ? String(body.transaction_date) : null,
  }
}

export function crearClienteTransbank(opts: {
  host: string
  commerceCode: string
  apiKey: string
  fetchImpl: typeof fetch
}): TransbankCliente {
  const root = `${opts.host.replace(/\/$/, '')}/rswebpaytransaction/api/webpay/v1.2/transactions`
  async function llamar(method: string, path: string, body?: Json): Promise<Json> {
    const res = await opts.fetchImpl(`${root}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Tbk-Api-Key-Id': opts.commerceCode,
        'Tbk-Api-Key-Secret': opts.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      throw new Error(`Transbank ${method} ${path} respondió ${res.status}`)
    }
    return (await res.json()) as Json
  }
  return {
    async crear(input) {
      const body = await llamar('POST', '', {
        buy_order: input.buyOrder,
        session_id: input.sessionId,
        amount: input.amount,
        return_url: input.returnUrl,
      })
      return { token: String(body.token), url: String(body.url) }
    },
    async confirmar(token) {
      return mapCommit(await llamar('PUT', `/${token}`))
    },
    async estado(token) {
      return mapCommit(await llamar('GET', `/${token}`))
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `/opt/uniacc-api-docker`:

```bash
npx tsx --test src/services/webpay-plus/transbank-client.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/webpay-plus/transbank-client.ts src/services/webpay-plus/transbank-client.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): cliente HTTP de Webpay Plus

EOF
)"
```

---

### Task 5: Servicio crear y volver, sin base real

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.service.ts`
- Test: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.service.test.ts`

**Interfaces:**
- Consumes: `armarBuyOrder`, `armarSessionId`, `ConceptoWebpay` (Task 1), `clasificarRetorno` (Task 2), `TransbankCliente`, `CommitWebpay` (Task 4)
- Produces:

```ts
export type FilaWebpay = {
  buyOrder: string
  sessionId: string
  concepto: ConceptoWebpay
  codcli: string
  anioPeriodo: number
  semestrePeriodo: 1 | 2
  correlativo: number
  monto: number
  token: string | null
  estado: 'creada' | 'autorizada' | 'rechazada' | 'abortada'
  authorizationCode: string | null
  responseCode: number | null
  paymentTypeCode: string | null
  cardLast4: string | null
  transactionDate: string | null
  ambiente: 'integracion' | 'produccion'
}

export type WebpayRepositorio = {
  hayAutorizada(codcli: string, anio: number, periodo: number, concepto: ConceptoWebpay): Promise<boolean>
  abortarCreadas(codcli: string, anio: number, periodo: number, concepto: ConceptoWebpay): Promise<void>
  insertarCreada(fila: FilaWebpay): Promise<void>
  siguienteCorrelativo(): Promise<number>
  guardarToken(buyOrder: string, token: string): Promise<void>
  marcarAbortada(buyOrder: string): Promise<void>
  buscarPorToken(token: string): Promise<FilaWebpay | null>
  buscarPorBuyOrder(buyOrder: string): Promise<FilaWebpay | null>
  buscarPorSessionId(sessionId: string): Promise<FilaWebpay | null>
  guardarCierre(buyOrder: string, estado: FilaWebpay['estado'], commit: CommitWebpay | null): Promise<void>
}

export async function crearTransaccion(
  input: { codcli: string; anio: number; periodo: 1 | 2; concepto: ConceptoWebpay; monto: number },
  deps: { repo: WebpayRepositorio; transbank: TransbankCliente; returnUrl: string; ambiente: 'integracion' | 'produccion' },
): Promise<{ ok: true; buyOrder: string; token: string; url: string } | { ok: false; error: string }>

export async function procesarVolver(
  params: { token_ws?: string; TBK_TOKEN?: string; TBK_ORDEN_COMPRA?: string; TBK_ID_SESION?: string },
  deps: { repo: WebpayRepositorio; transbank: TransbankCliente },
): Promise<{ buyOrder: string | null; estado: FilaWebpay['estado'] | null }>
```

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { TransbankCliente } from './transbank-client'
import {
  crearTransaccion,
  procesarVolver,
  type FilaWebpay,
  type WebpayRepositorio,
} from './webpay-plus.service'

function repoVacio(): WebpayRepositorio & { filas: FilaWebpay[] } {
  const filas: FilaWebpay[] = []
  let n = 15
  return {
    filas,
    async hayAutorizada(codcli, anio, periodo, concepto) {
      return filas.some(
        (f) =>
          f.codcli === codcli &&
          f.anioPeriodo === anio &&
          f.semestrePeriodo === periodo &&
          f.concepto === concepto &&
          f.estado === 'autorizada',
      )
    },
    async abortarCreadas(codcli, anio, periodo, concepto) {
      for (const f of filas) {
        if (
          f.codcli === codcli &&
          f.anioPeriodo === anio &&
          f.semestrePeriodo === periodo &&
          f.concepto === concepto &&
          f.estado === 'creada'
        ) {
          f.estado = 'abortada'
        }
      }
    },
    async insertarCreada(fila) {
      filas.push({ ...fila })
    },
    async siguienteCorrelativo() {
      n += 1
      return n
    },
    async guardarToken(buyOrder, token) {
      const f = filas.find((x) => x.buyOrder === buyOrder)
      if (f) f.token = token
    },
    async marcarAbortada(buyOrder) {
      const f = filas.find((x) => x.buyOrder === buyOrder)
      if (f && f.estado === 'creada') f.estado = 'abortada'
    },
    async buscarPorToken(token) {
      return filas.find((f) => f.token === token) ?? null
    },
    async buscarPorBuyOrder(buyOrder) {
      return filas.find((f) => f.buyOrder === buyOrder) ?? null
    },
    async buscarPorSessionId(sessionId) {
      return filas.find((f) => f.sessionId === sessionId) ?? null
    },
    async guardarCierre(buyOrder, estado, commit) {
      const f = filas.find((x) => x.buyOrder === buyOrder)
      if (!f) return
      f.estado = estado
      f.authorizationCode = commit?.authorizationCode ?? null
      f.responseCode = commit?.responseCode ?? null
      f.paymentTypeCode = commit?.paymentTypeCode ?? null
      f.cardLast4 = commit?.cardLast4 ?? null
      f.transactionDate = commit?.transactionDate ?? null
    },
  }
}

const depsBase = {
  returnUrl: 'https://mol-dev.uniacc.cl/api/rematricula/alumno/webpay/volver',
  ambiente: 'integracion' as const,
}

describe('crearTransaccion', () => {
  it('no abre otro cobro si el concepto ya está autorizado', async () => {
    const repo = repoVacio()
    repo.filas.push({
      buyOrder: '123456782027-1-15',
      sessionId: '12345678-2027-1-matricula-15',
      concepto: 'matricula',
      codcli: '12345678',
      anioPeriodo: 2027,
      semestrePeriodo: 1,
      correlativo: 15,
      monto: 50000,
      token: 'tok',
      estado: 'autorizada',
      authorizationCode: '1213',
      responseCode: 0,
      paymentTypeCode: 'VN',
      cardLast4: '6623',
      transactionDate: null,
      ambiente: 'integracion',
    })
    let llamadas = 0
    const transbank = {
      async crear() {
        llamadas += 1
        return { token: 'x', url: 'https://example.test' }
      },
      async confirmar() {
        throw new Error('no')
      },
      async estado() {
        throw new Error('no')
      },
    } satisfies TransbankCliente
    const res = await crearTransaccion(
      { codcli: '12345678', anio: 2027, periodo: 1, concepto: 'matricula', monto: 50000 },
      { ...depsBase, repo, transbank },
    )
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.error, 'ya-autorizada')
    assert.equal(llamadas, 0)
  })

  it('aborta la creada anterior y aborta la nueva si Transbank rechaza el create', async () => {
    const repo = repoVacio()
    repo.filas.push({
      buyOrder: '123456782027-1-15',
      sessionId: '12345678-2027-1-matricula-15',
      concepto: 'matricula',
      codcli: '12345678',
      anioPeriodo: 2027,
      semestrePeriodo: 1,
      correlativo: 15,
      monto: 50000,
      token: 'viejo',
      estado: 'creada',
      authorizationCode: null,
      responseCode: null,
      paymentTypeCode: null,
      cardLast4: null,
      transactionDate: null,
      ambiente: 'integracion',
    })
    const transbank = {
      async crear() {
        throw new Error('caído')
      },
      async confirmar() {
        throw new Error('no')
      },
      async estado() {
        throw new Error('no')
      },
    } satisfies TransbankCliente
    const res = await crearTransaccion(
      { codcli: '12345678', anio: 2027, periodo: 1, concepto: 'matricula', monto: 50000 },
      { ...depsBase, repo, transbank },
    )
    assert.equal(res.ok, false)
    assert.equal(repo.filas[0].estado, 'abortada')
    assert.equal(repo.filas[1].estado, 'abortada')
  })
})

describe('procesarVolver', () => {
  it('rechaza si el monto confirmado no coincide', async () => {
    const repo = repoVacio()
    repo.filas.push({
      buyOrder: '123456782027-1-15',
      sessionId: '12345678-2027-1-matricula-15',
      concepto: 'matricula',
      codcli: '12345678',
      anioPeriodo: 2027,
      semestrePeriodo: 1,
      correlativo: 15,
      monto: 50000,
      token: 'tok',
      estado: 'creada',
      authorizationCode: null,
      responseCode: null,
      paymentTypeCode: null,
      cardLast4: null,
      transactionDate: null,
      ambiente: 'integracion',
    })
    const transbank = {
      async crear() {
        return { token: 'tok', url: 'https://example.test' }
      },
      async confirmar() {
        return {
          amount: 1,
          status: 'AUTHORIZED',
          buyOrder: '123456782027-1-15',
          sessionId: '12345678-2027-1-matricula-15',
          authorizationCode: '1213',
          paymentTypeCode: 'VN',
          responseCode: 0,
          cardLast4: '6623',
          transactionDate: null,
        }
      },
      async estado() {
        throw new Error('no')
      },
    } satisfies TransbankCliente
    const res = await procesarVolver({ token_ws: 'tok' }, { repo, transbank })
    assert.equal(res.estado, 'rechazada')
  })

  it('no vuelve a confirmar si la fila ya está autorizada', async () => {
    const repo = repoVacio()
    repo.filas.push({
      buyOrder: '123456782027-1-15',
      sessionId: '12345678-2027-1-matricula-15',
      concepto: 'matricula',
      codcli: '12345678',
      anioPeriodo: 2027,
      semestrePeriodo: 1,
      correlativo: 15,
      monto: 50000,
      token: 'tok',
      estado: 'autorizada',
      authorizationCode: '1213',
      responseCode: 0,
      paymentTypeCode: 'VN',
      cardLast4: '6623',
      transactionDate: null,
      ambiente: 'integracion',
    })
    let confirmarLlamadas = 0
    const transbank = {
      async crear() {
        return { token: 'tok', url: 'https://example.test' }
      },
      async confirmar() {
        confirmarLlamadas += 1
        throw new Error('no')
      },
      async estado() {
        throw new Error('no')
      },
    } satisfies TransbankCliente
    const res = await procesarVolver({ token_ws: 'tok' }, { repo, transbank })
    assert.equal(res.estado, 'autorizada')
    assert.equal(confirmarLlamadas, 0)
  })

  it('el timeout no llama a confirmar', async () => {
    const repo = repoVacio()
    repo.filas.push({
      buyOrder: '123456782027-1-15',
      sessionId: '12345678-2027-1-matricula-15',
      concepto: 'matricula',
      codcli: '12345678',
      anioPeriodo: 2027,
      semestrePeriodo: 1,
      correlativo: 15,
      monto: 50000,
      token: 'tok',
      estado: 'creada',
      authorizationCode: null,
      responseCode: null,
      paymentTypeCode: null,
      cardLast4: null,
      transactionDate: null,
      ambiente: 'integracion',
    })
    let confirmarLlamadas = 0
    const transbank = {
      async crear() {
        return { token: 'tok', url: 'https://example.test' }
      },
      async confirmar() {
        confirmarLlamadas += 1
        throw new Error('no')
      },
      async estado() {
        throw new Error('no')
      },
    } satisfies TransbankCliente
    const res = await procesarVolver(
      { TBK_ORDEN_COMPRA: '123456782027-1-15', TBK_ID_SESION: '12345678-2027-1-matricula-15' },
      { repo, transbank },
    )
    assert.equal(res.estado, 'abortada')
    assert.equal(confirmarLlamadas, 0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `/opt/uniacc-api-docker`:

```bash
npx tsx --test src/services/webpay-plus/webpay-plus.service.test.ts
```

Expected: FAIL, cannot find module `./webpay-plus.service`.

- [ ] **Step 3: Write minimal implementation**

Reglas dentro de `crearTransaccion`:

1. Rechazar `monto` que no sea entero mayor que cero.
2. Si `hayAutorizada`, devolver `{ ok: false, error: 'ya-autorizada' }` sin llamar a Transbank.
3. `abortarCreadas` del mismo alumno, periodo y concepto.
4. `siguienteCorrelativo`, `armarBuyOrder`, `armarSessionId`, `insertarCreada` con `token: null` y `estado: 'creada'`.
5. Llamar a `transbank.crear`. Si lanza, `marcarAbortada` y devolver `{ ok: false, error: 'transbank-crear' }`.
6. `guardarToken` y devolver `{ ok: true, buyOrder, token, url }`.

Reglas dentro de `procesarVolver`:

1. `clasificarRetorno`.
2. `confirmar`: buscar por token. Si la fila ya no está `creada`, devolver su estado sin llamar a Transbank. Si está `creada`, llamar a `confirmar`. Si `confirmar` lanza, llamar a `estado`. Aceptar solo `AUTHORIZED`, `responseCode === 0` y `amount === fila.monto`. Si cumple, `guardarCierre` con `autorizada`. Si no, `guardarCierre` con `rechazada`. Si `estado` también lanza, devolver la fila como está.
3. `timeout`: buscar por `buyOrder` y, si está `creada`, `marcarAbortada`. No llamar a `confirmar`.
4. `anulado`: `estado(token)`. No llamar a `confirmar`. Si está `creada`, `marcarAbortada`.
5. `ambiguo`: `estado(token)`. No llamar a `confirmar`. Si el estado cumple la regla de autorizado y el monto coincide, `guardarCierre` `autorizada`. Si no y la fila está `creada`, `marcarAbortada`.
6. `invalido`: `{ buyOrder: null, estado: null }`.

- [ ] **Step 4: Run test to verify it passes**

Run from `/opt/uniacc-api-docker`:

```bash
npx tsx --test src/services/webpay-plus/webpay-plus.service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/webpay-plus/webpay-plus.service.ts src/services/webpay-plus/webpay-plus.service.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): crear y cerrar una transacción Webpay Plus

EOF
)"
```

---

### Task 6: Repositorio Postgres, rutas y ambiente

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.repo.ts`
- Create: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.config.ts`
- Create: `/opt/uniacc-api-docker/src/controllers/rematricula-alumno-webpay.controller.ts`
- Create: `/opt/uniacc-api-docker/src/routes/rematricula-alumno-webpay.routes.ts`
- Modify: `/opt/uniacc-api-docker/src/index.ts` (import y `app.use` junto a las rutas de alumno)
- Modify: `/opt/uniacc-api-docker/.env.docker.example`
- Test: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.config.test.ts`

**Interfaces:**
- Consumes: `WebpayRepositorio`, `crearTransaccion`, `procesarVolver` (Task 5), `crearClienteTransbank` (Task 4), `getSupabasePostgresClient` de `src/config/postgres-supabase.ts`
- Produces:
  - `POST /api/rematricula/alumno/webpay/crear` body `{ codcli, anio, periodo, concepto, monto }` → `{ ok, buyOrder, token, url }` o `{ ok: false, error }`
  - `GET|POST /api/rematricula/alumno/webpay/volver` lee `token_ws`, `TBK_TOKEN`, `TBK_ORDEN_COMPRA`, `TBK_ID_SESION` de query o body y responde `302` a `WEBPAY_PLUS_MOL_RETORNO?buy_order=`
  - `GET /api/rematricula/alumno/webpay/transaccion?buy_order=` → la fila, sin el `token`
  - `leerConfigWebpay(): { ambiente: 'integracion' | 'produccion'; host: string; commerceCode: string; apiKey: string; volverUrl: string; molRetorno: string }`

- [ ] **Step 1: Write the failing config test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { leerConfigWebpay } from './webpay-plus.config'

describe('leerConfigWebpay', () => {
  it('en integración no usa el código de producción', () => {
    const cfg = leerConfigWebpay({
      WEBPAY_PLUS_AMBIENTE: 'integracion',
      WEBPAY_PLUS_HOST: 'https://webpay3gint.transbank.cl',
      WEBPAY_PLUS_COMMERCE_CODE: '597055555532',
      WEBPAY_PLUS_API_KEY: 'llave-prueba',
      WEBPAY_PLUS_COMMERCE_CODE_PRODUCCION: '597053102249',
      WEBPAY_PLUS_VOLVER_URL: 'https://mol-dev.uniacc.cl/api/rematricula/alumno/webpay/volver',
      WEBPAY_PLUS_MOL_RETORNO: 'https://mol-dev.uniacc.cl/dashboard/matricula-alumno/webpay/retorno',
    })
    assert.equal(cfg.commerceCode, '597055555532')
    assert.equal(cfg.host, 'https://webpay3gint.transbank.cl')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `/opt/uniacc-api-docker`:

```bash
npx tsx --test src/services/webpay-plus/webpay-plus.config.test.ts
```

Expected: FAIL, cannot find module `./webpay-plus.config`.

- [ ] **Step 3: Implement config, repo, routes and env**

`leerConfigWebpay` lee `process.env` si no recibe el objeto. Si `ambiente` es `integracion`, `commerceCode` es `WEBPAY_PLUS_COMMERCE_CODE` y el host tiene que ser `webpay3gint`. Si alguien pone `597053102249` en `WEBPAY_PLUS_COMMERCE_CODE` con ambiente `integracion`, lanzar. `597053102249` solo se lee de `WEBPAY_PLUS_COMMERCE_CODE_PRODUCCION` cuando `ambiente` es `produccion`.

El repo usa una transacción (`BEGIN` / `COMMIT` / `ROLLBACK`) con `getSupabasePostgresClient()`:

- `hayAutorizada`: `SELECT 1 FROM mnp_webpay_transaccion WHERE codcli=$1 AND anio_periodo=$2 AND semestre_periodo=$3 AND concepto=$4 AND estado='autorizada'`.
- `abortarCreadas`: `UPDATE ... SET estado='abortada', actualizado_en=now() WHERE ... AND estado='creada'`.
- `siguienteCorrelativo`: `SELECT nextval('mnp_webpay_transaccion_correlativo_seq')`.
- `insertarCreada`: `INSERT` de todas las columnas de `FilaWebpay`.
- `guardarCierre` escribe `authorization_code`, `response_code`, `payment_type_code`, `card_last4`, `transaction_date` y `estado`.

En `src/index.ts`, junto a `app.use('/api/rematricula/alumno', rematriculaAlumnoRoutes)`, montar el router nuevo en el mismo prefijo. `express.urlencoded` ya está en la línea 64. No lo dupliques.

`volver` arma los params con query y body (el body pisa a la query si ambos traen la clave). Redirige a `WEBPAY_PLUS_MOL_RETORNO`. Si hay `buyOrder`, lo pone en `buy_order`. Si la clasificación fue `invalido`, agrega `error=retorno-invalido`.

`GET transaccion` devuelve la fila sin `token`.

En `.env.docker.example` agrega, sin pegar la llave pública:

```bash
# Webpay Plus. integracion no usa el código de producción.
WEBPAY_PLUS_AMBIENTE=integracion
WEBPAY_PLUS_HOST=https://webpay3gint.transbank.cl
WEBPAY_PLUS_COMMERCE_CODE=597055555532
WEBPAY_PLUS_API_KEY=
WEBPAY_PLUS_COMMERCE_CODE_PRODUCCION=597053102249
WEBPAY_PLUS_VOLVER_URL=https://mol-dev.uniacc.cl/api/rematricula/alumno/webpay/volver
WEBPAY_PLUS_MOL_RETORNO=https://mol-dev.uniacc.cl/dashboard/matricula-alumno/webpay/retorno
```

La llave de integración se copia desde la documentación de Transbank al `.env` del servidor. No se commitea.

- [ ] **Step 4: Run test to verify it passes**

Run from `/opt/uniacc-api-docker`:

```bash
npx tsx --test src/services/webpay-plus/webpay-plus.config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/webpay-plus/webpay-plus.repo.ts src/services/webpay-plus/webpay-plus.config.ts src/services/webpay-plus/webpay-plus.config.test.ts src/controllers/rematricula-alumno-webpay.controller.ts src/routes/rematricula-alumno-webpay.routes.ts src/index.ts .env.docker.example
git commit -m "$(cat <<'EOF'
feat(rematricula): rutas de Webpay Plus contra Supabase

EOF
)"
```

---

### Task 7: Paso siguiente en MOL

**Files:**
- Create: `/opt/mol-docker/src/utils/webpaySiguientePaso.ts`
- Test: `/opt/mol-docker/src/utils/webpaySiguientePaso.test.ts`

**Interfaces:**
- Consumes: nada del API
- Produces:

```ts
export type MedioConcepto = 'webpay' | 'pagare'
export type PasoWebpay =
  | { tipo: 'flujo-pagare' }
  | { tipo: 'webpay'; concepto: 'matricula' | 'arancel' }
  | { tipo: 'plan-pagare'; concepto: 'matricula' | 'arancel' }
  | { tipo: 'firma' }

export function siguientePaso(input: {
  medioMatricula: MedioConcepto
  medioArancel: MedioConcepto
  matriculaAutorizada: boolean
  arancelAutorizado: boolean
  planListo: boolean
}): PasoWebpay
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { siguientePaso } from '@/utils/webpaySiguientePaso'

const base = {
  matriculaAutorizada: false,
  arancelAutorizado: false,
  planListo: false,
}

describe('siguientePaso', () => {
  it('los dos pagaré usan el flujo actual', () => {
    expect(
      siguientePaso({ ...base, medioMatricula: 'pagare', medioArancel: 'pagare' }).tipo,
    ).toBe('flujo-pagare')
  })

  it('matrícula Webpay va a Transbank antes del plan de arancel', () => {
    expect(
      siguientePaso({ ...base, medioMatricula: 'webpay', medioArancel: 'pagare' }),
    ).toEqual({ tipo: 'webpay', concepto: 'matricula' })
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: 'pagare',
        matriculaAutorizada: true,
      }),
    ).toEqual({ tipo: 'plan-pagare', concepto: 'arancel' })
  })

  it('arancel Webpay va a Transbank antes del plan de matrícula', () => {
    expect(
      siguientePaso({ ...base, medioMatricula: 'pagare', medioArancel: 'webpay' }),
    ).toEqual({ tipo: 'webpay', concepto: 'arancel' })
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'pagare',
        medioArancel: 'webpay',
        arancelAutorizado: true,
      }),
    ).toEqual({ tipo: 'plan-pagare', concepto: 'matricula' })
  })

  it('los dos Webpay cobran matrícula y solo después el arancel', () => {
    expect(
      siguientePaso({ ...base, medioMatricula: 'webpay', medioArancel: 'webpay' }),
    ).toEqual({ tipo: 'webpay', concepto: 'matricula' })
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: 'webpay',
        matriculaAutorizada: true,
      }),
    ).toEqual({ tipo: 'webpay', concepto: 'arancel' })
    expect(
      siguientePaso({
        ...base,
        medioMatricula: 'webpay',
        medioArancel: 'webpay',
        matriculaAutorizada: true,
        arancelAutorizado: true,
      }),
    ).toEqual({ tipo: 'firma' })
  })

  it('después del plan de pagaré pasa a la firma', () => {
    expect(
      siguientePaso({
        medioMatricula: 'webpay',
        medioArancel: 'pagare',
        matriculaAutorizada: true,
        arancelAutorizado: false,
        planListo: true,
      }),
    ).toEqual({ tipo: 'firma' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `/opt/mol-docker`:

```bash
npx vitest run src/utils/webpaySiguientePaso.test.ts
```

Expected: FAIL, cannot resolve `@/utils/webpaySiguientePaso`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type MedioConcepto = 'webpay' | 'pagare'
export type PasoWebpay =
  | { tipo: 'flujo-pagare' }
  | { tipo: 'webpay'; concepto: 'matricula' | 'arancel' }
  | { tipo: 'plan-pagare'; concepto: 'matricula' | 'arancel' }
  | { tipo: 'firma' }

export function siguientePaso(input: {
  medioMatricula: MedioConcepto
  medioArancel: MedioConcepto
  matriculaAutorizada: boolean
  arancelAutorizado: boolean
  planListo: boolean
}): PasoWebpay {
  if (input.medioMatricula === 'pagare' && input.medioArancel === 'pagare') {
    return input.planListo ? { tipo: 'firma' } : { tipo: 'flujo-pagare' }
  }
  if (input.medioMatricula === 'webpay' && !input.matriculaAutorizada) {
    return { tipo: 'webpay', concepto: 'matricula' }
  }
  if (input.medioArancel === 'webpay' && !input.arancelAutorizado) {
    return { tipo: 'webpay', concepto: 'arancel' }
  }
  if (input.medioMatricula === 'pagare' || input.medioArancel === 'pagare') {
    if (!input.planListo) {
      return {
        tipo: 'plan-pagare',
        concepto: input.medioMatricula === 'pagare' ? 'matricula' : 'arancel',
      }
    }
  }
  return { tipo: 'firma' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `/opt/mol-docker`:

```bash
npx vitest run src/utils/webpaySiguientePaso.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd /opt/mol-docker
git add src/utils/webpaySiguientePaso.ts src/utils/webpaySiguientePaso.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): ordenar Webpay y pagaré en la matrícula

EOF
)"
```

---

### Task 8: Pantalla de regreso

**Files:**
- Create: `/opt/mol-docker/src/services/webpayPlusApi.ts`
- Create: `/opt/mol-docker/src/views/matricula-alumno/WebpayRetornoAlumnoView.vue`
- Modify: `/opt/mol-docker/src/router/index.ts` (hijo de `matricula-alumno` y el `beforeEach` de alumno)
- Modify: `/opt/mol-docker/src/stores/matriculaAlumnoContext.ts`

**Interfaces:**
- Consumes: `GET /api/rematricula/alumno/webpay/transaccion` y `POST /api/rematricula/alumno/webpay/crear` (Task 6), `siguientePaso` (Task 7), `admisionApiBaseUrl` de `src/constants/admisionApi.ts`
- Produces:
  - `crearWebpay(input): Promise<{ ok: true; buyOrder: string; token: string; url: string } | { ok: false; error: string }>`
  - `obtenerWebpay(buyOrder: string): Promise<FilaPublica | null>`
  - `redirigirAWebpay(url: string, token: string): void`
  - ruta `matricula-alumno-webpay-retorno`
  - en el store: `medioMatricula`, `medioArancel`, `webpayMatriculaEstado`, `webpayArancelEstado` (`null | 'autorizada' | 'rechazada' | 'abortada'`), persistidos en el mismo `sessionStorage` que el resto del contexto

- [ ] **Step 1: Add the route and keep the guard from swallowing it**

En los children de `path: 'matricula-alumno'`:

```ts
{
  path: 'webpay/retorno',
  name: 'matricula-alumno-webpay-retorno',
  component: () => import('../views/matricula-alumno/WebpayRetornoAlumnoView.vue'),
},
```

En el `beforeEach`, la rama `isAlumnoFlowRoute` no debe mandar esta ruta a datos, a forma de pago ni a resumen por bloqueo o por firma ya hecha. Agrega `to.name !== 'matricula-alumno-webpay-retorno'` a esas condiciones. El login ya conserva `redirect: to.fullPath`, así que `buy_order` sobrevive si la sesión no está.

- [ ] **Step 2: Implement the API helper**

`crearWebpay` hace `POST` a `${admisionApiBaseUrl()}/api/rematricula/alumno/webpay/crear`. `obtenerWebpay` hace `GET` con `buy_order`. `redirigirAWebpay` crea un `<form method="POST">` hacia `url` con un input hidden `token_ws` y lo envía.

- [ ] **Step 3: Implement the return view**

`<script setup lang="ts">`. Al montar, lee `buy_order` o `error` de la query. Si no hay sesión, el guard ya mandó al login con `redirect`. Con `buy_order`, llama a `obtenerWebpay` y guarda el estado del concepto en el store. Textos:

- `autorizada`: «El pago quedó autorizado.» y llama a `siguientePaso`. Si el paso es `webpay`, llama a `crearWebpay` con el neto del otro concepto (lo lee del store; Task 9 lo habrá guardado) y `redirigirAWebpay`. Si el paso es `plan-pagare`, `router.push` a `matricula-alumno-forma-pago` con query `plan=matricula` o `plan=arancel`. Si el paso es `firma`, `router.push` a `matricula-alumno-firma`.
- `rechazada` o `abortada`: «El pago no se completó.» y un botón que vuelve a `matricula-alumno-forma-pago` para reintentar ese concepto.
- `error=retorno-invalido`: «No pudimos leer el resultado del pago.» y el mismo botón.

No llames a Transbank desde esta vista.

- [ ] **Step 4: Extend the store**

Agrega los cuatro campos al `state`, a `StoredAlumnoMatriculaContext`, a `persistToSessionStorage` y a la hidratación. Al hidratar, acepta solo `'webpay' | 'pagare'` y solo los tres estados. Un valor desconocido queda `null`.

- [ ] **Step 5: Type-check**

Run from `/opt/mol-docker`:

```bash
npx vue-tsc --noEmit --pretty false
```

Expected: sin errores nuevos en los archivos de esta tarea.

- [ ] **Step 6: Commit**

```bash
cd /opt/mol-docker
git add src/services/webpayPlusApi.ts src/views/matricula-alumno/WebpayRetornoAlumnoView.vue src/router/index.ts src/stores/matriculaAlumnoContext.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): pantalla de regreso de Webpay Plus

EOF
)"
```

---

### Task 9: Elegir Webpay en el diálogo real

**Files:**
- Modify: `/opt/mol-docker/src/views/matricula-alumno/FormaPagoAlumnoView.vue`

**Interfaces:**
- Consumes: `siguientePaso` (Task 7), `crearWebpay`, `redirigirAWebpay` (Task 8), montos `montoNetoMatricula()` y `montoNetoArancel()` que ya calcula esta vista, store de Task 8
- Produces: el botón Continuar del diálogo deja de exigir que ambos medios sean pagaré

- [ ] **Step 1: Allow Webpay on each concept**

Cambia `type MedioPagoConcepto = 'pagare'` a `'pagare' | 'webpay'`. En las secciones Matrícula y Arancel del diálogo (`pagoMatriculaPaso === 'selector'`), agrega un botón Webpay al lado del de Pagaré. `aria-pressed` compara con `'webpay'`. El check naranja se muestra solo en el medio elegido. Quita la asignación fija `medioPagoMatricula.value = 'pagare'` al abrir el diálogo; deja ambos en `null` para que el alumno elija.

- [ ] **Step 2: Replace the "próximamente" gate**

En `continuarSelectorMedios`, borra el bloque que muestra el toast «Por ahora solo está disponible Pagaré». Guarda los dos medios en el store. Calcula:

```ts
const paso = siguientePaso({
  medioMatricula: medioPagoMatricula.value!,
  medioArancel: medioPagoArancel.value!,
  matriculaAutorizada: alumnoCtx.webpayMatriculaEstado === 'autorizada',
  arancelAutorizado: alumnoCtx.webpayArancelEstado === 'autorizada',
  planListo: false,
})
```

- Si `paso.tipo === 'flujo-pagare'`, sigue el camino actual hacia `pagoMatriculaPaso = 'pagare'` con los dos conceptos.
- Si `paso.tipo === 'webpay'`, el monto es `montoNetoMatricula()` o `montoNetoArancel()` según `paso.concepto`. Si el monto no es un entero mayor que cero, toast de error y no llames al API. Si `crearWebpay` devuelve `ok`, `redirigirAWebpay`. Si no, toast con `error`.
- Si `paso.tipo === 'plan-pagare'`, abre el paso de cuotas mostrando solo ese concepto. Envuelve el bloque de cuotas de matrícula con `v-if="medioPagoMatricula === 'pagare'"` y el de arancel con `v-if="medioPagoArancel === 'pagare'"`.
- Al confirmar el plan, navega a la firma solo si `siguientePaso` con `planListo: true` devuelve `firma`.

`codcli`, `anio` y `periodo` salen del mismo contexto que ya usa el preflight de esta vista (RUT sin DV, año y periodo de matrícula). No inventes otra fuente.

- [ ] **Step 3: Type-check**

Run from `/opt/mol-docker`:

```bash
npx vue-tsc --noEmit --pretty false
```

Expected: sin errores nuevos en `FormaPagoAlumnoView.vue`.

- [ ] **Step 4: Commit**

```bash
cd /opt/mol-docker
git add src/views/matricula-alumno/FormaPagoAlumnoView.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): ofrecer Webpay en matrícula y arancel

EOF
)"
```

---

### Task 10: Prueba manual en integración

**Files:**
- Modify: ninguno

**Interfaces:**
- Consumes: el flujo completo de Tasks 1–9 contra `https://webpay3gint.transbank.cl`

- [ ] **Step 1: Pago autorizado de matrícula y plan de arancel**

En `https://mol-dev.uniacc.cl`, con un alumno de prueba, elige matrícula Webpay y arancel pagaré. Usa una tarjeta de prueba de aprobación de la [documentación de Webpay Plus](https://www.transbankdevelopers.cl/documentacion/webpay-plus). Al volver, la fila `matricula` está `autorizada` y MOL abre solo las cuotas del arancel.

- [ ] **Step 2: Rechazo y anulación**

Repite con la tarjeta de rechazo de esa documentación. La fila queda `rechazada` y no se abre el plan. En otro intento, anula en el formulario de Webpay. La fila queda `abortada`, no hay `PUT` de confirmar en el log del API, y la matrícula de un intento anterior `autorizada` sigue `autorizada`.

- [ ] **Step 3: Los dos por Webpay**

Elige Webpay en los dos. La primera orden es la matrícula. Solo después de `autorizada` MOL redirige al arancel. La firma aparece cuando las dos filas están `autorizada`.

No automatices esta tarea en CI.
