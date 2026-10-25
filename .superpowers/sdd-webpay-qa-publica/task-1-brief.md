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

