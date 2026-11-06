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

