# Webpay QA pública (sin login) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer en MOL una URL pública `/webpay-qa` que cree una transacción Webpay Plus de integración, redirija a Transbank y al volver muestre token y estado, sin login ni flujo de rematrícula.

**Architecture:** Endpoints nuevos `/api/webpay-qa/*` en `uniacc-api` reutilizan `crearTransaccion` / `procesarVolver` / repo existente, con `returnUrl` y redirect propios. Solo responden si `WEBPAY_PLUS_AMBIENTE=integracion`. MOL agrega dos rutas Vue fuera de `/dashboard` y un cliente HTTP mínimo.

**Tech Stack:** Express + TypeScript (`uniacc-api-docker`), Vue 3 + Composition API + Vue Router (`mol-docker`), tabla `mnp_webpay_transaccion` ya existente.

**Spec:** [`docs/superpowers/specs/2026-10-18-webpay-qa-publica-design.md`](../specs/2026-10-18-webpay-qa-publica-design.md)

## Global Constraints

- Solo ambiente `integracion`; en `produccion` los endpoints QA responden 404.
- No modificar el flujo del alumno (`/api/rematricula/alumno/webpay/*` ni vistas bajo `matricula-alumno`).
- `codcli` default QA: `99999999` (7–8 dígitos numéricos).
- Defaults de período si no vienen en el body: `anio=2027`, `periodo=1`.
- No commit de secretos ni de `.env`.
- Commits solo en los archivos de cada task; no incluir dirty files ajenos.
- Respuestas al usuario en español.

## File map

| Archivo | Responsabilidad |
| --- | --- |
| `uniacc-api-docker/src/services/webpay-plus/webpay-plus.config.ts` | Leer `WEBPAY_PLUS_QA_VOLVER_URL` y `WEBPAY_PLUS_QA_MOL_RETORNO` |
| `uniacc-api-docker/src/services/webpay-plus/webpay-qa-gate.ts` | `exigirIntegracion()` → void o error 404 |
| `uniacc-api-docker/src/controllers/webpay-qa.controller.ts` | crear / volver / transaccion QA |
| `uniacc-api-docker/src/routes/webpay-qa.routes.ts` | Montar rutas |
| `uniacc-api-docker/src/index.ts` | `app.use('/api/webpay-qa', ...)` |
| `uniacc-api-docker/.env.docker.example` | Documentar vars QA |
| `mol-docker/src/services/webpayQaApi.ts` | Cliente crear + obtener (con token en QA) |
| `mol-docker/src/views/webpay-qa/WebpayQaView.vue` | Formulario público |
| `mol-docker/src/views/webpay-qa/WebpayQaRetornoView.vue` | Resultado + copiar token |
| `mol-docker/src/router/index.ts` | Rutas públicas |

---

### Task 1: Config y gate de integración (API)

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.config.ts`
- Create: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-qa-gate.ts`
- Create: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-qa-gate.test.ts`
- Modify: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.config.test.ts`
- Modify: `/opt/uniacc-api-docker/.env.docker.example`

**Interfaces:**
- Consumes: `leerConfigWebpay` actual
- Produces: `ConfigWebpay` con `qaVolverUrl: string` y `qaMolRetorno: string`; `exigirIntegracion(ambiente): void` lanza `WebpayQaNoDisponibleError` si no es integración

- [ ] **Step 1: Extender tipos y lectura de config**

En `webpay-plus.config.ts`, agregar a `ConfigWebpay` y `EnvWebpay`:

```ts
// ConfigWebpay
qaVolverUrl: string
qaMolRetorno: string

// EnvWebpay
WEBPAY_PLUS_QA_VOLVER_URL?: string
WEBPAY_PLUS_QA_MOL_RETORNO?: string
```

En ambos returns de `leerConfigWebpay` (integración y producción), agregar:

```ts
qaVolverUrl: requerido('WEBPAY_PLUS_QA_VOLVER_URL', cfgEnv.WEBPAY_PLUS_QA_VOLVER_URL),
qaMolRetorno: requerido('WEBPAY_PLUS_QA_MOL_RETORNO', cfgEnv.WEBPAY_PLUS_QA_MOL_RETORNO),
```

- [ ] **Step 2: Actualizar test de config**

En `webpay-plus.config.test.ts`, incluir en el objeto de env de prueba:

```ts
WEBPAY_PLUS_QA_VOLVER_URL: 'https://mol.uniacc.cl/api/webpay-qa/volver',
WEBPAY_PLUS_QA_MOL_RETORNO: 'https://mol.uniacc.cl/webpay-qa/retorno',
```

Y asserts:

```ts
assert.equal(cfg.qaVolverUrl, 'https://mol.uniacc.cl/api/webpay-qa/volver')
assert.equal(cfg.qaMolRetorno, 'https://mol.uniacc.cl/webpay-qa/retorno')
```

- [ ] **Step 3: Gate de integración**

Crear `webpay-qa-gate.ts`:

```ts
export class WebpayQaNoDisponibleError extends Error {
  readonly status = 404
  constructor() {
    super('webpay-qa-no-disponible')
    this.name = 'WebpayQaNoDisponibleError'
  }
}

export function exigirIntegracion(ambiente: 'integracion' | 'produccion'): void {
  if (ambiente !== 'integracion') {
    throw new WebpayQaNoDisponibleError()
  }
}
```

- [ ] **Step 4: Test del gate**

Crear `webpay-qa-gate.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exigirIntegracion, WebpayQaNoDisponibleError } from './webpay-qa-gate'

test('integracion no lanza', () => {
  assert.doesNotThrow(() => exigirIntegracion('integracion'))
})

test('produccion lanza 404', () => {
  assert.throws(() => exigirIntegracion('produccion'), (e: unknown) => {
    return e instanceof WebpayQaNoDisponibleError && e.status === 404
  })
})
```

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/webpay-plus/webpay-qa-gate.test.ts src/services/webpay-plus/webpay-plus.config.test.ts`  
Expected: PASS

- [ ] **Step 5: Documentar env**

En `.env.docker.example`, debajo de las vars Webpay existentes:

```
WEBPAY_PLUS_QA_VOLVER_URL=https://mol.uniacc.cl/api/webpay-qa/volver
WEBPAY_PLUS_QA_MOL_RETORNO=https://mol.uniacc.cl/webpay-qa/retorno
```

- [ ] **Step 6: Commit (API)**

```bash
cd /opt/uniacc-api-docker
git add src/services/webpay-plus/webpay-plus.config.ts \
  src/services/webpay-plus/webpay-plus.config.test.ts \
  src/services/webpay-plus/webpay-qa-gate.ts \
  src/services/webpay-plus/webpay-qa-gate.test.ts \
  .env.docker.example
git commit -m "$(cat <<'EOF'
feat(webpay-qa): config y gate solo en integración

EOF
)"
```

---

### Task 2: Controller, rutas y montaje (API)

**Files:**
- Create: `/opt/uniacc-api-docker/src/controllers/webpay-qa.controller.ts`
- Create: `/opt/uniacc-api-docker/src/routes/webpay-qa.routes.ts`
- Modify: `/opt/uniacc-api-docker/src/index.ts`

**Interfaces:**
- Consumes: `leerConfigWebpay`, `exigirIntegracion`, `crearTransaccion`, `procesarVolver`, `clasificarRetorno`, `crearRepositorioWebpay`, `crearClienteTransbank`
- Produces:  
  - `POST /api/webpay-qa/crear` body `{ monto, concepto, codcli?, anio?, periodo? }` → `{ ok, buyOrder, token, url }`  
  - `GET|POST /api/webpay-qa/volver` → 302 a `qaMolRetorno?buy_order=`  
  - `GET /api/webpay-qa/transaccion?buy_order=` → fila pública **incluyendo** `token` (solo QA)

- [ ] **Step 1: Controller**

Crear `webpay-qa.controller.ts` reutilizando el patrón de `rematricula-alumno-webpay.controller.ts`:

```ts
import type { Request, Response } from 'express'
import type { ConceptoWebpay } from '../services/webpay-plus/buy-order'
import { clasificarRetorno } from '../services/webpay-plus/clasificar-retorno'
import { crearClienteTransbank } from '../services/webpay-plus/transbank-client'
import { leerConfigWebpay } from '../services/webpay-plus/webpay-plus.config'
import { crearRepositorioWebpay } from '../services/webpay-plus/webpay-plus.repo'
import { crearTransaccion, procesarVolver } from '../services/webpay-plus/webpay-plus.service'
import { exigirIntegracion, WebpayQaNoDisponibleError } from '../services/webpay-plus/webpay-qa-gate'

const CODCLI_QA_DEFAULT = '99999999'
const ANIO_QA_DEFAULT = 2027
const PERIODO_QA_DEFAULT = 1 as const

// primerString + paramsVolver: copiar igual que rematricula-alumno-webpay.controller.ts

function depsWebpay() {
  const cfg = leerConfigWebpay()
  exigirIntegracion(cfg.ambiente)
  const repo = crearRepositorioWebpay()
  const transbank = crearClienteTransbank({
    host: cfg.host,
    commerceCode: cfg.commerceCode,
    apiKey: cfg.apiKey,
    fetchImpl: fetch,
  })
  return { cfg, repo, transbank }
}

function responderError(res: Response, error: unknown): void {
  if (error instanceof WebpayQaNoDisponibleError) {
    res.status(404).json({ ok: false, error: error.message })
    return
  }
  console.error('Error Webpay QA:', error)
  res.status(500).json({
    ok: false,
    error: error instanceof Error ? error.message : 'Error interno',
  })
}

export async function crearWebpayQaHttp(req: Request, res: Response): Promise<void> {
  const concepto = req.body?.concepto
  const monto = Number(req.body?.monto)
  const codcli = String(req.body?.codcli ?? CODCLI_QA_DEFAULT).trim() || CODCLI_QA_DEFAULT
  const anio = Number(req.body?.anio ?? ANIO_QA_DEFAULT)
  const periodo = Number(req.body?.periodo ?? PERIODO_QA_DEFAULT)
  if (
    (concepto !== 'matricula' && concepto !== 'arancel') ||
    !Number.isInteger(monto) ||
    monto <= 0 ||
    !/^\d{7,8}$/.test(codcli) ||
    !Number.isInteger(anio) ||
    (periodo !== 1 && periodo !== 2)
  ) {
    res.status(400).json({ ok: false, error: 'params-invalidos' })
    return
  }
  try {
    const { cfg, repo, transbank } = depsWebpay()
    const result = await crearTransaccion(
      { codcli, anio, periodo: periodo as 1 | 2, concepto: concepto as ConceptoWebpay, monto },
      { repo, transbank, returnUrl: cfg.qaVolverUrl, ambiente: cfg.ambiente },
    )
    if (!result.ok) {
      res.status(400).json(result)
      return
    }
    res.json(result)
  } catch (error) {
    responderError(res, error)
  }
}

export async function volverWebpayQaHttp(req: Request, res: Response): Promise<void> {
  const params = paramsVolver(req)
  try {
    const { cfg, repo, transbank } = depsWebpay()
    const clasificacion = clasificarRetorno(params)
    const result = await procesarVolver(params, { repo, transbank })
    const destino = new URL(cfg.qaMolRetorno)
    if (result.buyOrder) destino.searchParams.set('buy_order', result.buyOrder)
    if (clasificacion.tipo === 'invalido') destino.searchParams.set('error', 'retorno-invalido')
    res.redirect(302, destino.toString())
  } catch (error) {
    if (error instanceof WebpayQaNoDisponibleError) {
      res.status(404).json({ ok: false, error: error.message })
      return
    }
    const fallback = process.env.WEBPAY_PLUS_QA_MOL_RETORNO?.trim()
    if (fallback) {
      try {
        const destino = new URL(fallback)
        destino.searchParams.set('error', 'retorno-invalido')
        res.redirect(302, destino.toString())
        return
      } catch { /* ignore */ }
    }
    responderError(res, error)
  }
}

export async function transaccionWebpayQaHttp(req: Request, res: Response): Promise<void> {
  const buyOrder = primerString(req.query.buy_order)?.trim() ?? ''
  if (!buyOrder) {
    res.status(400).json({ ok: false, error: 'buy-order-requerido' })
    return
  }
  try {
    const cfg = leerConfigWebpay()
    exigirIntegracion(cfg.ambiente)
    const fila = await crearRepositorioWebpay().buscarPorBuyOrder(buyOrder)
    if (!fila) {
      res.status(404).json({ ok: false, error: 'no-encontrada' })
      return
    }
    // QA: incluir token de creación para el portal de Transbank
    res.json({ ok: true, ...fila })
  } catch (error) {
    responderError(res, error)
  }
}
```

- [ ] **Step 2: Routes**

Crear `webpay-qa.routes.ts`:

```ts
import { Router } from 'express'
import {
  crearWebpayQaHttp,
  transaccionWebpayQaHttp,
  volverWebpayQaHttp,
} from '../controllers/webpay-qa.controller'

const router = Router()
router.post('/crear', crearWebpayQaHttp)
router.get('/volver', volverWebpayQaHttp)
router.post('/volver', volverWebpayQaHttp)
router.get('/transaccion', transaccionWebpayQaHttp)
export default router
```

- [ ] **Step 3: Montar en index**

En `src/index.ts`:

```ts
import webpayQaRoutes from './routes/webpay-qa.routes'
// ...
app.use('/api/webpay-qa', webpayQaRoutes)
```

Log opcional al arrancar: `Webpay QA: /api/webpay-qa (solo integración)`.

- [ ] **Step 4: Smoke local (crear con ambiente integración)**

Asegurar en `.env` (no commitear):

```
WEBPAY_PLUS_QA_VOLVER_URL=https://mol.uniacc.cl/api/webpay-qa/volver
WEBPAY_PLUS_QA_MOL_RETORNO=https://mol.uniacc.cl/webpay-qa/retorno
```

Rebuild / restart `uniacc-api`. Luego:

```bash
curl -sS -X POST http://127.0.0.1:3001/api/webpay-qa/crear \
  -H 'Content-Type: application/json' \
  -d '{"monto":1500,"concepto":"matricula"}'
```

Expected: JSON con `ok:true`, `token`, `url`, `buyOrder`.

- [ ] **Step 5: Commit (API)**

```bash
cd /opt/uniacc-api-docker
git add src/controllers/webpay-qa.controller.ts \
  src/routes/webpay-qa.routes.ts \
  src/index.ts
git commit -m "$(cat <<'EOF'
feat(webpay-qa): endpoints crear, volver y transaccion

EOF
)"
```

---

### Task 3: Cliente y rutas Vue (MOL)

**Files:**
- Create: `/opt/mol-docker/src/services/webpayQaApi.ts`
- Modify: `/opt/mol-docker/src/router/index.ts`
- Create: `/opt/mol-docker/src/views/webpay-qa/WebpayQaView.vue`
- Create: `/opt/mol-docker/src/views/webpay-qa/WebpayQaRetornoView.vue`

**Interfaces:**
- Consumes: `admisionApiBaseUrl()`, `redirigirAWebpay` de `webpayPlusApi.ts` (reexportar o importar)
- Produces: `crearWebpayQa`, `obtenerWebpayQa` (fila con `token: string | null`)

- [ ] **Step 1: Cliente `webpayQaApi.ts`**

```ts
import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { redirigirAWebpay, type ConceptoWebpay, type FilaPublica } from '@/services/webpayPlusApi'

export type FilaQa = FilaPublica & { token: string | null }

const TIMEOUT_MS = 60_000
const STORAGE_PREFIX = 'webpay-qa-token:'

export function guardarTokenQa(buyOrder: string, token: string): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + buyOrder, token)
  } catch { /* ignore */ }
}

export function leerTokenQa(buyOrder: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + buyOrder)
  } catch {
    return null
  }
}

export async function crearWebpayQa(input: {
  monto: number
  concepto: ConceptoWebpay
  codcli?: string
}): Promise<{ ok: true; buyOrder: string; token: string; url: string } | { ok: false; error: string }> {
  const base = admisionApiBaseUrl()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/api/webpay-qa/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
    const body = (await res.json()) as Record<string, unknown>
    if (body.ok === true && typeof body.buyOrder === 'string' && typeof body.token === 'string' && typeof body.url === 'string') {
      return { ok: true, buyOrder: body.buyOrder, token: body.token, url: body.url }
    }
    return { ok: false, error: typeof body.error === 'string' ? body.error : `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de red' }
  } finally {
    clearTimeout(timer)
  }
}

export async function obtenerWebpayQa(buyOrder: string): Promise<FilaQa | null> {
  const base = admisionApiBaseUrl()
  const res = await fetch(
    `${base}/api/webpay-qa/transaccion?buy_order=${encodeURIComponent(buyOrder.trim())}`,
  )
  const body = (await res.json()) as Record<string, unknown>
  if (!res.ok || body.ok !== true) return null
  // parsear como FilaPublica + token opcional
  // (reutilizar lógica de parseFilaPublica o duplicar campos mínimos)
  return {
    /* campos FilaPublica */,
    token: typeof body.token === 'string' ? body.token : null,
  } as FilaQa
}

export { redirigirAWebpay }
```

Implementar el parseo completo de `FilaQa` (copiar validaciones de `parseFilaPublica` en `webpayPlusApi.ts` y agregar `token`).

- [ ] **Step 2: Rutas públicas en el router**

En `src/router/index.ts`, junto a `/login` y `/proximamente`:

```ts
{
  path: '/webpay-qa',
  name: 'webpay-qa',
  component: () => import('../views/webpay-qa/WebpayQaView.vue'),
},
{
  path: '/webpay-qa/retorno',
  name: 'webpay-qa-retorno',
  component: () => import('../views/webpay-qa/WebpayQaRetornoView.vue'),
},
```

Confirmar que `needsAuth` solo aplica a `to.path.startsWith('/dashboard')` (ya es así): estas rutas no piden login.

En el bloque de proximamente, **no** agregar `webpay-qa` a la lista que redirige a proximamente (hoy solo `login` / `home` / `proximamente`).

- [ ] **Step 3: Vista `WebpayQaView.vue`**

`<script setup lang="ts">` con:

- refs: `monto` (default 1500), `concepto` (`matricula` \| `arancel`), `codcli` (default `99999999`), `error`, `enviando`
- `async function iniciar()`: valida monto entero > 0; llama `crearWebpayQa`; `guardarTokenQa`; `redirigirAWebpay(url, token)`

Template: Card simple, inputs, botón “Ir a Webpay”, texto de ayuda con link a `docs` no necesario; mencionar tarjetas de prueba en una línea.

- [ ] **Step 4: Vista `WebpayQaRetornoView.vue`**

- Lee `buy_order` y `error` de la query
- `onMounted`: `obtenerWebpayQa(buyOrder)`
- Muestra: estado, buyOrder, token (`fila.token ?? leerTokenQa(buyOrder)`), paymentTypeCode, installmentsNumber, authorizationCode
- Botón “Copiar token” (`navigator.clipboard.writeText`)
- Link/botón “Nueva prueba” → `{ name: 'webpay-qa' }`

- [ ] **Step 5: Typecheck front**

```bash
cd /opt/mol-docker && npx vue-tsc -p tsconfig.app.json --noEmit
```

Expected: sin errores nuevos en los archivos de esta task.

- [ ] **Step 6: Commit (MOL)**

```bash
cd /opt/mol-docker
git add src/services/webpayQaApi.ts \
  src/views/webpay-qa/WebpayQaView.vue \
  src/views/webpay-qa/WebpayQaRetornoView.vue \
  src/router/index.ts \
  docs/superpowers/specs/2026-10-18-webpay-qa-publica-design.md \
  docs/superpowers/plans/2026-10-18-webpay-qa-publica.md
git commit -m "$(cat <<'EOF'
feat(webpay-qa): pantalla pública de prueba sin login

EOF
)"
```

---

### Task 4: Despliegue en `mol.uniacc.cl` y smoke

**Files:**
- Modify on server: `/opt/mol-docker/uniacc-api-docker/.env` (QA URLs; no commit)

- [ ] **Step 1: Env en `uniacc-mol`**

```bash
ssh uniacc-mol 'grep WEBPAY_PLUS_QA /opt/mol-docker/uniacc-api-docker/.env || true'
```

Si faltan, agregar:

```
WEBPAY_PLUS_QA_VOLVER_URL=https://mol.uniacc.cl/api/webpay-qa/volver
WEBPAY_PLUS_QA_MOL_RETORNO=https://mol.uniacc.cl/webpay-qa/retorno
```

- [ ] **Step 2: Rebuild API + MOL**

En el servidor, rebuild de `uniacc-api` y del front `mol-dev` (imagen que sirve `mol.uniacc.cl`) con el código de estas tasks.

- [ ] **Step 3: Smoke sin login**

1. Abrir `https://mol.uniacc.cl/webpay-qa` en ventana privada (sin sesión).
2. Monto 1500, matrícula → Ir a Webpay.
3. Pagar con VISA `4051 8856 0044 6623`, CVV 123, RUT `11.111.111-1` / `123`.
4. Debe volver a `/webpay-qa/retorno?buy_order=...` con estado `autorizada` y token visible.
5. Copiar token y verificar longitud 64.

- [ ] **Step 4: Actualizar nota de tokens**

Agregar al inicio de `docs/webpay/tokens-validacion-transbank.md`:

```md
Para nuevas pruebas usar https://mol.uniacc.cl/webpay-qa (sin login).
```

Commit solo si el usuario lo pide en esa sesión; si no, dejar el archivo modificado.

---

## Spec coverage (self-review)

| Requisito del spec | Task |
| --- | --- |
| Rutas `/webpay-qa` y `/webpay-qa/retorno` | 3 |
| Sin login / fuera de dashboard | 3 |
| API crear / volver / transaccion | 2 |
| Solo integración | 1, 2 |
| return_url y retorno QA | 1, 2 |
| Mostrar token + estado | 3 |
| Reutiliza `mnp_webpay_transaccion` | 2 (`crearTransaccion`) |
| No tocar flujo alumno | File map + constraints |
| Smoke en mol.uniacc.cl | 4 |

## Placeholder scan

Sin TBD / “implement later” / “similar to Task N” sin código.

---

## Execution handoff

Plan guardado en `docs/superpowers/plans/2026-10-18-webpay-qa-publica.md`.

**Opciones de ejecución:**

1. **Subagent-Driven (recomendado)** — un subagente por task, revisión entre tasks  
2. **Inline Execution** — ejecutar las tasks en esta sesión con checkpoints  

¿Cuál preferís?
