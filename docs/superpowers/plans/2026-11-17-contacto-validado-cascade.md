# Contacto validado cascade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar en uniacc-api el criterio de correo/teléfono “validado” para que `verificar_ok` OTP gane, y si no hay OTP ok se acepte el valor del borrador (mismo que el badge Validado / continuar_sin_otp), desbloqueando Confirmar apoderado y avisos.

**Architecture:** Nuevo módulo `contacto-validado-alumno.ts` con resolvers inyectables (`query`). Cascade: (1) SQL OTP `verificar_ok` existente, (2) `contactoCorreoValidado` / `contactoTelefonoValidado` en `mol_borrador_rematricula` del periodo. El log `continuar_sin_otp` solo guarda máscara; el valor completo vive en el borrador. Call sites: apoderado refresh, aviso outbox, enrichment (alinear a OTP primero).

**Tech Stack:** Node 20, TypeScript, `node:test` + `tsx --test`, `querySupabase`, Express services existentes.

**Spec:** `docs/superpowers/specs/2026-11-17-contacto-validado-cascade-design.md`

## Global Constraints

- Sin migración SQL y sin cambios de UI MOL
- Prioridad: `verificar_ok` **siempre** gana sobre borrador
- Periodo borrador: `anio`/`semestre` explícitos del caller, o `tp_periodo_activo` / mismo fetch que apoderado
- `CORREO_VALIDADO_ALUMNO_SQL` se reutiliza como paso 1 de correo (no borrar export)
- Errores de un eslabón: continuar al siguiente; si nada → `null`
- Repo de código: `/opt/uniacc-api-docker` (spec/plan viven en mol-docker docs)

## File map

| Archivo | Rol |
|---------|-----|
| `uniacc-api-docker/src/services/contacto-validado-alumno.ts` | Resolvers correo/teléfono + SQL borrador / SMS OTP |
| `uniacc-api-docker/src/services/contacto-validado-alumno.test.ts` | Unit cascade con `query` mock |
| `uniacc-api-docker/src/services/apoderado-refresh-from-erp.service.ts` | `correoValidadoDefault` → resolver |
| `uniacc-api-docker/src/services/apoderado-refresh-from-erp.service.test.ts` | Preview con email null vs fallback (deps ya mockean `correoValidado`) |
| `uniacc-api-docker/src/services/rematricula-aviso-outbox.service.ts` | Usar resolver en lugar de solo SQL OTP |
| `uniacc-api-docker/src/services/seguimiento-caso-enrichment.ts` | OTP primero, luego payload; tel vía resolver |

---

### Task 1: Resolver `contacto-validado-alumno` (TDD)

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/contacto-validado-alumno.ts`
- Create: `/opt/uniacc-api-docker/src/services/contacto-validado-alumno.test.ts`

**Interfaces:**
- Consumes: `CORREO_VALIDADO_ALUMNO_SQL`, `normalizarRutAviso` from `./rematricula-aviso-outbox.service`; `querySupabase` default
- Produces:
  - `export type ContactoValidadoQuery = (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>`
  - `export type PeriodoBorrador = { anio: number; semestre: number }`
  - `export async function resolverCorreoValidadoAlumno(rut: string | null, codcli: string, opts?: { query?: ContactoValidadoQuery; periodo?: PeriodoBorrador | null }): Promise<string | null>`
  - `export async function resolverTelefonoValidadoAlumno(rut: string | null, codcli: string, opts?: { query?: ContactoValidadoQuery; periodo?: PeriodoBorrador | null }): Promise<string | null>`
  - `export const TELEFONO_VALIDADO_OTP_SQL` (mismo patrón que correo, canal sms + `mnp_contacto_otp_sms.telefono_norm`)
  - `export const BORRADOR_CONTACTO_SQL` — selecciona `payload->>'contactoCorreoValidado'` y `payload->>'contactoTelefonoValidado'` por `codcli` + periodo

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  resolverCorreoValidadoAlumno,
  resolverTelefonoValidadoAlumno,
  type ContactoValidadoQuery,
} from './contacto-validado-alumno'

function mockQuery(handlers: Array<(sql: string, params?: unknown[]) => { rows: Array<Record<string, unknown>> } | null>): ContactoValidadoQuery {
  return async (sql, params) => {
    for (const h of handlers) {
      const hit = h(sql, params)
      if (hit) return hit
    }
    return { rows: [] }
  }
}

describe('resolverCorreoValidadoAlumno', () => {
  it('prioriza verificar_ok sobre borrador', async () => {
    const q = mockQuery([
      (sql) =>
        sql.includes('verificar_ok')
          ? { rows: [{ email_personal_norm: 'otp@mail.cl' }] }
          : null,
      (sql) =>
        sql.includes('mol_borrador_rematricula')
          ? { rows: [{ contacto_correo: 'borrador@mail.cl', contacto_telefono: null }] }
          : null,
    ])
    const email = await resolverCorreoValidadoAlumno('199072757', '20251TRSO1AR032', {
      query: q,
      periodo: { anio: 2027, semestre: 1 },
    })
    assert.equal(email, 'otp@mail.cl')
  })

  it('usa borrador si no hay verificar_ok (caso Alexa)', async () => {
    const q = mockQuery([
      (sql) => (sql.includes('verificar_ok') ? { rows: [] } : null),
      (sql) =>
        sql.includes('mol_borrador_rematricula')
          ? {
              rows: [
                {
                  contacto_correo: 'alexasalinas16@hotmail.com',
                  contacto_telefono: '931871308',
                },
              ],
            }
          : null,
    ])
    const email = await resolverCorreoValidadoAlumno('199072757', '20251TRSO1AR032', {
      query: q,
      periodo: { anio: 2027, semestre: 1 },
    })
    assert.equal(email, 'alexasalinas16@hotmail.com')
  })

  it('retorna null si no hay OTP ni borrador', async () => {
    const q = mockQuery([() => ({ rows: [] })])
    const email = await resolverCorreoValidadoAlumno('1', 'C1', {
      query: q,
      periodo: { anio: 2027, semestre: 1 },
    })
    assert.equal(email, null)
  })
})

describe('resolverTelefonoValidadoAlumno', () => {
  it('usa borrador si OTP sms vacío', async () => {
    const q = mockQuery([
      (sql) => (sql.includes("canal = 'sms'") ? { rows: [] } : null),
      (sql) =>
        sql.includes('mol_borrador_rematricula')
          ? { rows: [{ contacto_correo: null, contacto_telefono: '56931871308' }] }
          : null,
    ])
    const tel = await resolverTelefonoValidadoAlumno('199072757', '20251TRSO1AR032', {
      query: q,
      periodo: { anio: 2027, semestre: 1 },
    })
    assert.equal(tel, '56931871308')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/contacto-validado-alumno.test.ts`  
Expected: FAIL (módulo no existe / funciones undefined)

- [ ] **Step 3: Write minimal implementation**

```ts
import { querySupabase } from '../config/postgres-supabase'
import {
  CORREO_VALIDADO_ALUMNO_SQL,
  normalizarRutAviso,
} from './rematricula-aviso-outbox.service'

export type ContactoValidadoQuery = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Array<Record<string, unknown>> }>

export type PeriodoBorrador = { anio: number; semestre: number }

export const TELEFONO_VALIDADO_OTP_SQL = `
  SELECT e.telefono_norm
    FROM public.log_mol_contacto_otp o
    JOIN public.log_sesion_usuario s ON s.id = o.sesion_id
    JOIN LATERAL (
      SELECT telefono_norm
        FROM public.mnp_contacto_otp_sms e
       WHERE lower(e.usuario_conexion) = lower(s.usuario_local)
         AND e.consumed_at IS NOT NULL
         AND e.consumed_at BETWEEN o.creado_en - interval '10 minutes'
                               AND o.creado_en + interval '10 minutes'
       ORDER BY abs(extract(epoch FROM (e.consumed_at - o.creado_en)))
       LIMIT 1
    ) e ON true
   WHERE o.canal = 'sms'
     AND o.evento = 'verificar_ok'
     AND (
       regexp_replace(upper(coalesce(o.rut_alumno, '')), '[^0-9K]', '', 'g') = $1
       OR ($2 <> '' AND o.codcli = $2)
     )
   ORDER BY o.creado_en DESC
   LIMIT 1
`

export const BORRADOR_CONTACTO_SQL = `
  SELECT
    nullif(trim(payload->>'contactoCorreoValidado'), '') AS contacto_correo,
    nullif(trim(payload->>'contactoTelefonoValidado'), '') AS contacto_telefono
  FROM public.mol_borrador_rematricula
  WHERE codcli = $1
    AND anio_periodo = $2
    AND semestre_periodo = $3
  LIMIT 1
`

async function periodoActivo(query: ContactoValidadoQuery): Promise<PeriodoBorrador | null> {
  try {
    const res = await query(
      `SELECT anio_periodo, semestre_periodo
         FROM public.tp_periodo_activo
        ORDER BY anio_periodo DESC, semestre_periodo DESC
        LIMIT 1`,
    )
    const row = res.rows[0]
    if (!row) return null
    const anio = Number(row.anio_periodo)
    const semestre = Number(row.semestre_periodo)
    if (!Number.isFinite(anio) || !Number.isFinite(semestre)) return null
    return { anio, semestre }
  } catch {
    return null
  }
}

function texto(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s.toLowerCase() : null
}

function textoTel(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

async function correoDesdeOtp(
  rutNorm: string,
  codcli: string,
  query: ContactoValidadoQuery,
): Promise<string | null> {
  try {
    const res = await query(CORREO_VALIDADO_ALUMNO_SQL, [rutNorm, codcli])
    return texto(res.rows[0]?.email_personal_norm)
  } catch {
    return null
  }
}

async function telefonoDesdeOtp(
  rutNorm: string,
  codcli: string,
  query: ContactoValidadoQuery,
): Promise<string | null> {
  try {
    const res = await query(TELEFONO_VALIDADO_OTP_SQL, [rutNorm, codcli])
    return textoTel(res.rows[0]?.telefono_norm)
  } catch {
    return null
  }
}

async function contactoDesdeBorrador(
  codcli: string,
  periodo: PeriodoBorrador,
  query: ContactoValidadoQuery,
): Promise<{ email: string | null; telefono: string | null }> {
  try {
    const res = await query(BORRADOR_CONTACTO_SQL, [codcli, periodo.anio, periodo.semestre])
    const row = res.rows[0]
    return {
      email: texto(row?.contacto_correo),
      telefono: textoTel(row?.contacto_telefono),
    }
  } catch {
    return { email: null, telefono: null }
  }
}

export async function resolverCorreoValidadoAlumno(
  rut: string | null,
  codcli: string,
  opts?: { query?: ContactoValidadoQuery; periodo?: PeriodoBorrador | null },
): Promise<string | null> {
  const query = opts?.query ?? ((sql, params) => querySupabase(sql, params))
  const rutNorm = normalizarRutAviso(rut) ?? ''
  const otp = await correoDesdeOtp(rutNorm, codcli, query)
  if (otp) return otp
  const periodo = opts?.periodo === undefined ? await periodoActivo(query) : opts.periodo
  if (!periodo || !codcli) return null
  const b = await contactoDesdeBorrador(codcli, periodo, query)
  return b.email
}

export async function resolverTelefonoValidadoAlumno(
  rut: string | null,
  codcli: string,
  opts?: { query?: ContactoValidadoQuery; periodo?: PeriodoBorrador | null },
): Promise<string | null> {
  const query = opts?.query ?? ((sql, params) => querySupabase(sql, params))
  const rutNorm = normalizarRutAviso(rut) ?? ''
  const otp = await telefonoDesdeOtp(rutNorm, codcli, query)
  if (otp) return otp
  const periodo = opts?.periodo === undefined ? await periodoActivo(query) : opts.periodo
  if (!periodo || !codcli) return null
  const b = await contactoDesdeBorrador(codcli, periodo, query)
  return b.telefono
}
```

Note: `normalizarRutAviso` return type — if it already returns normalized string, use it; if signature differs, adapt without changing its export. Confirm in `rematricula-aviso-outbox.service.ts` before coding.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/contacto-validado-alumno.test.ts`  
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/contacto-validado-alumno.ts src/services/contacto-validado-alumno.test.ts
git commit -m "$(cat <<'EOF'
feat(contacto): resolver validado OTP o borrador

Cascade verificar_ok → contacto*Validado del borrador para correo y teléfono.
EOF
)"
```

---

### Task 2: Cablear apoderado refresh

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/apoderado-refresh-from-erp.service.ts` (`correoValidadoDefault` ~244–251)
- Modify: `/opt/uniacc-api-docker/src/services/apoderado-refresh-from-erp.service.test.ts` (añadir caso preview sin OTP dep → usar default no aplica; mantener mock; agregar comentario o test de integración del default solo si se exporta el default — preferir test del resolver en Task 1; aquí solo verificar que `correoValidado: null` deja `puedeConfirmar` false y con email true)

**Interfaces:**
- Consumes: `resolverCorreoValidadoAlumno` from `./contacto-validado-alumno`
- Produces: mismo contrato `correoValidado: (rut, codcli) => Promise<string | null>`

- [ ] **Step 1: Write / adjust failing assertion on preview when email null**

En el test file existente, asegurar:

```ts
  it('sin correo validado no permite confirmar', async () => {
    const { port } = deps({ email: null })
    const result = await new ApoderadoRefreshFromErpService(port).preview(input)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.puedeConfirmar, false)
  })
```

(Si ya existe, no duplicar.)

- [ ] **Step 2: Run existing apoderado tests**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/apoderado-refresh-from-erp.service.test.ts`  
Expected: PASS (antes del cambio de default; deps mockean `correoValidado`)

- [ ] **Step 3: Wire default**

Reemplazar `correoValidadoDefault` para:

```ts
import { resolverCorreoValidadoAlumno } from './contacto-validado-alumno'

async function correoValidadoDefault(rut: string | null, codcli: string): Promise<string | null> {
  return resolverCorreoValidadoAlumno(rut, codcli)
}
```

Quitar uso directo de `CORREO_VALIDADO_ALUMNO_SQL` en este archivo si ya no se necesita (mantener `normalizarRutAviso` solo si aún se usa).

- [ ] **Step 4: Re-run apoderado tests**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/apoderado-refresh-from-erp.service.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/apoderado-refresh-from-erp.service.ts src/services/apoderado-refresh-from-erp.service.test.ts
git commit -m "$(cat <<'EOF'
fix(apoderado): confirmar con correo de borrador si no hay OTP

Usa resolverCorreoValidadoAlumno en el default de preview/refresh.
EOF
)"
```

---

### Task 3: Cablear aviso outbox

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/rematricula-aviso-outbox.service.ts` (~194–200)
- Modify: `/opt/uniacc-api-docker/src/services/rematricula-aviso-outbox.service.test.ts` (actualizar comentario/assert de SQL si el test solo hace `assert.match` sobre `CORREO_VALIDADO_ALUMNO_SQL` — ese export **permanece**; no romper)

**Interfaces:**
- Consumes: `resolverCorreoValidadoAlumno`
- Produces: mismo flujo de omitir/enviar avisos

- [ ] **Step 1: Confirm SQL export test still documents paso 1**

```ts
  it('toma el correo OTP confirmado con verificar_ok', () => {
    assert.match(CORREO_VALIDADO_ALUMNO_SQL, /evento = 'verificar_ok'/)
    assert.match(CORREO_VALIDADO_ALUMNO_SQL, /email_personal_norm/)
    assert.match(CORREO_VALIDADO_ALUMNO_SQL, /mnp_contacto_otp_email/)
  })
```

- [ ] **Step 2: Run outbox unit tests**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/rematricula-aviso-outbox.service.test.ts`  
Expected: PASS

- [ ] **Step 3: Replace lookup**

Donde hoy:

```ts
const validado = await querySupabase(CORREO_VALIDADO_ALUMNO_SQL, [
  rutNorm,
  aviso.codcli ?? '',
])
emailAlumno = optionalText(validado.rows[0]?.email_personal_norm)
```

poner:

```ts
import { resolverCorreoValidadoAlumno } from './contacto-validado-alumno'

emailAlumno = optionalText(
  await resolverCorreoValidadoAlumno(aviso.rut_alumno, aviso.codcli ?? ''),
)
```

(Pasar rut crudo; el resolver normaliza.)

- [ ] **Step 4: Re-run outbox tests**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/rematricula-aviso-outbox.service.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/rematricula-aviso-outbox.service.ts
git commit -m "$(cat <<'EOF'
fix(avisos): correo alumno vía cascade OTP/borrador

Evita omitir APODERADO_ACTUALIZADO cuando el alumno quedó Validado sin verificar_ok.
EOF
)"
```

---

### Task 4: Alinear enrichment (OTP primero)

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/seguimiento-caso-enrichment.ts` (`cargarCorreoOtp`, `cargarTelefonoOtp`, `resolverContactoAlumno`)
- Modify: `/opt/uniacc-api-docker/src/services/seguimiento-caso-enrichment.test.ts` (añadir test de orden si se exporta helper puro; si no, test de `contactoDesdePayload` se mantiene)

**Interfaces:**
- Consumes: `resolverCorreoValidadoAlumno`, `resolverTelefonoValidadoAlumno`
- Produces: `resolverContactoAlumno` con orden OTP → payload (spec); hoy está invertido

- [ ] **Step 1: Write failing test for orden**

Si `resolverContactoAlumno` acepta deps inyectables, preferir inyectar. Si no, extraer función pura:

```ts
export function mergeContactoValidado(input: {
  otpEmail: string | null
  otpTel: string | null
  payloadEmail: string | null
  payloadTel: string | null
}): { email: string | null; telefono: string | null } {
  return {
    email: input.otpEmail ?? input.payloadEmail,
    telefono: input.otpTel ?? input.payloadTel,
  }
}
```

Test:

```ts
it('OTP gana sobre payload', () => {
  assert.deepEqual(
    mergeContactoValidado({
      otpEmail: 'otp@x.cl',
      otpTel: null,
      payloadEmail: 'borrador@x.cl',
      payloadTel: '911',
    }),
    { email: 'otp@x.cl', telefono: '911' },
  )
})
```

- [ ] **Step 2: Run to see fail / then implement merge + wire**

```ts
export async function resolverContactoAlumno(input: {
  payload: Record<string, unknown> | null
  rutNorm: string | null
  codcli: string
  periodo?: { anio: number; semestre: number } | null
}): Promise<{ email: string | null; telefono: string | null }> {
  const base = contactoDesdePayload(input.payload)
  const email =
    (await resolverCorreoValidadoAlumno(input.rutNorm, input.codcli, {
      periodo: input.periodo ?? null,
    })) ?? base.email
  // Nota: resolver ya incluye borrador; si payload es el mismo borrador, no duplica mal.
  // Para no pegarle 2 veces a PG, preferir:
  // const email = await resolverCorreoValidadoAlumno(...) 
  // y solo si null, base.email de payload ya cargado en memoria.
```

Implementación preferida (una query borrador vía resolver; payload en memoria como último recurso si periodo null):

```ts
  const emailOtpOBorrador = await resolverCorreoValidadoAlumno(input.rutNorm, input.codcli, {
    periodo: input.periodo,
  })
  const telOtpOBorrador = await resolverTelefonoValidadoAlumno(input.rutNorm, input.codcli, {
    periodo: input.periodo,
  })
  const base = contactoDesdePayload(input.payload)
  return {
    email: emailOtpOBorrador ?? base.email,
    telefono: telOtpOBorrador ?? base.telefono,
  }
```

Eliminar `cargarCorreoOtp` / `cargarTelefonoOtp` locales si quedan sin uso.

- [ ] **Step 3: Run enrichment tests**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/seguimiento-caso-enrichment.test.ts`  
Expected: PASS

- [ ] **Step 4: Run related suite**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/contacto-validado-alumno.test.ts src/services/apoderado-refresh-from-erp.service.test.ts src/services/rematricula-aviso-outbox.service.test.ts src/services/seguimiento-caso-enrichment.test.ts`  
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/seguimiento-caso-enrichment.ts src/services/seguimiento-caso-enrichment.test.ts
git commit -m "$(cat <<'EOF'
fix(seguimiento): contacto alumno con cascade OTP/borrador

Alinea enrichment al mismo criterio que apoderado y avisos.
EOF
)"
```

---

### Task 5: Deploy mol-dev + uniacc-mol + verificar Alexa

**Files:**
- None (ops)
- Docs already in mol-docker (plan/spec); push mol plan commit if not pushed

- [ ] **Step 1: Push API branches**

```bash
cd /opt/uniacc-api-docker
git checkout dev
git merge --ff-only HEAD  # already on commits
git checkout qa && git merge --ff-only dev
git checkout main && git merge --ff-only qa
git checkout dev
git push origin dev qa main
```

- [ ] **Step 2: Rebuild API en este host (mol-dev)**

```bash
cd /opt/uniacc-api-docker && docker compose build uniacc-api && docker compose up -d uniacc-api
```

- [ ] **Step 3: Rsync + rebuild en uniacc-mol**

```bash
rsync -avz \
  /opt/uniacc-api-docker/src/services/contacto-validado-alumno.ts \
  /opt/uniacc-api-docker/src/services/contacto-validado-alumno.test.ts \
  /opt/uniacc-api-docker/src/services/apoderado-refresh-from-erp.service.ts \
  /opt/uniacc-api-docker/src/services/rematricula-aviso-outbox.service.ts \
  /opt/uniacc-api-docker/src/services/seguimiento-caso-enrichment.ts \
  uniacc-mol:/opt/mol-docker/uniacc-api-docker/src/services/

ssh uniacc-mol 'cd /opt/mol-docker/uniacc-api-docker && docker compose build uniacc-api && docker compose up -d uniacc-api'
```

- [ ] **Step 4: Smoke Alexa**

Preview apoderado (vía UI Casos o curl autenticado si existe): `puedeConfirmar` true para `20251TRSO1AR032` / `19907275-7` sin rehacer OTP.

Verificación SQL de insumos (no sustituye el API):

```bash
ssh uniacc-mol "docker exec supabase-db psql -U postgres -d postgres -c \"
SELECT payload->>'contactoCorreoValidado' FROM mol_borrador_rematricula
WHERE codcli='20251TRSO1AR032' AND anio_periodo=2027 AND semestre_periodo=1;
\""
```

Expected: `alexasalinas16@hotmail.com`

- [ ] **Step 5: Commit plan doc on mol-docker if pending + push docs**

```bash
cd /opt/mol-docker
git add docs/superpowers/plans/2026-11-17-contacto-validado-cascade.md
git commit -m "docs: plan cascade contacto validado OTP/borrador" || true
git push origin dev
# merge qa/main solo si el equipo quiere el doc en esas ramas (mismo flujo habitual)
```

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| Cascade C OTP → borrador | Task 1 |
| Resolver TS compartido | Task 1 |
| Apoderado | Task 2 |
| Avisos/outbox | Task 3 |
| Enrichment OTP primero | Task 4 |
| Tests unitarios cascade + apoderado/avisos | Tasks 1–3 |
| Sin UI / sin migración | Global + Tasks |
| Verif Alexa post-deploy | Task 5 |

**Nota plan vs spec:** el log `continuar_sin_otp` solo guarda `contacto_mascara`; el valor usable del paso 2 es el **borrador**. Eso cumple el badge Validado y el caso Alexa sin inventar email desde la máscara.
