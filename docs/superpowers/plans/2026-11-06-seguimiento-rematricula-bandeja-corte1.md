# Seguimiento rematrícula — bandeja CORTE 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bandeja staff del embudo completo (KPI + cartera ejecutivo + tabla + panel + bitácora con canal) e indicadores Mail 2h/SMS 24h en lectura (`n/a` sin outbox), sin composer ni scheduler.

**Architecture:** Migraciones Supabase (`mnp_seguimiento_contacto`, `mnp_retencion_outbox`, menú). `uniacc-api` expone `/api/rematricula/seguimiento/*` uniendo progreso + cartera + TuFirma (chip 5/6) + bitácora/outbox. MOL nueva vista `BandejaSeguimientoRematriculaView` (no reusa logs). Predicado chip 5/6: `forma_pago` + TuFirma enviada `!ready` → `contrato_pdte`; resto `forma_pago`; etapa `firma` → `firmado_pdte_u`.

**Tech Stack:** Supabase Postgres, uniacc-api Express/TS + `querySupabase` + Postgres mnp, mol Vue 3 + Composition API + shadcn-vue + Tailwind, Vitest / node:test.

**Spec:** `docs/superpowers/specs/2026-11-06-seguimiento-rematricula-bandeja-corte1-design.md`  
**Wireframes:** `docs/wireframes/seguimiento-rematricula-v2/` (`01`–`03`)

## Global Constraints

- Solo **mol-dev / uniacc-desarrollo**; no prod sin OK explícito
- **No** reutilizar `RematriculaSeguimientoView` (logs)
- Menú: **nueva** entrada; **coexiste** con Gestión Pagos y Gestión Firmas
- Outbox: **solo esquema**; sin enqueue ni scheduler; UI casi siempre `n/a`
- Bitácora manual: `origen=manual`, **`canal` del form** (default UI `llamada`)
- P = matrícula Webpay autorizada && !firma completa; nunca grabar U+ temprano
- Cartera: `email_ejecutivo` + `alcanceCartera` (perfil 3 = propia; 1/2 = completa)
- Periodo UI: `tp_periodo_activo` (sin selector)
- Tokens UI: `#FF5B00`, navy

## Predicado chip 5 vs 6 (clavado)

Hitos existentes (sin inventar etapa BD):

| Chip UI | Condición |
|---------|-----------|
| `forma_pago` (5) | `etapa_actual = 'forma_pago'` **y** **no** hay TuFirma del periodo con `ready = false` |
| `contrato_pdte` (6) | `etapa_actual = 'forma_pago'` **y** existe operación TuFirma del periodo **enviada** con `ready = false` (misma noción que pendientes en Gestión Firmas) |
| `firmado_pdte_u` (7) | `etapa_actual = 'firma'` |
| `matriculado` (8) | `etapa_actual = 'matriculado'` |
| 1–4 | `sin_ingreso` / `ingreso` / `tyc` / `datos` 1:1 |

Tests obligatorios: sobre un set sintético, `5∩6=∅` y `6∩7=∅`.

## File map

| Archivo | Rol |
|---------|-----|
| `mol-docker/supabase/migrations/20261106120000_seguimiento_bandeja_corte1.sql` | Tablas + RLS/grants + `bo_menu_item` |
| `uniacc-api-docker/src/services/seguimiento-bandeja-chip.ts` (+ test) | Partición 5/6/7 + badge outbox |
| `uniacc-api-docker/src/services/seguimiento-bandeja.service.ts` (+ tests) | KPI, bandeja, caso, contactos |
| `uniacc-api-docker/src/controllers/rematricula-seguimiento.controller.ts` | HTTP |
| `uniacc-api-docker/src/routes/rematricula-seguimiento.routes.ts` | Router |
| `uniacc-api-docker/src/index.ts` | Mount `/api/rematricula/seguimiento` |
| `mol-docker/src/utils/seguimientoBandejaChip.ts` (+ test) | Mismo predicado en front (labels/badges) |
| `mol-docker/src/utils/seguimientoBandejaOutbox.ts` (+ test) | `n/a` / `pdte` / `enviado` |
| `mol-docker/src/services/seguimientoRematriculaApi.ts` | Cliente HTTP |
| `mol-docker/src/views/dashboard/rematricula/BandejaSeguimientoRematriculaView.vue` | UI |
| `mol-docker/src/router/index.ts` | Ruta |
| `mol-docker/src/constants/dashboardRouteNames.ts` | Allowlist menú |
| `docs/wireframes/seguimiento-rematricula-v2/` | Incluir en commit si aún untracked |

---

### Task 1: Predicado chip 5/6/7 + badge outbox (API puro)

**Files:**
- Create: `uniacc-api-docker/src/services/seguimiento-bandeja-chip.ts`
- Create: `uniacc-api-docker/src/services/seguimiento-bandeja-chip.test.ts`

**Interfaces:**
- Produces:
  - `export type EtapaProgresoBd = 'sin_ingreso' \| 'ingreso' \| 'tyc' \| 'datos' \| 'forma_pago' \| 'firma' \| 'matriculado'`
  - `export type ChipBandeja = EtapaProgresoBd \| 'contrato_pdte' \| 'firmado_pdte_u'` — nota: `firma` BD se expone como `firmado_pdte_u`; no devolver `firma` al cliente
  - `export function chipBandejaDesdeSenales(input: { etapaActual: EtapaProgresoBd; tufirmaEnviadaPendiente: boolean }): ChipBandeja`
  - `export type EstadoOutboxUi = 'n/a' \| 'pdte' \| 'enviado'`
  - `export function estadoOutboxUi(input: { aplicaRetencionP: boolean; fila: { estado: string; sent_at: string \| null } \| null }): EstadoOutboxUi`
  - `export function particionChipsExclusiva(rows: Array<{ id: string; chip: ChipBandeja }>): { ok: boolean; interseccion56: string[]; interseccion67: string[] }` — helper de test/assert

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  chipBandejaDesdeSenales,
  estadoOutboxUi,
  particionChipsExclusiva,
  type ChipBandeja,
} from './seguimiento-bandeja-chip'

describe('chipBandejaDesdeSenales', () => {
  it('forma_pago sin tufirma pendiente → forma_pago (chip 5)', () => {
    assert.equal(
      chipBandejaDesdeSenales({ etapaActual: 'forma_pago', tufirmaEnviadaPendiente: false }),
      'forma_pago',
    )
  })

  it('forma_pago con tufirma !ready → contrato_pdte (chip 6)', () => {
    assert.equal(
      chipBandejaDesdeSenales({ etapaActual: 'forma_pago', tufirmaEnviadaPendiente: true }),
      'contrato_pdte',
    )
  })

  it('etapa firma → firmado_pdte_u (chip 7)', () => {
    assert.equal(
      chipBandejaDesdeSenales({ etapaActual: 'firma', tufirmaEnviadaPendiente: true }),
      'firmado_pdte_u',
    )
  })

  it('5∩6=∅ y 6∩7=∅ en set sintético', () => {
    const rows: Array<{ id: string; chip: ChipBandeja }> = [
      { id: 'a', chip: chipBandejaDesdeSenales({ etapaActual: 'forma_pago', tufirmaEnviadaPendiente: false }) },
      { id: 'b', chip: chipBandejaDesdeSenales({ etapaActual: 'forma_pago', tufirmaEnviadaPendiente: true }) },
      { id: 'c', chip: chipBandejaDesdeSenales({ etapaActual: 'firma', tufirmaEnviadaPendiente: true }) },
      { id: 'd', chip: chipBandejaDesdeSenales({ etapaActual: 'matriculado', tufirmaEnviadaPendiente: false }) },
    ]
    const p = particionChipsExclusiva(rows)
    assert.equal(p.ok, true)
    assert.deepEqual(p.interseccion56, [])
    assert.deepEqual(p.interseccion67, [])
  })
})

describe('estadoOutboxUi', () => {
  it('!P → n/a', () => {
    assert.equal(estadoOutboxUi({ aplicaRetencionP: false, fila: { estado: 'pendiente', sent_at: null } }), 'n/a')
  })
  it('P sin fila → n/a', () => {
    assert.equal(estadoOutboxUi({ aplicaRetencionP: true, fila: null }), 'n/a')
  })
  it('P pendiente → pdte', () => {
    assert.equal(estadoOutboxUi({ aplicaRetencionP: true, fila: { estado: 'pendiente', sent_at: null } }), 'pdte')
  })
  it('P enviado → enviado', () => {
    assert.equal(
      estadoOutboxUi({ aplicaRetencionP: true, fila: { estado: 'enviado', sent_at: '2026-11-05T12:00:00Z' } }),
      'enviado',
    )
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /opt/uniacc-api-docker && npm test -- --test-name-pattern='chipBandeja|estadoOutbox' 2>&1 | tail -30
```

Expected: FAIL module not found / assert fail

- [ ] **Step 3: Implement**

```ts
// seguimiento-bandeja-chip.ts
export type EtapaProgresoBd =
  | 'sin_ingreso'
  | 'ingreso'
  | 'tyc'
  | 'datos'
  | 'forma_pago'
  | 'firma'
  | 'matriculado'

export type ChipBandeja =
  | 'sin_ingreso'
  | 'ingreso'
  | 'tyc'
  | 'datos'
  | 'forma_pago'
  | 'contrato_pdte'
  | 'firmado_pdte_u'
  | 'matriculado'

export function chipBandejaDesdeSenales(input: {
  etapaActual: EtapaProgresoBd
  tufirmaEnviadaPendiente: boolean
}): ChipBandeja {
  if (input.etapaActual === 'matriculado') return 'matriculado'
  if (input.etapaActual === 'firma') return 'firmado_pdte_u'
  if (input.etapaActual === 'forma_pago' && input.tufirmaEnviadaPendiente) return 'contrato_pdte'
  if (input.etapaActual === 'forma_pago') return 'forma_pago'
  return input.etapaActual
}

export type EstadoOutboxUi = 'n/a' | 'pdte' | 'enviado'

export function estadoOutboxUi(input: {
  aplicaRetencionP: boolean
  fila: { estado: string; sent_at: string | null } | null
}): EstadoOutboxUi {
  if (!input.aplicaRetencionP) return 'n/a'
  if (!input.fila) return 'n/a'
  if (input.fila.estado === 'enviado') return 'enviado'
  if (input.fila.estado === 'pendiente') return 'pdte'
  return 'n/a'
}

export function particionChipsExclusiva(
  rows: Array<{ id: string; chip: ChipBandeja }>,
): { ok: boolean; interseccion56: string[]; interseccion67: string[] } {
  const c5 = new Set(rows.filter((r) => r.chip === 'forma_pago').map((r) => r.id))
  const c6 = new Set(rows.filter((r) => r.chip === 'contrato_pdte').map((r) => r.id))
  const c7 = new Set(rows.filter((r) => r.chip === 'firmado_pdte_u').map((r) => r.id))
  const interseccion56 = [...c5].filter((id) => c6.has(id))
  const interseccion67 = [...c6].filter((id) => c7.has(id))
  return {
    ok: interseccion56.length === 0 && interseccion67.length === 0,
    interseccion56,
    interseccion67,
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker && git add src/services/seguimiento-bandeja-chip.ts src/services/seguimiento-bandeja-chip.test.ts
git commit -m "$(cat <<'EOF'
feat(seguimiento): predicado chip 5/6/7 y badge outbox

Partición exclusiva forma_pago vs contrato_pdte (TuFirma !ready) y firmado_pdte_u.
EOF
)"
```

---

### Task 2: Migración tablas + menú (Supabase)

**Files:**
- Create: `mol-docker/supabase/migrations/20261106120000_seguimiento_bandeja_corte1.sql`

**Interfaces:**
- Produces tables `public.mnp_seguimiento_contacto`, `public.mnp_retencion_outbox`; menu route `dashboard-bandeja-seguimiento`

- [ ] **Step 1: Write migration SQL**

```sql
-- mnp_seguimiento_contacto (append-only)
CREATE TABLE IF NOT EXISTS public.mnp_seguimiento_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codcli text NOT NULL,
  rut_norm text,
  anio_periodo integer NOT NULL,
  semestre_periodo smallint NOT NULL CHECK (semestre_periodo IN (1, 2)),
  autor_email text NOT NULL,
  canal text NOT NULL CHECK (canal IN (
    'llamada', 'whatsapp', 'correo', 'sms', 'presencial', 'sistema', 'nota'
  )),
  origen text NOT NULL CHECK (origen IN ('manual', 'auto')),
  resultado text,
  nota text,
  respuesta_alumno text,
  proxima_accion text,
  proxima_accion_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mnp_seguimiento_contacto_caso_idx
  ON public.mnp_seguimiento_contacto (codcli, anio_periodo, semestre_periodo, created_at DESC);

-- mnp_retencion_outbox (esquema; sin enqueue en CORTE 1)
CREATE TABLE IF NOT EXISTS public.mnp_retencion_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut_norm text NOT NULL,
  anio_periodo integer NOT NULL,
  semestre_periodo smallint NOT NULL CHECK (semestre_periodo IN (1, 2)),
  tipo text NOT NULL CHECK (tipo IN ('mail_2h', 'sms_24h')),
  due_at timestamptz NOT NULL,
  estado text NOT NULL CHECK (estado IN ('pendiente', 'enviado', 'cancelado', 'error')),
  sent_at timestamptz,
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rut_norm, anio_periodo, semestre_periodo, tipo)
);

GRANT SELECT, INSERT ON public.mnp_seguimiento_contacto TO service_role;
GRANT SELECT ON public.mnp_retencion_outbox TO service_role;
-- Ajustar grants al rol que use querySupabase (mismo patrón que tablas mnp_* recientes)

-- Menú: Bandeja seguimiento (NO desactivar Gestión Pagos)
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000083',
  'b0000001-0001-4000-8000-000000000020',
  'link',
  'Seguimiento rematrícula',
  'dashboard-bandeja-seguimiento',
  'Inbox',
  26,
  true
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = true;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000083', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Apply on supabase-dev** (comando habitual del equipo; no prod)

- [ ] **Step 3: Commit**

```bash
cd /opt/mol-docker && git add supabase/migrations/20261106120000_seguimiento_bandeja_corte1.sql
git commit -m "$(cat <<'EOF'
feat(seguimiento): tablas contacto/outbox y menú bandeja CORTE 1

Append-only bitácora + outbox sin scheduler; entrada de menú coexistente.
EOF
)"
```

---

### Task 3: Servicio API — KPI + bandeja

**Files:**
- Create: `uniacc-api-docker/src/services/seguimiento-bandeja.service.ts`
- Create: `uniacc-api-docker/src/services/seguimiento-bandeja.service.test.ts` (mappers / filtro cartera unitarios)
- Create: `uniacc-api-docker/src/controllers/rematricula-seguimiento.controller.ts`
- Create: `uniacc-api-docker/src/routes/rematricula-seguimiento.routes.ts`
- Modify: `uniacc-api-docker/src/index.ts` — `app.use('/api/rematricula/seguimiento', …)`

**Interfaces:**
- Consumes: `chipBandejaDesdeSenales`, `estadoOutboxUi`, `emailEjecutivoDeQuery`, `rutsDeEjecutivo` / join `mnp_cartera_oficial`, progreso, TuFirma claves (mismo patrón que `gestion-pagos`), Webpay matrícula
- Produces:
  - `listarSeguimientoKpi(anio, semestre, emailEjecutivo: string | null)`
  - `listarSeguimientoBandeja(opts: { anio, semestre, chip?, subetapa?, q?, filtroAux?, emailEjecutivo, limit, offset })`
  - Response filas incluyen: `codcli`, `nombre`, `rut`, `carrera`, `chip`, `subetapa_forma_pago`, `mat_webpay_fecha`, `mail_2h`, `sms_24h`, `ultimo_contacto`, `proxima_accion`, `email_ejecutivo`

**Cartera:** si `emailEjecutivo` no null → filtrar `lower(trim(email_ejecutivo)) = email`. Si null → cartera completa (supervisor). Front perfil 3 siempre envía su email vía `urlConCarteraEjecutivo` (mismo patrón NPS/firmas).

- [ ] **Step 1: Unit tests** para mapeo de fila (chip + outbox n/a) y filtro email

- [ ] **Step 2: Implement service** — leer `mnp_progreso_rematricula` periodo; left join cartera; set de TuFirma pendientes del periodo; outbox por rut (casi vacío); agregar chips; filtrar; paginar

- [ ] **Step 3: HTTP GET `/kpi` y GET `/bandeja`**

- [ ] **Step 4: Mount router + smoke curl local**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(seguimiento): API KPI y bandeja con cartera y chips

Listado embudo completo particionado 5/6/7 y outbox en lectura n/a.
EOF
)"
```

---

### Task 4: Servicio API — caso, contactos, bitácora

**Files:**
- Modify: `uniacc-api-docker/src/services/seguimiento-bandeja.service.ts`
- Modify: controller + routes
- Modify: `seguimiento-bandeja.service.test.ts`

**Interfaces:**
- Produces:
  - `obtenerCasoSeguimiento(codcli, anio, semestre, emailEjecutivo)`
  - `crearContactoSeguimiento({ codcli, anio, semestre, autorEmail, canal, nota, resultado?, proxima_accion?, proxima_accion_en? })` — fuerza `origen: 'manual'`; valida `canal` ∈ enum
  - `listarBitacora(codcli, anio, semestre, limit, offset)`

- [ ] **Step 1: Failing tests** — canal inválido rechaza; canal `llamada` inserta `origen=manual`; caso fuera de cartera → null/403 path

```ts
it('crearContacto exige canal válido', async () => {
  await assert.rejects(
    () => crearContactoSeguimiento({ /* … */ canal: 'fax' as never, nota: 'x' }),
    /canal/,
  )
})
```

- [ ] **Step 2: Implement INSERT** into `mnp_seguimiento_contacto` via `querySupabase`

- [ ] **Step 3: GET caso + GET bitacora + POST `/casos/:codcli/contactos`**

Body POST:

```json
{
  "anio": 2027,
  "semestre": 1,
  "autorEmail": "mperez@uniacc.cl",
  "canal": "llamada",
  "nota": "Alumno espera CAE",
  "proxima_accion": "Llamar",
  "proxima_accion_en": null
}
```

- [ ] **Step 4: Tests PASS + Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(seguimiento): caso, bitácora y POST contacto con canal

Append-only manual; canal elegido por el consejero.
EOF
)"
```

---

### Task 5: Utils + cliente front (MOL)

**Files:**
- Create: `mol-docker/src/utils/seguimientoBandejaChip.ts` (+ `.test.ts`) — **misma lógica** que Task 1 (copiar predicado; no compartir paquete)
- Create: `mol-docker/src/utils/seguimientoBandejaOutbox.ts` (+ `.test.ts`)
- Create: `mol-docker/src/services/seguimientoRematriculaApi.ts`

**Interfaces:**
- Produces API helpers:
  - `fetchSeguimientoKpi(anio, semestre)`
  - `fetchSeguimientoBandeja(params)`
  - `fetchSeguimientoCaso(codcli, anio, semestre)`
  - `postSeguimientoContacto(codcli, body)`
  - `fetchSeguimientoBitacora(codcli, anio, semestre)`
- Usar `urlConCarteraEjecutivo` en todas las GETs (y no enviar email ajeno en perfil 3)

- [ ] **Step 1: Vitest** — mismos casos 5∩6 y outbox n/a que API

```bash
cd /opt/mol-docker && npm run test:unit -- --run src/utils/seguimientoBandejaChip.test.ts src/utils/seguimientoBandejaOutbox.test.ts
```

- [ ] **Step 2: Implement utils + client**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(seguimiento): cliente API y helpers de chip/outbox en MOL

Espejo del predicado 5/6 y estados n/a|pdte|enviado.
EOF
)"
```

---

### Task 6: Vista bandeja (embudo + tabla)

**Files:**
- Create: `mol-docker/src/views/dashboard/rematricula/BandejaSeguimientoRematriculaView.vue`
- Modify: `mol-docker/src/router/index.ts` — ruta `dashboard-bandeja-seguimiento`
- Modify: `mol-docker/src/constants/dashboardRouteNames.ts` — allowlist

**UI (wireframe 01–02):**
- 8 chips KPI clicables (labels del wireframe; counts de `/kpi`)
- Subchips forma de pago solo si chip 5 activo
- Auxiliares (conteos; Mail/SMS suelen 0/`n/a`)
- Toggle cartera: perfil 3 solo “mía”; 1/2 “Ver todas” + chips ejecutivo (lista distinta de emails de respuesta KPI/bandeja)
- Tabla columnas: Alumno, Carrera, Etapa, Subetapa, Mat. Webpay, Mail 2h, SMS 24h, Último contacto, Próxima acción, Ejecutivo, Abrir
- Periodo activo store; paginación server `limit/offset`

- [ ] **Step 1: Scaffold vista + ruta + allowlist** (carga KPI/bandeja)

- [ ] **Step 2: Chips + filtros + tabla** alineados a wireframe (naranja `#FF5B00`)

- [ ] **Step 3: Rebuild mol-dev y smoke visual chips**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(seguimiento): vista bandeja embudo y tabla CORTE 1

Nueva ruta dashboard-bandeja-seguimiento coexistente con Pagos/Firmas.
EOF
)"
```

---

### Task 7: Panel caso + dialog contacto

**Files:**
- Modify: `BandejaSeguimientoRematriculaView.vue` (o extraer `SeguimientoCasoPanel.vue` si crece)
- Optional Create: `mol-docker/src/components/rematricula/SeguimientoCasoPanel.vue`
- Optional Create: `mol-docker/src/components/rematricula/SeguimientoContactoDialog.vue`

**UI (wireframe 03):**
- Sheet/panel: resumen contacto/medios/firmantes/ejecutivo
- Bloque Retención automática: mail_2h / sms_24h (esperar `n/a`)
- Botones Enviar correo / SMS / WhatsApp: `disabled` + texto «próximamente»
- **Agregar contacto**: Dialog con `Select` canal (default `llamada`), textarea nota, próxima acción opcional → POST
- Timeline bitácora

- [ ] **Step 1: Panel + botones disabled**

- [ ] **Step 2: Dialog canal + POST + refresh bitácora**

- [ ] **Step 3: Smoke** Abrir caso → contacto `llamada` → aparece en timeline

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(seguimiento): panel de caso y alta de contacto con canal

Envíos deshabilitados; bitácora manual operativa.
EOF
)"
```

---

### Task 8: Wireframes en repo + notas smoke + rebuild

**Files:**
- Add (si untracked): `docs/wireframes/seguimiento-rematricula-v2/`
- Create: `docs/superpowers/plans/2026-11-06-seguimiento-rematricula-bandeja-corte1-smoke.md` (checklist corto)

**Smoke checklist (copiar al md):**

1. Ejecutivo perfil 3: solo su cartera  
2. Supervisor 1/2: Ver todas + filtro ejecutivo  
3. Chip Forma de pago → subchip CAE → Abrir → contacto canal llamada  
4. Caso P: retención `n/a`; botones envío disabled  
5. Menú: Seguimiento rematrícula + Gestión Pagos + Gestión Firmas  
6. Sin prod / sin Celmedia  

- [ ] **Step 1: Commit wireframes + smoke notes**

- [ ] **Step 2: `docker compose build mol-dev` + recreate API si aplica**

- [ ] **Step 3: Lista archivos tocados + explícito CORTE 2** en el smoke md:

CORTE 2: composer WYSIWYG+firma, From DVU/ejecutivo, enqueue al autorizar Webpay, scheduler 2h/24h, WhatsApp, copy 06/07.

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| Vista/API nuevas, no mashup | 3–7 |
| Menú coexistente | 2, 6 |
| No RematriculaSeguimientoView | 6 |
| Chip 5/6 predicado + tests exclusión | 1, 5 |
| Chip 7 = etapa firma | 1 |
| Outbox esquema sin enqueue; UI n/a | 2, 1, 3, 7 |
| Bitácora canal selectable | 4, 7 |
| Cartera alcanceCartera | 3, 5, 6 |
| Botones envío disabled | 7 |
| Smoke / CORTE 2 list | 8 |

## Explicitly NOT in this plan

- Enqueue outbox al autorizar Webpay  
- Scheduler / Celmedia / EmailService retención  
- Composer 04/05, WhatsApp real  
- Reemplazar o apagar Gestión Pagos  
