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

