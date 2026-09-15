# Avisos email al consejero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encolar y enviar correos HTML al ejecutivo del Excel (+ CC `mol@uniacc.cl`) cuando el alumno rechaza TyC, sube PDF de convenio, marca apoderado desactualizado o completa la firma; más digest lun–vie 09:00/16:00 de firmas pendientes.

**Architecture:** Outbox en Supabase (`mnp_aviso_consejero`). El RPC `abrir_mnp_caso_rematricula` encola TyC/convenio/apoderado. Un worker en `uniacc-api` (SMTP relay + `SUPABASE_PG_*`) despacha la cola, detecta TuFirma `ready` → `FIRMA_COMPLETA`, y corre el digest. El portal no envía SMTP.

**Tech Stack:** Postgres/Supabase migrations, Vue 3/TS (MOL), Express/TS + nodemailer + node-cron + `pg` (`uniacc-api`), Vitest (MOL), `node:test` (API).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-avisos-consejero-email-design.md`
- To = `email_ejecutivo`; CC = `mol@uniacc.cl` (env `REMATRICULA_AVISO_CC`, default ese valor)
- Sin ejecutivo → To = CC; no duplicar CC
- Mocks (`es_mock` / selección mock) **no** encolan
- HTML tabular inline; sin emojis; text/plain obligatorio
- Colores: navy `#1E3A5F`, celeste `#3B9EC9`, pink `#D91B7A`, naranja `#E8621A`
- Digest: lun–vie 09:00 y 16:00 `America/Santiago`; vacío = silencio
- Firma inmediata solo si documento 100 % `ready`
- `REMATRICULA_APODERADO_AVISO_TO` deja de usarse en el flujo alumno (staging opcional)
- Composition API; tipos explícitos; sin `any`
- Commits solo si el usuario lo pide (salvo que se indique lo contrario en la sesión)

## File map

| Archivo | Rol |
|---------|-----|
| `mol-docker/supabase/migrations/20260915200000_mnp_aviso_consejero.sql` | `email_ejecutivo`, outbox, digest_log, `abrir` encola |
| `mol-docker/scripts/load_cartera_email_ejecutivo.py` | Carga Excel → UPDATE `email_ejecutivo` |
| `mol-docker/src/types/supabase.ts` | Tipos columna + RPC `p_es_mock` |
| `mol-docker/src/services/casoRematriculaApi.ts` | Pasar `esMock` al RPC |
| `mol-docker/src/views/matricula-mock/FormaPagoMockView.vue` | Abrir caso `CONVENIO_CERTIFICADO` al subir PDF |
| `mol-docker/src/views/matricula-mock/MatriculaMockApoderadoStep.vue` | Payload apoderado en caso; quitar POST SMTP |
| `mol-docker/src/views/matricula-mock/MatriculaMockTyCStep.vue` | Pasar `esMock` al abrir caso |
| `uniacc-api-docker/src/services/rematricula-aviso-templates.ts` | HTML + text + asuntos |
| `uniacc-api-docker/src/services/rematricula-aviso-templates.test.ts` | Tests plantillas |
| `uniacc-api-docker/src/services/rematricula-aviso-destinatarios.ts` | To/CC |
| `uniacc-api-docker/src/services/rematricula-aviso-destinatarios.test.ts` | Tests To/CC |
| `uniacc-api-docker/src/services/rematricula-aviso-outbox.service.ts` | Claim + send + mark |
| `uniacc-api-docker/src/services/rematricula-aviso-firma.service.ts` | Poll TuFirma ready → enqueue |
| `uniacc-api-docker/src/services/rematricula-aviso-digest.service.ts` | Digest por ejecutivo |
| `uniacc-api-docker/src/services/rematricula-aviso-scheduler.service.ts` | Cron 1 min + 09/16 |
| `uniacc-api-docker/src/services/email.service.ts` | `enviarAvisoConsejeroRematricula` genérico |
| `uniacc-api-docker/src/index.ts` | Arrancar scheduler avisos |
| `uniacc-api-docker/.env.docker.example` | `MOL_PUBLIC_URL`, `REMATRICULA_AVISO_CC` |

---

### Task 1: Migración outbox + encolar desde `abrir`

**Files:**
- Create: `/opt/mol-docker/supabase/migrations/20260915200000_mnp_aviso_consejero.sql`

**Interfaces:**
- Consumes: `abrir_mnp_caso_rematricula` existente; `mnp_cartera_oficial`
- Produces:
  - Columna `mnp_cartera_oficial.email_ejecutivo text`
  - Tabla `mnp_aviso_consejero`
  - Tabla `mnp_aviso_digest_log`
  - RPC `abrir_mnp_caso_rematricula(..., p_es_mock boolean DEFAULT false, p_payload jsonb)` — misma firma + `p_es_mock`; tras upsert del caso, inserta aviso si aplica
  - RPC `encolar_mnp_aviso_firma_completa(...)` para el worker (SECURITY DEFINER, grant `service_role`)

- [ ] **Step 1: Crear migración**

Contenido mínimo (completo en el archivo):

```sql
-- email ejecutivo
ALTER TABLE public.mnp_cartera_oficial
  ADD COLUMN IF NOT EXISTS email_ejecutivo text;
COMMENT ON COLUMN public.mnp_cartera_oficial.email_ejecutivo IS
  'EJECUTIVO MATRICULA del Excel (lower). Destinatario To de avisos.';

-- outbox
CREATE TABLE IF NOT EXISTS public.mnp_aviso_consejero (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN (
    'TYC_RECHAZO', 'CONVENIO_CERTIFICADO', 'APODERADO_DATOS', 'FIRMA_COMPLETA'
  )),
  periodo text NOT NULL,
  codcli text NOT NULL,
  rut_alumno text,
  nombre_alumno text,
  carrera text,
  jornada text,
  caso_id uuid REFERENCES public.mnp_caso_rematricula(id),
  ref_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'enviado', 'error', 'omitido')),
  intentos integer NOT NULL DEFAULT 0,
  ultimo_error text,
  enviado_en timestamptz,
  es_mock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mnp_aviso_una_vez
  ON public.mnp_aviso_consejero (tipo, periodo, codcli)
  WHERE tipo IN ('TYC_RECHAZO', 'APODERADO_DATOS', 'FIRMA_COMPLETA');

CREATE UNIQUE INDEX IF NOT EXISTS uq_mnp_aviso_convenio_ref
  ON public.mnp_aviso_consejero (tipo, periodo, codcli, ref_id)
  WHERE tipo = 'CONVENIO_CERTIFICADO';

CREATE INDEX IF NOT EXISTS idx_mnp_aviso_pendiente
  ON public.mnp_aviso_consejero (estado, created_at)
  WHERE estado IN ('pendiente', 'error');

ALTER TABLE public.mnp_aviso_consejero ENABLE ROW LEVEL SECURITY;
-- sin policies SELECT/WRITE para anon/authenticated
GRANT SELECT, INSERT, UPDATE ON public.mnp_aviso_consejero TO service_role;

CREATE TABLE IF NOT EXISTS public.mnp_aviso_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_chile date NOT NULL,
  ventana text NOT NULL CHECK (ventana IN ('09', '16')),
  email_ejecutivo text NOT NULL,
  enviado_en timestamptz NOT NULL DEFAULT now(),
  n_items integer NOT NULL DEFAULT 0,
  UNIQUE (fecha_chile, ventana, email_ejecutivo)
);
ALTER TABLE public.mnp_aviso_digest_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.mnp_aviso_digest_log TO service_role;
```

Reemplazar `abrir_mnp_caso_rematricula` añadiendo `p_es_mock boolean DEFAULT false`. Tras INSERT/UPDATE del caso (`v_id`), si `p_tipo` ∈ (`TYC_RECHAZO`,`CONVENIO_CERTIFICADO`,`APODERADO_DATOS`) y `p_es_mock IS NOT TRUE`:

```sql
INSERT INTO public.mnp_aviso_consejero (
  tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
  caso_id, ref_id, payload, estado, es_mock
) VALUES (
  trim(p_tipo), trim(p_periodo), trim(p_codcli),
  nullif(trim(p_rut_alumno), ''), nullif(trim(p_nombre_alumno), ''),
  nullif(trim(p_carrera), ''), nullif(trim(p_jornada), ''),
  v_id, p_ref_id, coalesce(p_payload, '{}'::jsonb),
  'pendiente', false
)
ON CONFLICT DO NOTHING;
```

(Para `CONVENIO_CERTIFICADO` el unique parcial usa `ref_id`; para los otros el unique sin `ref_id`. Usar dos `INSERT ... ON CONFLICT` o un único insert que respete el índice aplicable.)

Añadir:

```sql
CREATE OR REPLACE FUNCTION public.encolar_mnp_aviso_firma_completa(
  p_periodo text,
  p_codcli text,
  p_rut_alumno text DEFAULT NULL,
  p_nombre_alumno text DEFAULT NULL,
  p_carrera text DEFAULT NULL,
  p_jornada text DEFAULT NULL,
  p_ref_id text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.mnp_aviso_consejero (
    tipo, periodo, codcli, rut_alumno, nombre_alumno, carrera, jornada,
    ref_id, payload, estado, es_mock
  ) VALUES (
    'FIRMA_COMPLETA', trim(p_periodo), trim(p_codcli),
    nullif(trim(p_rut_alumno), ''), nullif(trim(p_nombre_alumno), ''),
    nullif(trim(p_carrera), ''), nullif(trim(p_jornada), ''),
    p_ref_id, coalesce(p_payload, '{}'::jsonb), 'pendiente', false
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.encolar_mnp_aviso_firma_completa TO service_role;
```

- [ ] **Step 2: Aplicar migración en el entorno local Supabase**

Run (ajustar al workflow del repo; ejemplo):

```bash
cd /opt/mol-docker && npx supabase db push
# o: psql $SUPABASE_PG_URL -f supabase/migrations/20260915200000_mnp_aviso_consejero.sql
```

Expected: tablas/columna/funciones creadas sin error.

- [ ] **Step 3: Commit (solo si el usuario lo pide)**

```bash
git add supabase/migrations/20260915200000_mnp_aviso_consejero.sql
git commit -m "feat: outbox avisos consejero y email_ejecutivo en cartera"
```

---

### Task 2: Cargar `email_ejecutivo` desde el Excel

**Files:**
- Create: `/opt/mol-docker/scripts/load_cartera_email_ejecutivo.py`
- Modify: `/opt/mol-docker/src/types/supabase.ts` (`MnpCarteraOficialRow`)

**Interfaces:**
- Consumes: Excel `docs/becas-beneficios/BASE PARA PRUEBA.xlsx`, columna `EJECUTIVO MATRICULA`; `rutNorm` = dígitos+DV
- Produces: UPDATE por `rut_norm`; tipo TS `email_ejecutivo: string | null`

- [ ] **Step 1: Script Python**

```python
#!/usr/bin/env python3
"""Carga email_ejecutivo desde BASE PARA PRUEBA.xlsx → mnp_cartera_oficial."""
from collections import defaultdict
from openpyxl import load_workbook
import os, sys, psycopg2

EXCEL = os.environ.get(
    "CARTERA_XLSX",
    "/opt/mol-docker/docs/becas-beneficios/BASE PARA PRUEBA.xlsx",
)
DSN = os.environ["SUPABASE_PG_URL"]  # o SUPABASE_DATABASE_URL

def rut_norm(rut, dig):
    body = "".join(c for c in str(rut) if c.isdigit())
    dv = str(dig).strip().upper()
    return body + dv

wb = load_workbook(EXCEL, data_only=True, read_only=True)
ws = wb.active
rows = ws.iter_rows(values_only=True)
header = [str(c).strip() if c is not None else "" for c in next(rows)]
# header trae 'COHORTE ' con espacio en COHORTE; EJECUTIVO MATRICULA exacto
idx = {h.strip(): i for i, h in enumerate(header)}
by_rut = {}
for row in rows:
    if row is None or row[idx["RUT"]] is None:
        continue
    rn = rut_norm(row[idx["RUT"]], row[idx["DIG"]])
    email = (row[idx["EJECUTIVO MATRICULA"]] or "").strip().lower()
    if not email:
        continue
    # si dos carreras, conservar el primero (hoy son iguales)
    by_rut.setdefault(rn, email)

conn = psycopg2.connect(DSN)
cur = conn.cursor()
n = 0
for rn, email in by_rut.items():
    cur.execute(
        "UPDATE public.mnp_cartera_oficial SET email_ejecutivo = %s WHERE rut_norm = %s",
        (email, rn),
    )
    n += cur.rowcount
conn.commit()
print(f"updated={n} distinct_rut={len(by_rut)}")
```

- [ ] **Step 2: Ejecutar dry (contar)**

```bash
cd /opt/mol-docker && SUPABASE_PG_URL=... python3 scripts/load_cartera_email_ejecutivo.py
```

Expected: `updated` cercano a filas existentes en `mnp_cartera_oficial`; emails solo los 3 del Excel.

- [ ] **Step 3: Actualizar tipo**

En `MnpCarteraOficialRow`:

```ts
export type MnpCarteraOficialRow = {
  rut_norm: string
  rematriculable: boolean
  fuente: string
  loaded_at: string
  excluido_mol?: boolean
  email_ejecutivo?: string | null
}
```

Y en `Database['public']['Tables']['mnp_cartera_oficial']` si está tipado a mano, alinear Row/Insert/Update.

- [ ] **Step 4: Commit (si el usuario lo pide)**

---

### Task 3: Portal — `esMock`, convenio abre caso, apoderado sin SMTP directo

**Files:**
- Modify: `/opt/mol-docker/src/services/casoRematriculaApi.ts`
- Modify: `/opt/mol-docker/src/views/matricula-mock/MatriculaMockTyCStep.vue`
- Modify: `/opt/mol-docker/src/views/matricula-mock/MatriculaMockApoderadoStep.vue`
- Modify: `/opt/mol-docker/src/views/matricula-mock/FormaPagoMockView.vue`
- Modify: `/opt/mol-docker/src/types/supabase.ts` (Args de `abrir_mnp_caso_rematricula`: `p_es_mock`)

**Interfaces:**
- Consumes: RPC con `p_es_mock`
- Produces: casos que encolan aviso; apoderado ya no llama `avisarApoderadoDesactualizado`

- [ ] **Step 1: Extender `AbrirCasoPayload`**

```ts
export type AbrirCasoPayload = {
  // ...existente
  esMock?: boolean
}

// en rpc:
p_es_mock: input.esMock ?? false,
```

- [ ] **Step 2: TyC — pasar `esMock: ctx.esMock` en `abrirCasoRematricula`**

- [ ] **Step 3: Apoderado — payload + quitar SMTP**

En `marcarDesactualizado`, al abrir caso:

```ts
await abrirCasoRematricula({
  // ...existente
  esMock: ctx.esMock,
  payload: {
    apoderadoNombre: nombreApoderado.value,
    apoderadoTelefono: telefonoApoderado.value,
    apoderadoEmail: emailApoderado.value,
  },
})
```

Eliminar la llamada a `avisarApoderadoDesactualizado` y el audit `correo_ok`/`correo_error` ligado a ese POST (o dejar solo un log de que el aviso quedó en cola). Quitar import de `apoderadoDesactualizadoApi` si queda sin uso.

- [ ] **Step 4: Forma de pago — abrir `CONVENIO_CERTIFICADO` al subir**

Hoy `onConvenioSubido` solo guarda en el store. Cambiar a async:

```ts
async function onConvenioSubido(payload: {
  convenioId: string
  doc: MockConvenioDocumento
  documentoId?: string | null
}) {
  mockCtx.setConvenioDocumento(payload.convenioId, payload.doc)
  const ctx = contextoMolAuditoria({
    rutAlumno: pick(...),
    codcli: pick(...),
    nombreAlumno: pick(...),
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
    esMock: mockCtx.tieneAlumnoSeleccionado,
  })
  const anio = ctx.anioPeriodo
  const sem = ctx.semestrePeriodo
  if (!ctx.codcli || anio == null || sem == null) return
  const match = conveniosDetectados.value.find((m) => m.convenio.id === payload.convenioId)
  await abrirCasoRematricula({
    periodo: periodoCatalogoLabel(anio, sem),
    tipo: 'CONVENIO_CERTIFICADO',
    estado: 'EN_REVISION',
    codcli: ctx.codcli,
    rutAlumno: ctx.rutAlumno,
    nombreAlumno: ctx.nombreAlumno,
    carrera: (plan.value?.carrera ?? plan.value?.nombre_carrera ?? '').trim() || undefined,
    jornada: (plan.value?.jornada_carrera ?? '').trim() || undefined,
    titulo: 'Certificado de convenio en revisión',
    detalle: 'El alumno subió el documento de vigencia del convenio.',
    refTipo: 'convenio_documento',
    refId: payload.documentoId ?? payload.doc.storagePath,
    esMock: ctx.esMock,
    payload: {
      convenio_id: payload.convenioId,
      storage_path: payload.doc.storagePath,
      codigo_beneficio: match?.convenio.codigo_beneficio ?? null,
    },
  })
}
```

Ajustar el emit de `ConvenioVigenteUpload` / card usada para incluir `documentoId` si aún no lo pasa (hoy `ConvenioVigenteUpload` emite solo `convenioId` + `doc`; usar `storagePath` como `ref_id` si no hay uuid).

- [ ] **Step 5: Verificar TypeScript**

```bash
cd /opt/mol-docker && npm run type-check
```

Expected: PASS (o solo errores preexistentes no introducidos).

- [ ] **Step 6: Commit (si el usuario lo pide)**

---

### Task 4: Plantillas HTML + destinos (uniacc-api) — TDD

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/rematricula-aviso-destinatarios.ts`
- Create: `/opt/uniacc-api-docker/src/services/rematricula-aviso-destinatarios.test.ts`
- Create: `/opt/uniacc-api-docker/src/services/rematricula-aviso-templates.ts`
- Create: `/opt/uniacc-api-docker/src/services/rematricula-aviso-templates.test.ts`

**Interfaces:**
- Consumes: nada de red
- Produces:
  - `export type AvisoTipo = 'TYC_RECHAZO' | 'CONVENIO_CERTIFICADO' | 'APODERADO_DATOS' | 'FIRMA_COMPLETA' | 'DIGEST'`
  - `export function resolverDestinatariosAviso(input: { emailEjecutivo: string | null; ccDefault: string }): { to: string; cc: string | null }`
  - `export function renderAvisoConsejero(input: RenderAvisoInput): { subject: string; html: string; text: string }`

- [ ] **Step 1: Test destinatarios (falla)**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolverDestinatariosAviso } from './rematricula-aviso-destinatarios'

describe('resolverDestinatariosAviso', () => {
  it('To ejecutivo + CC mol', () => {
    const r = resolverDestinatariosAviso({
      emailEjecutivo: 'nicole.eguren@uniacc.cl',
      ccDefault: 'mol@uniacc.cl',
    })
    assert.equal(r.to, 'nicole.eguren@uniacc.cl')
    assert.equal(r.cc, 'mol@uniacc.cl')
  })
  it('sin ejecutivo: To = CC y cc null', () => {
    const r = resolverDestinatariosAviso({
      emailEjecutivo: null,
      ccDefault: 'mol@uniacc.cl',
    })
    assert.equal(r.to, 'mol@uniacc.cl')
    assert.equal(r.cc, null)
  })
  it('normaliza lower/trim', () => {
    const r = resolverDestinatariosAviso({
      emailEjecutivo: '  Felipe.contreras@uniacc.cl ',
      ccDefault: 'mol@uniacc.cl',
    })
    assert.equal(r.to, 'felipe.contreras@uniacc.cl')
  })
})
```

- [ ] **Step 2: Run fail**

```bash
cd /opt/uniacc-api-docker && npm test -- src/services/rematricula-aviso-destinatarios.test.ts
```

Expected: FAIL module not found

- [ ] **Step 3: Implementar destinatarios**

```ts
export function resolverDestinatariosAviso(input: {
  emailEjecutivo: string | null
  ccDefault: string
}): { to: string; cc: string | null } {
  const cc = (input.ccDefault || 'mol@uniacc.cl').trim().toLowerCase()
  const ejec = (input.emailEjecutivo ?? '').trim().toLowerCase()
  if (!ejec) return { to: cc, cc: null }
  if (ejec === cc) return { to: cc, cc: null }
  return { to: ejec, cc }
}
```

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Test plantillas (falla)**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderAvisoConsejero } from './rematricula-aviso-templates'

const base = {
  molPublicUrl: 'https://mol.example.cl',
  alumno: {
    rut: '12.345.678-9',
    nombre: 'Ana Pérez',
    codcli: 'ABC123',
    carrera: 'Psicología',
    jornada: 'D',
    periodo: '2027-01',
  },
}

describe('renderAvisoConsejero', () => {
  it('TyC: asunto, acento naranja, CTA casos', () => {
    const r = renderAvisoConsejero({ ...base, tipo: 'TYC_RECHAZO' })
    assert.match(r.subject, /no aceptó TyC/)
    assert.match(r.html, /#E8621A/)
    assert.match(r.html, /\/dashboard\/casos-rematricula/)
    assert.match(r.text, /Ana Pérez/)
  })
  it('digest: tabla y tope 40', () => {
    const items = Array.from({ length: 42 }, (_, i) => ({
      rut: `R${i}`,
      nombre: `N${i}`,
      carrera: 'C',
      falta: 'Alumno' as const,
    }))
    const r = renderAvisoConsejero({
      ...base,
      tipo: 'DIGEST',
      digest: { n: 42, ventanaLabel: '09:00', fechaLabel: '15/09', items },
    })
    assert.match(r.subject, /42 firmas pendientes/)
    assert.match(r.html, /y 2 más/)
    assert.match(r.html, /\/dashboard\/gestion-firmas/)
  })
})
```

- [ ] **Step 6: Implementar `renderAvisoConsejero`** según cascarón del spec (escapar HTML; acentos por tipo; ficha; CTA; pie). Incluir campos apoderado en payload para `APODERADO_DATOS`.

- [ ] **Step 7: Tests PASS**

```bash
cd /opt/uniacc-api-docker && npm test -- src/services/rematricula-aviso-*.test.ts
```

---

### Task 5: EmailService genérico + outbox worker

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/email.service.ts`
- Create: `/opt/uniacc-api-docker/src/services/rematricula-aviso-outbox.service.ts`
- Create: `/opt/uniacc-api-docker/src/services/rematricula-aviso-scheduler.service.ts`
- Modify: `/opt/uniacc-api-docker/src/index.ts`

**Interfaces:**
- Consumes: `querySupabase` / `getSupabasePostgresClient`, plantillas, destinatarios, `EmailService`
- Produces:
  - `EmailService.enviarMailRematriculaAviso({ to, cc, subject, html, text }): Promise<boolean>`
  - `processAvisoOutboxBatch(limit?: number): Promise<{ sent: number; failed: number }>`
  - Scheduler: cada minuto `* * * * *` America/Santiago

- [ ] **Step 1: Método SMTP genérico** en `EmailService` (from = `SMTP_FROM` / name rematrícula; `to`, `cc` opcional).

- [ ] **Step 2: Outbox service**

Flujo:

1. `SELECT ... FROM mnp_aviso_consejero WHERE estado IN ('pendiente','error') AND intentos < 5 ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED` (vía pool Supabase).
2. Por fila: `rut_norm` del alumno → `SELECT email_ejecutivo FROM mnp_cartera_oficial WHERE rut_norm = $1`.
3. `resolverDestinatariosAviso` + `renderAvisoConsejero`.
4. Enviar; si ok → `estado=enviado`, `enviado_en=now()`; si fail → `intentos++`, `estado=error`, `ultimo_error=...`.

Backoff: solo reintentar `error` si `updated_at < now() - interval '2 minutes' * intentos` (o similar).

- [ ] **Step 3: Scheduler + start en `index.ts`**

```ts
import { rematriculaAvisoScheduler } from './services/rematricula-aviso-scheduler.service'
// tras schedulerService.start():
rematriculaAvisoScheduler.start()
```

Env:

- `REMATRICULA_AVISO_CC=mol@uniacc.cl`
- `MOL_PUBLIC_URL=https://...` (sin slash final)
- `REMATRICULA_AVISO_OUTBOX_ENABLED=true` (default true si Supabase PG ok)

- [ ] **Step 4: Documentar en `.env.docker.example`**

- [ ] **Step 5: Smoke manual** (insertar fila pendiente de prueba y ver log de envío)

- [ ] **Step 6: Commit (si el usuario lo pide)**

---

### Task 6: Encolar `FIRMA_COMPLETA` cuando TuFirma está ready

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/rematricula-aviso-firma.service.ts`
- Modify: scheduler (llamar cada minuto junto al outbox)

**Interfaces:**
- Consumes: Postgres API (`rematricula_contrato_tufirma`), TuFirma client `getDocument`, RPC `encolar_mnp_aviso_firma_completa` vía Supabase PG
- Produces: filas `FIRMA_COMPLETA` idempotentes

- [ ] **Step 1: Servicio `scanFirmasCompletas`**

1. Listar filas de `rematricula_contrato_tufirma` con `updated_at` reciente o todas no marcadas (añadir columna opcional `aviso_firma_encolado_en timestamptz` en migración API `008_...sql` **o** depender solo del unique del outbox).
2. Preferido: migración API:

```sql
ALTER TABLE rematricula_contrato_tufirma
  ADD COLUMN IF NOT EXISTS aviso_firma_encolado_en TIMESTAMPTZ;
```

3. Para filas con `aviso_firma_encolado_en IS NULL`: `getDocument`; si `ready`, llamar `encolar_mnp_aviso_firma_completa` con periodo/codcli/rut/nombre/carrera/`num_operacion` como `ref_id`; setear `aviso_firma_encolado_en = now()` aunque el insert no cree fila (idempotente).

- [ ] **Step 2: Integrar en el cron de 1 minuto (después del outbox)**

- [ ] **Step 3: Commit (si el usuario lo pide)**

---

### Task 7: Digest lun–vie 09:00 y 16:00

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/rematricula-aviso-digest.service.ts`
- Modify: scheduler

**Interfaces:**
- Consumes: contratos TuFirma no ready; `mnp_cartera_oficial.email_ejecutivo`; `mnp_aviso_digest_log`
- Produces: un mail por ejecutivo con pendientes

- [ ] **Step 1: Función `runDigestVentana(ventana: '09' | '16')`**

1. Fecha Chile + ventana; si ya existe log para `(fecha, ventana, email)` skip.
2. Contratos con documento y no ready (mismo criterio que firma: `getDocument` o cache local de firmantes). Agrupar por `email_ejecutivo` vía `rut` → `rut_norm` → cartera.
3. Por grupo: si 0 items skip; else render DIGEST + send To/CC; insert digest_log.
4. Tope 40 filas en HTML.

Quién falta: de `mapFirmantesEstado`, listar roles con `ready === false` (`Alumno` / `Apoderado`).

- [ ] **Step 2: Cron**

```ts
cron.schedule('0 9,16 * * 1-5', () => runDigest(), { timezone: 'America/Santiago' })
```

Determinar ventana por hora local (9 → `'09'`, 16 → `'16'`).

- [ ] **Step 3: Commit (si el usuario lo pide)**

---

### Task 8: Verificación de punta a punta (checklist)

No es código; ejecutar y anotar.

- [ ] **Step 1:** Cargar `email_ejecutivo` (Task 2) y confirmar 3 emails distintos en cartera.
- [ ] **Step 2:** Alumno real (no mock) rechaza TyC → fila `mnp_aviso_consejero` `TYC_RECHAZO` → mail To ejecutivo + CC mol@.
- [ ] **Step 3:** Segundo rechazo mismo periodo/codcli → no segunda fila.
- [ ] **Step 4:** Subir PDF convenio → caso + aviso; tras rechazo consejero y re-subida → segundo aviso (otro `ref_id`).
- [ ] **Step 5:** Apoderado desactualizado → aviso en cola; **no** mail a `REMATRICULA_APODERADO_AVISO_TO`.
- [ ] **Step 6:** Mock → `es_mock` true → sin fila pendiente (o omitido).
- [ ] **Step 7:** Contrato ready → `FIRMA_COMPLETA` una vez.
- [ ] **Step 8:** Forzar digest (llamar `runDigestVentana` a mano) con un pendiente → un mail; segunda llamada misma ventana → silencio.

---

## Self-review (plan vs spec)

| Spec | Task |
|------|------|
| `email_ejecutivo` + Excel | 1–2 |
| Outbox + unique TyC/apoderado/firma vs convenio+ref | 1 |
| Encolar desde `abrir` | 1 + 3 |
| Apoderado al ejecutivo, no lista fija | 3 + 5 |
| Mock no envía | 1 (`p_es_mock`) + 3 |
| HTML cascarón / acentos / CTA | 4 |
| Worker outbox + reintentos | 5 |
| FIRMA_COMPLETA solo ready | 6 |
| Digest 09/16 + log anti-dupe | 7 |
| CC mol@ | 4–5 |
| Convenio re-subida segundo mail | 1 unique + 3 |
| Sin adjunto PDF | 4 (no attachments) |

Hueco cubierto: hoy FormaPago **no** abría `CONVENIO_CERTIFICADO` → Task 3 Step 4.
