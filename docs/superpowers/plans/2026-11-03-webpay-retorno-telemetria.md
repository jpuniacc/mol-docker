# Webpay retorno telemetría Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar en `log_mol_evento` el retorno Webpay (API `volver` + mount front + Continuar ok/error) para diagnosticar alumnos atrapados post-pago.

**Architecture:** API registra `webpay`/`volver` tras `procesarVolver` sin bloquear el redirect. Front usa `webpayAuditLog` (RPC `registrar_log_mol_evento`) en `WebpayRetornoAlumnoView` para `retorno`, `continuar_ok` y `continuar_error`. Popup de versión queda **fuera** de este plan (spec diferida).

**Tech Stack:** Vue 3 + TypeScript (mol-docker), Fastify/Express uniacc-api + `querySupabase` / `registrar_log_mol_evento`, Vitest (front), `tsx --test` (API).

## Global Constraints

- `categoria` fija: `webpay`.
- Fallo de telemetría → `console.warn` / log API; **nunca** tumba redirect ni UI de Continuar.
- No cambiar `siguientePaso` ni el flujo de pago/firma.
- Path alumno prod obligatorio; QA opcional si el helper es compartido.
- Popup `version.json` **no** implementar aquí.

---

## File map

| Archivo | Rol |
|---------|-----|
| `uniacc-api-docker/src/services/webpay-plus/webpay-volver-audit.ts` | Helper puro payload + `registrarWebpayVolverAudit` (RPC) |
| `uniacc-api-docker/src/services/webpay-plus/webpay-volver-audit.test.ts` | Tests del helper |
| `uniacc-api-docker/src/controllers/rematricula-alumno-webpay.controller.ts` | Llama audit antes del redirect |
| `mol-docker/src/services/webpayAuditLog.ts` | RPC front `retorno` / `continuar_*` |
| `mol-docker/src/utils/webpayRetornoContinuar.ts` | Helper puro: destino Continuar + motivos error |
| `mol-docker/src/utils/webpayRetornoContinuar.test.ts` | Tests helper |
| `mol-docker/src/views/matricula-alumno/WebpayRetornoAlumnoView.vue` | Wiring audit |
| `mol-docker/docs/webpay/query-atrapados-doble-webpay.sql` | Query operativa documentada |

---

### Task 1: API helper `webpay-volver-audit`

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-volver-audit.ts`
- Create: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-volver-audit.test.ts`
- Consumes: `ClasificacionRetorno` de `clasificar-retorno.ts`; forma mínima de fila (`codcli`, `concepto`, `anioPeriodo`, `semestrePeriodo`, `monto`, `buyOrder`)
- Produces: `armarPayloadWebpayVolver(...)`, `registrarWebpayVolverAudit(...)`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { armarPayloadWebpayVolver } from './webpay-volver-audit'

describe('armarPayloadWebpayVolver', () => {
  it('incluye clasificacion, buy_order y estado', () => {
    const payload = armarPayloadWebpayVolver({
      clasificacion: { tipo: 'confirmar', token: 'tok' },
      buyOrder: '218583932027-1-87',
      estado: 'autorizada',
      fila: {
        codcli: '21858393',
        concepto: 'matricula',
        anioPeriodo: 2027,
        semestrePeriodo: 1,
        monto: 200000,
        buyOrder: '218583932027-1-87',
      },
    })
    assert.equal(payload.clasificacion, 'confirmar')
    assert.equal(payload.buy_order, '218583932027-1-87')
    assert.equal(payload.estado, 'autorizada')
    assert.equal(payload.concepto, 'matricula')
    assert.equal(payload.codcli, '21858393')
    assert.equal(payload.monto, 200000)
  })

  it('sin fila deja buy_order y clasificacion', () => {
    const payload = armarPayloadWebpayVolver({
      clasificacion: { tipo: 'invalido' },
      buyOrder: null,
      estado: null,
      fila: null,
    })
    assert.equal(payload.clasificacion, 'invalido')
    assert.equal(payload.buy_order, null)
    assert.equal(payload.estado, null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/webpay-plus/webpay-volver-audit.test.ts`  
Expected: FAIL (módulo no existe)

- [ ] **Step 3: Write minimal implementation**

```ts
import type { ClasificacionRetorno } from './clasificar-retorno'
import { querySupabase } from '../../config/postgres-supabase'

export type FilaAuditMin = {
  buyOrder: string
  codcli: string
  concepto: string
  anioPeriodo: number
  semestrePeriodo: number
  monto: number
}

export function armarPayloadWebpayVolver(input: {
  clasificacion: ClasificacionRetorno
  buyOrder: string | null
  estado: string | null
  fila: FilaAuditMin | null
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    clasificacion: input.clasificacion.tipo,
    buy_order: input.buyOrder,
    estado: input.estado,
  }
  if (input.fila) {
    base.concepto = input.fila.concepto
    base.codcli = input.fila.codcli
    base.anio_periodo = input.fila.anioPeriodo
    base.semestre_periodo = input.fila.semestrePeriodo
    base.monto = input.fila.monto
  }
  return base
}

export async function registrarWebpayVolverAudit(input: {
  clasificacion: ClasificacionRetorno
  buyOrder: string | null
  estado: string | null
  fila: FilaAuditMin | null
}): Promise<void> {
  try {
    const payload = armarPayloadWebpayVolver(input)
    const fila = input.fila
    const anio = fila?.anioPeriodo ?? null
    const sem = fila?.semestrePeriodo ?? null
    const periodoLabel = anio != null && sem != null ? `${anio}-${sem}` : null
    const rut =
      fila?.codcli && /^\d+$/.test(fila.codcli) ? `${fila.codcli}` : null
    await querySupabase(
      `SELECT public.registrar_log_mol_evento(
         p_categoria => 'webpay',
         p_accion => 'volver',
         p_payload => $1::jsonb,
         p_rut_alumno => $2,
         p_codcli => $3,
         p_anio_periodo => $4,
         p_semestre_periodo => $5,
         p_periodo_label => $6
       )`,
      [
        JSON.stringify(payload),
        rut,
        fila?.codcli ?? null,
        anio,
        sem,
        periodoLabel,
      ],
    )
  } catch (error) {
    console.warn(
      '[webpay-volver-audit]',
      error instanceof Error ? error.message : error,
    )
  }
}
```

Nota: `p_rut_alumno` puede ir como RUT sin DV si solo hay `codcli` numérico; suficiente para timeline. No formatear DV aquí.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/webpay-plus/webpay-volver-audit.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit (uniacc-api-docker)**

```bash
cd /opt/uniacc-api-docker
git add src/services/webpay-plus/webpay-volver-audit.ts src/services/webpay-plus/webpay-volver-audit.test.ts
git commit -m "$(cat <<'EOF'
feat(webpay): helper de audit para volver Transbank

EOF
)"
```

---

### Task 2: Wire `volverWebpayHttp`

**Files:**
- Modify: `/opt/uniacc-api-docker/src/controllers/rematricula-alumno-webpay.controller.ts`
- Consumes: `registrarWebpayVolverAudit`, `repo.buscarPorBuyOrder` (ya existe en deps)
- Produces: cada `volver` intenta audit antes del `res.redirect`

- [ ] **Step 1: Write failing integration-style unit around controller deps (optional skip if no harness)**

Si no hay test de controller existente, validar con test manual del Step 4 y un test que mockee `querySupabase` no es obligatorio. Preferir ampliar `webpay-volver-audit.test.ts` con un caso “registrar no lanza” mockeando query — solo si el proyecto ya mockea `postgres-supabase`; si no, pasar a Step 2.

- [ ] **Step 2: Edit `volverWebpayHttp`**

Tras `const result = await procesarVolver(...)` y `const clasificacion = clasificarRetorno(params)` (reordenar si hace falta para tener ambos):

```ts
let filaAudit: FilaAuditMin | null = null
if (result.buyOrder) {
  try {
    const fila = await repo.buscarPorBuyOrder(result.buyOrder)
    if (fila) {
      filaAudit = {
        buyOrder: fila.buyOrder,
        codcli: fila.codcli,
        concepto: fila.concepto,
        anioPeriodo: fila.anioPeriodo,
        semestrePeriodo: fila.semestrePeriodo,
        monto: fila.monto,
      }
    }
  } catch {
    /* ignore: audit best-effort */
  }
}
await registrarWebpayVolverAudit({
  clasificacion,
  buyOrder: result.buyOrder,
  estado: result.estado,
  fila: filaAudit,
})
// luego armar destino y res.redirect como hoy
```

Importar `registrarWebpayVolverAudit` y `FilaAuditMin` desde el helper. No mover el `redirect` dentro del try del audit.

- [ ] **Step 3: Run existing webpay tests**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/webpay-plus/*.test.ts`  
Expected: PASS (incl. audit nuevo)

- [ ] **Step 4: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/controllers/rematricula-alumno-webpay.controller.ts
git commit -m "$(cat <<'EOF'
feat(webpay): registrar log_mol_evento en volver alumno

EOF
)"
```

---

### Task 3: Front helper destino/motivo Continuar

**Files:**
- Create: `/opt/mol-docker/src/utils/webpayRetornoContinuar.ts`
- Create: `/opt/mol-docker/src/utils/webpayRetornoContinuar.test.ts`
- Produces: `destinoDesdePaso`, `motivoContinuarError`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { destinoDesdePaso, motivoContinuarError } from './webpayRetornoContinuar'

describe('destinoDesdePaso', () => {
  it('mapea tipos de siguientePaso', () => {
    expect(destinoDesdePaso({ tipo: 'firma' })).toBe('firma')
    expect(destinoDesdePaso({ tipo: 'webpay', concepto: 'arancel' })).toBe('webpay')
    expect(destinoDesdePaso({ tipo: 'elegir-arancel' })).toBe('elegir-arancel')
    expect(destinoDesdePaso({ tipo: 'plan-pagare', concepto: 'matricula' })).toBe(
      'plan-pagare',
    )
    expect(destinoDesdePaso({ tipo: 'flujo-pagare' })).toBe('forma-pago')
  })
})

describe('motivoContinuarError', () => {
  it('clasifica motivos', () => {
    expect(motivoContinuarError('medio_null')).toBe('medio_null')
    expect(motivoContinuarError('monto_invalido')).toBe('monto_invalido')
    expect(motivoContinuarError('identidad')).toBe('identidad')
    expect(motivoContinuarError('crear_webpay')).toBe('crear_webpay')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/mol-docker && npx vitest run src/utils/webpayRetornoContinuar.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
import type { PasoWebpay } from '@/utils/webpaySiguientePaso'

export type DestinoContinuarWebpay =
  | 'webpay'
  | 'elegir-arancel'
  | 'plan-pagare'
  | 'firma'
  | 'forma-pago'

export function destinoDesdePaso(paso: PasoWebpay): DestinoContinuarWebpay {
  if (paso.tipo === 'webpay') return 'webpay'
  if (paso.tipo === 'elegir-arancel') return 'elegir-arancel'
  if (paso.tipo === 'plan-pagare') return 'plan-pagare'
  if (paso.tipo === 'firma') return 'firma'
  return 'forma-pago'
}

export type MotivoContinuarWebpay =
  | 'medio_null'
  | 'monto_invalido'
  | 'identidad'
  | 'crear_webpay'

export function motivoContinuarError(
  motivo: MotivoContinuarWebpay,
): MotivoContinuarWebpay {
  return motivo
}
```

(`motivoContinuarError` es identity tipada para forzar literales en call sites.)

- [ ] **Step 4: Run test — PASS**

- [ ] **Step 5: Commit (mol-docker)**

```bash
cd /opt/mol-docker
git add src/utils/webpayRetornoContinuar.ts src/utils/webpayRetornoContinuar.test.ts
git commit -m "$(cat <<'EOF'
feat(webpay): helper destino/motivo telemetría retorno

EOF
)"
```

---

### Task 4: `webpayAuditLog` + wiring vista

**Files:**
- Create: `/opt/mol-docker/src/services/webpayAuditLog.ts`
- Modify: `/opt/mol-docker/src/views/matricula-alumno/WebpayRetornoAlumnoView.vue`
- Consumes: `contextoMolAuditoria`, `destinoDesdePaso`, `motivoContinuarError`, `useAlumnoRematriculaFuente`

- [ ] **Step 1: Create `webpayAuditLog.ts`** (mismo patrón que `formaPagoAuditLog.ts`)

```ts
import { contextoMolAuditoria, type ContextoMolAuditoriaOpciones } from '@/services/molAuditContext'
import { supabase } from '@/services/supabaseClient'

export type WebpayAuditAccion = 'retorno' | 'continuar_ok' | 'continuar_error'

export type RegistrarWebpayAuditParams = ContextoMolAuditoriaOpciones & {
  accion: WebpayAuditAccion
  payload?: Record<string, unknown>
}

export async function registrarWebpayAudit(
  params: RegistrarWebpayAuditParams,
): Promise<string | null> {
  const { accion, payload, ...ctxOpciones } = params
  const ctx = contextoMolAuditoria(ctxOpciones)

  const { data, error } = await supabase.rpc('registrar_log_mol_evento', {
    p_sesion_id: ctx.sesionId,
    p_categoria: 'webpay',
    p_accion: accion,
    p_origen_tabla: null,
    p_origen_id: null,
    p_payload: payload ?? null,
    p_rut_alumno: ctx.rutAlumno,
    p_codcli: ctx.codcli,
    p_nombre_alumno: ctx.nombreAlumno,
    p_anio_periodo: ctx.anioPeriodo,
    p_semestre_periodo: ctx.semestrePeriodo,
    p_periodo_label: ctx.periodoLabel,
    p_url_origen: ctx.urlOrigen,
    p_es_mock: ctx.esMock,
  })

  if (error) {
    console.warn('[WebpayAudit]', error.message)
    return null
  }
  return typeof data === 'string' ? data : null
}
```

- [ ] **Step 2: Wire `WebpayRetornoAlumnoView.vue`**

En `onMounted`, tras resolver `errorQuery` / `buyOrder` / `fila` (en cada rama, incluyendo errores), llamar:

```ts
void registrarWebpayAudit({
  accion: 'retorno',
  rutAlumno: fuente.rutMostrado.value === '—' ? null : fuente.rutMostrado.value,
  codcli: fuente.codcliMostrado.value === '—' ? null : fuente.codcliMostrado.value,
  anioPeriodo: fila?.anioPeriodo ?? null,
  semestrePeriodo: fila?.semestrePeriodo ?? null,
  payload: {
    buy_order: buyOrder || null,
    estado: fila?.estado ?? null,
    error: errorQuery || null,
    autenticado: auth.isAuthenticated,
  },
})
```

En `avanzarSiAutorizada`:
- `medioMatricula == null` → `continuar_error` + `motivo: motivoContinuarError('medio_null')` antes del return
- monto inválido → `monto_invalido`
- identidad → `identidad`
- `!creado.ok` → `crear_webpay`
- Antes de cada salida exitosa (`redirigirAWebpay`, `irAFormaPago`, `router.push` firma): `continuar_ok` con `destino: destinoDesdePaso(paso)` (para fallback final `irAFormaPago()` usar destino `forma-pago`)

Incluir `buy_order: fila.buyOrder` en todos los payloads Continuar.

- [ ] **Step 3: Run front tests**

Run: `cd /opt/mol-docker && npx vitest run src/utils/webpayRetornoContinuar.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /opt/mol-docker
git add src/services/webpayAuditLog.ts src/views/matricula-alumno/WebpayRetornoAlumnoView.vue
git commit -m "$(cat <<'EOF'
feat(webpay): telemetría retorno y Continuar en log_mol_evento

EOF
)"
```

---

### Task 5: Query operativa documentada

**Files:**
- Create: `/opt/mol-docker/docs/webpay/query-atrapados-doble-webpay.sql`

- [ ] **Step 1: Write SQL**

```sql
-- Alumnos con matrícula+arancel Webpay autorizada y sin cuenta.grabar en 30 min
-- (cruzar por RUT normalizado). Solo consulta operativa.
WITH wp AS (
  SELECT regexp_replace(codcli, '\D', '', 'g') AS rut_norm,
    max(actualizado_en) FILTER (WHERE concepto = 'matricula' AND estado = 'autorizada') AS mat_ok,
    max(actualizado_en) FILTER (WHERE concepto = 'arancel' AND estado = 'autorizada') AS ara_ok
  FROM public.mnp_webpay_transaccion
  WHERE anio_periodo = 2027 AND semestre_periodo = 1 AND ambiente = 'produccion'
  GROUP BY 1
),
grab AS (
  SELECT regexp_replace(coalesce(rut_alumno, codcli), '\D', '', 'g') AS rut_norm,
    min(creado_en) AS grabar_en
  FROM public.log_mol_evento
  WHERE categoria = 'cuenta' AND accion = 'grabar'
    AND anio_periodo = 2027 AND semestre_periodo = 1
  GROUP BY 1
)
SELECT w.rut_norm,
  w.mat_ok AT TIME ZONE 'America/Santiago' AS mat_ok_cl,
  w.ara_ok AT TIME ZONE 'America/Santiago' AS ara_ok_cl,
  g.grabar_en AT TIME ZONE 'America/Santiago' AS grabar_cl,
  CASE WHEN g.grabar_en IS NULL THEN NULL
       ELSE round(EXTRACT(EPOCH FROM (g.grabar_en - w.ara_ok)) / 60.0) END AS min_hasta_grabar
FROM wp w
LEFT JOIN grab g ON g.rut_norm = w.rut_norm
WHERE w.mat_ok IS NOT NULL AND w.ara_ok IS NOT NULL
  AND (g.grabar_en IS NULL OR g.grabar_en > w.ara_ok + interval '30 minutes')
ORDER BY w.ara_ok DESC;
```

- [ ] **Step 2: Commit**

```bash
cd /opt/mol-docker
git add docs/webpay/query-atrapados-doble-webpay.sql docs/superpowers/specs/2026-11-03-webpay-retorno-telemetria-y-version-popup-design.md docs/superpowers/plans/2026-11-03-webpay-retorno-telemetria.md
git commit -m "$(cat <<'EOF'
docs(webpay): plan telemetría retorno y query atrapados

EOF
)"
```

---

### Task 6: Verificación manual (post-deploy mol-dev)

- [ ] **Step 1:** Rebuild `uniacc-api` + `mol-dev` en el ambiente de prueba.
- [ ] **Step 2:** Pago Webpay de prueba (o flujo QA) → confirmar en Supabase:

```sql
SELECT creado_en AT TIME ZONE 'America/Santiago', categoria, accion, payload
FROM public.log_mol_evento
WHERE categoria = 'webpay'
ORDER BY creado_en DESC
LIMIT 20;
```

Esperado: al menos `volver` + `retorno`; tras Continuar, `continuar_ok` o `continuar_error`.

- [ ] **Step 3:** No commit; reportar resultado en el chat.

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| API `volver` → `log_mol_evento` | 1–2 |
| Front `retorno` / `continuar_ok` / `continuar_error` | 3–4 |
| Query atrapados documentada | 5 |
| Popup versión | diferido — sin task |
| Redirect/UI no bloqueados por audit | 1–2, 4 |
