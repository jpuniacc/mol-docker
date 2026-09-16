# Firma de contrato TuFirma — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el FES mock por TuFirma (firma simple, correos, espera hasta `ready`) y agregar la bandeja backoffice Gestión de firmas con PDF en pantalla.

**Architecture:** MOL no llama a TuFirma. uniacc-api es BFF: genera el PDF, `POST /public/documents/create`, persiste `num_operacion → document_id` en Postgres, y expone ensure/status/list/download. MOL poll ea cada 5 s. Staging usa `TU_FIRMA_EMAIL_OVERRIDE` hacia alias `+alumno` / `+apoderado` de `juan.silva@uniacc.cl`.

**Tech Stack:** Express + TypeScript + `pg` + pdfmake + `node:test` (`tsx --test`) en `uniacc-api-docker`. Vue 3 Composition API + Pinia + Vitest + shadcn-vue en `mol-docker`. TuFirma staging `https://api.aws.staging.tufirma.digital/api`.

## Global Constraints

- Spec: `mol-docker/docs/superpowers/specs/2026-09-11-tufirma-contrato-design.md`
- Firma **simple** (`firmantes`). Nunca `firmantesFea` / dactilar / facial / webhook
- Paralelo: no enviar `sign_order`
- Un documento por `numOperacion`; reutilizar si existe
- Key solo en uniacc-api (`TU_FIRMA_API_KEY`, `TU_FIRMA_BASE_URL`). No `VITE_*` de TuFirma en MOL
- Override pruebas: `TU_FIRMA_EMAIL_OVERRIDE=juan.silva@uniacc.cl` → `juan.silva+alumno@uniacc.cl` y `juan.silva+apoderado@uniacc.cl`
- Apoderado firma solo si `incluirApoderado === true` (`es_responsable_financiero !== 'S'`)
- Representante UNIACC no firma
- Composition API + `<script setup lang="ts">`; tipos explícitos; sin `any`
- Commits en el repo dueño del archivo (`uniacc-api-docker` vs `mol-docker`)
- No commitear secretos (`.env` con la API key)

## File map

| Archivo | Rol |
|---------|-----|
| `uniacc-api-docker/src/services/tufirma-firmantes.ts` | Override email, validación, payload `firmantes` + `fields` |
| `uniacc-api-docker/src/services/tufirma-firmantes.test.ts` | Unit tests mapeo |
| `uniacc-api-docker/src/services/pdf-page-count.ts` | Contar páginas del PDF |
| `uniacc-api-docker/src/services/pdf-page-count.test.ts` | Unit |
| `uniacc-api-docker/src/services/contrato-preview-pdf.service.ts` | Página final “Firmas electrónicas” |
| `uniacc-api-docker/src/migrations/007_rematricula_contrato_tufirma.sql` | Tabla Postgres |
| `uniacc-api-docker/src/services/tufirma-client.ts` | HTTP create/get/download/cost-centers |
| `uniacc-api-docker/src/services/tufirma-client.test.ts` | HTTP con fetch inyectado |
| `uniacc-api-docker/src/services/tufirma-contrato.service.ts` | ensure / status / list / documento |
| `uniacc-api-docker/src/services/tufirma-contrato.service.test.ts` | Orquestación con deps inyectadas |
| `uniacc-api-docker/src/controllers/rematricula-alumno-contrato-firma.controller.ts` | HTTP |
| `uniacc-api-docker/src/routes/rematricula-alumno.routes.ts` | Rutas `/contrato/firma*` |
| `uniacc-api-docker/package.json` | script `test` |
| `mol-docker/src/composables/useContratoMatriculaViewModel.ts` | `emailApoderado` real |
| `mol-docker/src/services/contratoFirmaApi.ts` | Cliente BFF |
| `mol-docker/src/views/matricula-mock/FirmaMockView.vue` | Espera + polling |
| `mol-docker/src/router/index.ts` | Guard resumen |
| `mol-docker/src/views/dashboard/rematricula/GestionFirmasView.vue` | Bandeja |
| `mol-docker/src/constants/dashboardRouteNames.ts` | Ruta menú |
| `mol-docker/src/views/dashboard/layout/menuIcons.ts` | Icono `PenLine` |
| `mol-docker/supabase/migrations/20260911180000_bo_menu_gestion_firmas.sql` | Ítem menú |

---

### Task 1: Mapeo de firmantes y override de email

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/tufirma-firmantes.ts`
- Create: `/opt/uniacc-api-docker/src/services/tufirma-firmantes.test.ts`
- Modify: `/opt/uniacc-api-docker/package.json` (script `test`)

**Interfaces:**
- Consumes: nada (puro)
- Produces:
  - `export type TuFirmaRol = 'alumno' | 'apoderado'`
  - `export type TuFirmaField = { filler: string; type: 'signature'; required: true; name: string; x: number; y: number; width: number; height: number; page: number }`
  - `export type TuFirmaFirmante = { email: string; nombre: string; rut: string; rol: TuFirmaRol }`
  - `export type BuildFirmantesOk = { ok: true; firmantes: TuFirmaFirmante[]; fields: TuFirmaField[] }`
  - `export type BuildFirmantesErr = { ok: false; error: string }`
  - `applyTuFirmaEmailOverride(email: string, rol: TuFirmaRol, override: string): string`
  - `emailValido(email: string): boolean`
  - `buildTuFirmaFirmantes(input: BuildTuFirmaFirmantesInput): BuildFirmantesOk | BuildFirmantesErr`
  - Constantes: `FIRMA_ALUMNO_BOX = { x: 0.08, y: 0.28, width: 0.35, height: 0.10 }`, `FIRMA_APODERADO_BOX = { x: 0.55, y: 0.28, width: 0.35, height: 0.10 }`

- [ ] **Step 1: Add test script**

In `/opt/uniacc-api-docker/package.json` scripts add: `"test": "tsx --test src/**/*.test.ts"`

- [ ] **Step 2: Write the failing tests**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyTuFirmaEmailOverride,
  buildTuFirmaFirmantes,
  emailValido,
} from './tufirma-firmantes'

describe('applyTuFirmaEmailOverride', () => {
  it('sin override deja el email', () => {
    assert.equal(applyTuFirmaEmailOverride('a@x.cl', 'alumno', ''), 'a@x.cl')
  })
  it('con override usa +rol', () => {
    assert.equal(
      applyTuFirmaEmailOverride('a@x.cl', 'alumno', 'juan.silva@uniacc.cl'),
      'juan.silva+alumno@uniacc.cl',
    )
    assert.equal(
      applyTuFirmaEmailOverride('b@x.cl', 'apoderado', 'juan.silva@uniacc.cl'),
      'juan.silva+apoderado@uniacc.cl',
    )
  })
})

describe('emailValido', () => {
  it('rechaza vacío, guión y sin @', () => {
    assert.equal(emailValido(''), false)
    assert.equal(emailValido('—'), false)
    assert.equal(emailValido('Sin información'), false)
    assert.equal(emailValido('foo'), false)
    assert.equal(emailValido('a@b.cl'), true)
  })
})

describe('buildTuFirmaFirmantes', () => {
  const alumno = { email: 'alumno@x.cl', nombre: 'Ana', rut: '1-9' }
  const apoderado = { email: 'apo@x.cl', nombre: 'Luis', rut: '2-7' }

  it('solo alumno si no incluirApoderado', () => {
    const r = buildTuFirmaFirmantes({
      alumno,
      incluirApoderado: false,
      signaturePage: 4,
      emailOverride: '',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.firmantes.length, 1)
    assert.equal(r.firmantes[0].rol, 'alumno')
    assert.equal(r.fields.length, 1)
    assert.equal(r.fields[0].filler, 'alumno@x.cl')
    assert.equal(r.fields[0].page, 4)
    assert.equal(r.fields[0].x, 0.08)
  })

  it('alumno + apoderado en paralelo', () => {
    const r = buildTuFirmaFirmantes({
      alumno,
      incluirApoderado: true,
      apoderado,
      signaturePage: 5,
      emailOverride: '',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.firmantes.length, 2)
    assert.equal(r.fields[1].filler, 'apo@x.cl')
    assert.equal(r.fields[1].x, 0.55)
    assert.equal(r.fields[1].page, 5)
  })

  it('override produce emails distintos', () => {
    const r = buildTuFirmaFirmantes({
      alumno,
      incluirApoderado: true,
      apoderado,
      signaturePage: 1,
      emailOverride: 'juan.silva@uniacc.cl',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.firmantes[0].email, 'juan.silva+alumno@uniacc.cl')
    assert.equal(r.firmantes[1].email, 'juan.silva+apoderado@uniacc.cl')
    assert.equal(r.fields[0].filler, r.firmantes[0].email)
  })

  it('falla sin email de alumno y sin override', () => {
    const r = buildTuFirmaFirmantes({
      alumno: { ...alumno, email: '' },
      incluirApoderado: false,
      signaturePage: 1,
      emailOverride: '',
    })
    assert.equal(r.ok, false)
  })

  it('falla apoderado sin email y sin override', () => {
    const r = buildTuFirmaFirmantes({
      alumno,
      incluirApoderado: true,
      apoderado: { ...apoderado, email: '—' },
      signaturePage: 1,
      emailOverride: '',
    })
    assert.equal(r.ok, false)
  })

  it('falla si emails finales coinciden', () => {
    const r = buildTuFirmaFirmantes({
      alumno,
      incluirApoderado: true,
      apoderado: { ...apoderado, email: 'alumno@x.cl' },
      signaturePage: 1,
      emailOverride: '',
    })
    assert.equal(r.ok, false)
  })

  it('con override no exige email original válido', () => {
    const r = buildTuFirmaFirmantes({
      alumno: { ...alumno, email: '' },
      incluirApoderado: false,
      signaturePage: 1,
      emailOverride: 'juan.silva@uniacc.cl',
    })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.firmantes[0].email, 'juan.silva+alumno@uniacc.cl')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/tufirma-firmantes.test.ts`

Expected: FAIL (módulo no existe)

- [ ] **Step 4: Implement**

```ts
export type TuFirmaRol = 'alumno' | 'apoderado'

export const FIRMA_ALUMNO_BOX = { x: 0.08, y: 0.28, width: 0.35, height: 0.10 } as const
export const FIRMA_APODERADO_BOX = { x: 0.55, y: 0.28, width: 0.35, height: 0.10 } as const

export type TuFirmaField = {
  filler: string
  type: 'signature'
  required: true
  name: string
  x: number
  y: number
  width: number
  height: number
  page: number
}

export type TuFirmaFirmante = {
  email: string
  nombre: string
  rut: string
  rol: TuFirmaRol
}

export type PersonaFirma = { email: string; nombre: string; rut: string }

export type BuildTuFirmaFirmantesInput = {
  alumno: PersonaFirma
  incluirApoderado: boolean
  apoderado?: PersonaFirma
  signaturePage: number
  emailOverride: string
}

export type BuildFirmantesOk = { ok: true; firmantes: TuFirmaFirmante[]; fields: TuFirmaField[] }
export type BuildFirmantesErr = { ok: false; error: string }

export function emailValido(email: string): boolean {
  const t = email.trim()
  if (!t || t === '—' || t.toLowerCase() === 'sin información') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

export function applyTuFirmaEmailOverride(
  email: string,
  rol: TuFirmaRol,
  override: string,
): string {
  const ov = override.trim()
  if (!ov) return email.trim()
  const at = ov.lastIndexOf('@')
  if (at <= 0) return ov
  return `${ov.slice(0, at)}+${rol}${ov.slice(at)}`
}

function fieldFor(
  firmante: TuFirmaFirmante,
  page: number,
  box: { x: number; y: number; width: number; height: number },
  name: string,
): TuFirmaField {
  return {
    filler: firmante.email,
    type: 'signature',
    required: true,
    name,
    page,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  }
}

export function buildTuFirmaFirmantes(
  input: BuildTuFirmaFirmantesInput,
): BuildFirmantesOk | BuildFirmantesErr {
  const override = input.emailOverride.trim()
  const emailAlumno = applyTuFirmaEmailOverride(input.alumno.email, 'alumno', override)
  if (!emailValido(emailAlumno)) {
    return { ok: false, error: 'Falta el correo del alumno' }
  }
  const alumno: TuFirmaFirmante = {
    email: emailAlumno,
    nombre: input.alumno.nombre.trim() || 'Alumno',
    rut: input.alumno.rut.trim(),
    rol: 'alumno',
  }
  const firmantes: TuFirmaFirmante[] = [alumno]
  const fields: TuFirmaField[] = [
    fieldFor(alumno, input.signaturePage, FIRMA_ALUMNO_BOX, 'Firma alumno'),
  ]

  if (input.incluirApoderado) {
    const apoSrc = input.apoderado
    if (!apoSrc) return { ok: false, error: 'Faltan datos del apoderado' }
    const emailApo = applyTuFirmaEmailOverride(apoSrc.email, 'apoderado', override)
    if (!emailValido(emailApo)) {
      return { ok: false, error: 'Falta el correo del apoderado' }
    }
    if (emailApo.toLowerCase() === emailAlumno.toLowerCase()) {
      return { ok: false, error: 'Alumno y apoderado no pueden compartir el mismo email' }
    }
    const apo: TuFirmaFirmante = {
      email: emailApo,
      nombre: apoSrc.nombre.trim() || 'Apoderado',
      rut: apoSrc.rut.trim(),
      rol: 'apoderado',
    }
    firmantes.push(apo)
    fields.push(fieldFor(apo, input.signaturePage, FIRMA_APODERADO_BOX, 'Firma apoderado'))
  }

  return { ok: true, firmantes, fields }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/tufirma-firmantes.test.ts`

Expected: PASS

- [ ] **Step 6: Commit (uniacc-api-docker)**

```bash
cd /opt/uniacc-api-docker
git add package.json src/services/tufirma-firmantes.ts src/services/tufirma-firmantes.test.ts
git commit -m "$(cat <<'EOF'
feat: mapeo de firmantes simples TuFirma con override de email

EOF
)"
```

---

### Task 2: Página de firmas en el PDF y conteo de páginas

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/pdf-page-count.ts`
- Create: `/opt/uniacc-api-docker/src/services/pdf-page-count.test.ts`
- Modify: `/opt/uniacc-api-docker/src/services/contrato-preview-pdf.service.ts` (al final del `content`, antes de `createPdf`)

**Interfaces:**
- Consumes: `buildContratoPreviewPdf` existente
- Produces: `countPdfPages(pdf: Buffer): number` — el PDF de preview/firma incluye página final “Firmas electrónicas” con `pageBreak: 'before'`

- [ ] **Step 1: Write the failing test**

Minimal 1-page PDF (header `%PDF-1.4` + `/Type /Page`):

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { countPdfPages } from './pdf-page-count'

const ONE_PAGE = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Page>>endobj\ntrailer<>\n%%EOF\n',
  'latin1',
)

describe('countPdfPages', () => {
  it('cuenta /Type /Page y no /Pages', () => {
    assert.equal(countPdfPages(ONE_PAGE), 1)
    const two = Buffer.from(
      '%PDF-1.4\n/Type /Pages\n/Type /Page\n/Type /Page\n',
      'latin1',
    )
    assert.equal(countPdfPages(two), 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/pdf-page-count.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement countPdfPages**

```ts
export function countPdfPages(pdf: Buffer): number {
  const text = pdf.toString('latin1')
  const matches = text.match(/\/Type\s*\/Page(?![sA-Za-z])/g)
  return matches?.length ?? 0
}
```

- [ ] **Step 4: Pass page-count tests**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/pdf-page-count.test.ts`

Expected: PASS

- [ ] **Step 5: Add last page to PDF**

In `buildContratoPreviewPdf`, after the existing pie de página `content.push`, append:

```ts
  content.push({
    text: 'Firmas electrónicas',
    style: 'title',
    pageBreak: 'before',
    margin: [0, 0, 0, 16],
  })
  content.push({
    text: 'Estampas TuFirma (firma electrónica simple). El recuadro se completa al firmar desde el correo.',
    fontSize: 9,
    margin: [0, 0, 0, 24],
  })
  content.push({
    columns: [
      {
        stack: [
          { text: '________________________', alignment: 'center', margin: [0, 80, 0, 4] },
          { text: 'Estudiante o Alumno', alignment: 'center', bold: true },
          { text: model.alumno.nombre, alignment: 'center', fontSize: 8 },
        ],
      },
      {
        stack: [
          { text: '________________________', alignment: 'center', margin: [0, 80, 0, 4] },
          { text: 'Sostenedor Financiero', alignment: 'center', bold: true },
          { text: model.sostenedor.nombre, alignment: 'center', fontSize: 8 },
        ],
      },
    ],
    columnGap: 24,
  })
```

Do **not** change the three-line block in the middle of the contract; TuFirma stamps only this last page.

- [ ] **Step 6: Commit (uniacc-api-docker)**

```bash
cd /opt/uniacc-api-docker
git add src/services/pdf-page-count.ts src/services/pdf-page-count.test.ts src/services/contrato-preview-pdf.service.ts
git commit -m "$(cat <<'EOF'
feat: página final de firmas electrónicas en el PDF de contrato

EOF
)"
```

---

### Task 3: Tabla Postgres `rematricula_contrato_tufirma`

**Files:**
- Create: `/opt/uniacc-api-docker/src/migrations/007_rematricula_contrato_tufirma.sql`

**Interfaces:**
- Consumes: pool `query()` de `src/config/postgres.ts`
- Produces: tabla `rematricula_contrato_tufirma` con `num_operacion` UNIQUE

- [ ] **Step 1: Write migration**

```sql
-- psql -U postgres -d <POSTGRES_DB> -f src/migrations/007_rematricula_contrato_tufirma.sql

CREATE TABLE IF NOT EXISTS rematricula_contrato_tufirma (
    num_operacion TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    rut TEXT,
    codcli TEXT,
    nombre TEXT,
    carrera TEXT,
    periodo TEXT,
    firmantes JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rematricula_contrato_tufirma_document_id_idx
  ON rematricula_contrato_tufirma (document_id);
```

- [ ] **Step 2: Apply on the API Postgres** (same DB as `mv_firma_acepta_sync` / `POSTGRES_*`)

Run the `psql` command from the migration header. Confirm `\d rematricula_contrato_tufirma`.

- [ ] **Step 3: Commit (uniacc-api-docker)**

```bash
cd /opt/uniacc-api-docker
git add src/migrations/007_rematricula_contrato_tufirma.sql
git commit -m "$(cat <<'EOF'
feat: tabla rematricula_contrato_tufirma para idempotencia TuFirma

EOF
)"
```

---

### Task 4: Cliente HTTP TuFirma

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/tufirma-client.ts`
- Create: `/opt/uniacc-api-docker/src/services/tufirma-client.test.ts`

**Interfaces:**
- Consumes: `fetch` inyectable; `TU_FIRMA_API_KEY`, `TU_FIRMA_BASE_URL`
- Produces:
  - `export type TuFirmaConfig = { baseUrl: string; apiKey: string }`
  - `createTuFirmaClient(config: TuFirmaConfig, fetchImpl?: typeof fetch)`
  - `client.createDocument(body: unknown): Promise<{ ok: true; data: TuFirmaDocument } | { ok: false; status: number; error: string }>`
  - `client.getDocument(id: string): Promise<...>`
  - `client.downloadDocument(id: string): Promise<{ ok: true; pdf: Buffer } | { ok: false; status: number; error: string }>`
  - `client.getCostCenters(): Promise<{ requiresCostUnit: boolean; firstUnitId: string | null }>`

`TuFirmaDocument` mínimo: `{ _id: string; ready: boolean; firmantes: Array<{ email: string; nombre: string; ready?: boolean; tipo?: string }> }`

Auth header: `Authorization: Bearer ${apiKey}`. Base URL sin slash final. Paths: `/public/documents/create`, `/public/documents/${id}`, `/public/documents/${id}/download`, `/public/cost-centers`.

Download: if JSON `{ document: base64 }`, decode; if `content-type` PDF, `Buffer.from(arrayBuffer)`.

- [ ] **Step 1: Write failing tests** (mock fetch)

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createTuFirmaClient } from './tufirma-client'

describe('createTuFirmaClient', () => {
  it('POST create con Bearer y body JSON', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response(JSON.stringify({ _id: 'doc-1', ready: false, firmantes: [] }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const client = createTuFirmaClient(
      { baseUrl: 'https://api.aws.staging.tufirma.digital/api', apiKey: 'tf_sk_test' },
      fetchImpl,
    )
    const r = await client.createDocument({ nombre: 'x' })
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.data._id, 'doc-1')
    assert.equal(calls[0].url, 'https://api.aws.staging.tufirma.digital/api/public/documents/create')
    const headers = calls[0].init.headers as Record<string, string>
    assert.equal(headers.Authorization, 'Bearer tf_sk_test')
  })

  it('GET document 404 → ok false', async () => {
    const fetchImpl: typeof fetch = async () => new Response('no', { status: 404 })
    const client = createTuFirmaClient(
      { baseUrl: 'https://example/api', apiKey: 'k' },
      fetchImpl,
    )
    const r = await client.getDocument('missing')
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.equal(r.status, 404)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/tufirma-client.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement client**

```ts
export type TuFirmaConfig = { baseUrl: string; apiKey: string }

export type TuFirmaDocument = {
  _id: string
  ready: boolean
  firmantes: Array<{ email: string; nombre: string; ready?: boolean; tipo?: string }>
}

export type TuFirmaResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

export type TuFirmaClient = {
  createDocument: (body: unknown) => Promise<TuFirmaResult<TuFirmaDocument>>
  getDocument: (id: string) => Promise<TuFirmaResult<TuFirmaDocument>>
  downloadDocument: (id: string) => Promise<{ ok: true; pdf: Buffer } | { ok: false; status: number; error: string }>
  getCostCenters: () => Promise<{ requiresCostUnit: boolean; firstUnitId: string | null }>
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function asDocument(raw: unknown): TuFirmaDocument | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o._id === 'string' ? o._id : null
  if (!id) return null
  const firmantesRaw = Array.isArray(o.firmantes) ? o.firmantes : []
  return {
    _id: id,
    ready: o.ready === true,
    firmantes: firmantesRaw.map((f) => {
      const row = f && typeof f === 'object' ? (f as Record<string, unknown>) : {}
      return {
        email: String(row.email ?? ''),
        nombre: String(row.nombre ?? ''),
        ready: row.ready === true,
        tipo: typeof row.tipo === 'string' ? row.tipo : undefined,
      }
    }),
  }
}

export function createTuFirmaClient(
  config: TuFirmaConfig,
  fetchImpl: typeof fetch = globalThis.fetch,
): TuFirmaClient {
  const base = config.baseUrl.replace(/\/$/, '')

  async function parseJson(res: Response): Promise<TuFirmaResult<TuFirmaDocument>> {
    const text = await res.text()
    if (!res.ok) {
      return { ok: false, status: res.status, error: text.slice(0, 500) || `HTTP ${res.status}` }
    }
    let parsed: unknown = null
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      return { ok: false, status: res.status, error: 'Respuesta TuFirma no es JSON' }
    }
    const doc = asDocument(parsed)
    if (!doc) return { ok: false, status: res.status, error: 'Documento TuFirma inválido' }
    return { ok: true, data: doc }
  }

  return {
    async createDocument(body: unknown) {
      const res = await fetchImpl(`${base}/public/documents/create`, {
        method: 'POST',
        headers: headers(config.apiKey),
        body: JSON.stringify(body),
      })
      return parseJson(res)
    },
    async getDocument(id: string) {
      const res = await fetchImpl(`${base}/public/documents/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: headers(config.apiKey),
      })
      return parseJson(res)
    },
    async downloadDocument(id: string) {
      const res = await fetchImpl(
        `${base}/public/documents/${encodeURIComponent(id)}/download`,
        { method: 'GET', headers: { Authorization: `Bearer ${config.apiKey}` } },
      )
      if (!res.ok) {
        return { ok: false as const, status: res.status, error: `HTTP ${res.status}` }
      }
      const ctype = res.headers.get('content-type') || ''
      if (ctype.includes('application/pdf')) {
        return { ok: true as const, pdf: Buffer.from(await res.arrayBuffer()) }
      }
      const json = (await res.json()) as { document?: string }
      if (typeof json.document === 'string') {
        return { ok: true as const, pdf: Buffer.from(json.document, 'base64') }
      }
      return { ok: false as const, status: 502, error: 'Download TuFirma sin PDF' }
    },
    async getCostCenters() {
      try {
        const res = await fetchImpl(`${base}/public/cost-centers`, {
          method: 'GET',
          headers: headers(config.apiKey),
        })
        if (!res.ok) return { requiresCostUnit: false, firstUnitId: null }
        const raw = (await res.json()) as {
          requiresCostUnit?: boolean
          costCenters?: Array<{ units?: Array<{ id?: string }> }>
        }
        const firstUnitId = raw.costCenters?.[0]?.units?.[0]?.id ?? null
        return { requiresCostUnit: raw.requiresCostUnit === true, firstUnitId }
      } catch {
        return { requiresCostUnit: false, firstUnitId: null }
      }
    },
  }
}
```

- [ ] **Step 4: Pass tests**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/tufirma-client.test.ts`

Expected: PASS

- [ ] **Step 5: Commit (uniacc-api-docker)**

```bash
cd /opt/uniacc-api-docker
git add src/services/tufirma-client.ts src/services/tufirma-client.test.ts
git commit -m "$(cat <<'EOF'
feat: cliente HTTP TuFirma (create, get, download)

EOF
)"
```

---

### Task 5: Servicio ensure / status / list / documento

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/tufirma-contrato.service.ts`
- Create: `/opt/uniacc-api-docker/src/services/tufirma-contrato.service.test.ts`

**Interfaces:**
- Consumes: `buildTuFirmaFirmantes`, `countPdfPages`, `buildContratoPreviewPdf`, `createTuFirmaClient`, `query` (inyectable en tests)
- Produces:
  - `export type ContratoFirmaEnsureBody` = `ContratoMatriculaViewModelDto` + `{ incluirApoderado: boolean; codcli: string }`
  - `export type ContratoFirmaEstado = { ok: true; created: boolean; numOperacion: string; documentId: string; ready: boolean; firmantes: Array<{ email: string; nombre: string; rol: TuFirmaRol; ready: boolean }> }`
  - `ensureContratoFirma(body, deps): Promise<ContratoFirmaEstado | { ok: false; error: string; status: number }>`
  - `statusContratoFirma(numOperacion, deps)`
  - `listContratoFirma(deps)` — filas tabla + `getDocument` por cada una
  - `downloadContratoFirma(numOperacion, deps): Promise<{ ok: true; pdf: Buffer } | { ok: false; error: string; status: number }>`

`deps`:

```ts
export type TuFirmaContratoDeps = {
  emailOverride: string
  findByNumOperacion: (n: string) => Promise<{
    num_operacion: string
    document_id: string
    firmantes: TuFirmaFirmante[]
  } | null>
  insertRow: (row: {
    numOperacion: string
    documentId: string
    rut: string
    codcli: string
    nombre: string
    carrera: string
    periodo: string
    firmantes: TuFirmaFirmante[]
  }) => Promise<void>
  listRows: () => Promise<Array<{
    num_operacion: string
    document_id: string
    rut: string | null
    codcli: string | null
    nombre: string | null
    carrera: string | null
    periodo: string | null
    firmantes: TuFirmaFirmante[]
    created_at: string
  }>>
  buildPdf: (model: ContratoMatriculaViewModelDto) => Promise<Buffer>
  client: ReturnType<typeof createTuFirmaClient>
}
```

`ensure` logic:
1. If `findByNumOperacion` hits → `getDocument` → map `ready` by matching `firmantes[].email` (case-insensitive) to stored rol; `created: false`. Do not create.
2. Else `buildTuFirmaFirmantes` (signaturePage temporarily `1`) → generate PDF → `page = countPdfPages(pdf)`; if `page < 1` error → rebuild fields with real page via `buildTuFirmaFirmantes` again with `signaturePage: page`.
3. `getCostCenters`; if `requiresCostUnit && firstUnitId` add `costUnitIds: [firstUnitId]`; if requires and no id, return 422 error without retry loop.
4. `createDocument({ nombre: \`Contrato rematrícula ${numOperacion}\`, descripcion: \`${periodo} — ${rut}\`, firmantes: [{email,nombre,rut}], fields, documentoB64: pdf.toString('base64'), documentoMimeType: 'application/pdf', tags: ['rematricula', numOperacion], ...costUnitIds })`.
5. `insertRow` with `_id`.
6. Return `created: true`, `ready: false`.

Map GET firmantes: for each stored firmante, `ready = doc.firmantes.find(f => f.email.toLowerCase() === email)?.ready === true`. Document `ready` true if `doc.ready === true` or every stored firmante ready.

- [ ] **Step 1: Write failing tests**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ContratoMatriculaViewModelDto } from '../types/contrato-matricula'
import { ensureContratoFirma, type TuFirmaContratoDeps } from './tufirma-contrato.service'
import type { TuFirmaClient, TuFirmaDocument } from './tufirma-client'
import type { TuFirmaFirmante } from './tufirma-firmantes'

function miniPdf(): Buffer {
  return Buffer.from('%PDF-1.4\n/Type /Page\n%%EOF\n', 'latin1')
}

function model(): ContratoMatriculaViewModelDto {
  return {
    numOperacion: 'OP1',
    contrato: 'C1',
    fechaContratoLabel: '1 septiembre 2026',
    ciudadFirma: 'Santiago',
    periodoAcademico: '2027/1',
    alumno: {
      nombre: 'Ana',
      rut: '1-9',
      domicilio: 'x',
      comuna: 'x',
      ciudad: 'x',
      nacionalidad: 'x',
      estadoCivil: 'x',
      profesion: 'x',
      domiciliadoLabel: 'domiciliado',
      carrera: 'Derecho',
      jornada: 'D',
    },
    sostenedor: {
      nombre: 'Luis',
      rut: '2-7',
      domicilio: 'x',
      comuna: 'x',
      ciudad: 'x',
      nacionalidad: 'x',
      estadoCivil: 'x',
      profesion: 'x',
      domiciliadoLabel: 'domiciliado',
    },
    emailAlumno: 'ana@x.cl',
    emailApoderado: 'luis@x.cl',
    valorMatricula: 1,
    valorArancel: 1,
    cuotas: [],
    representante: { nombre: 'Rep', rut: '3-5' },
    asignaturasNuevo: false,
  }
}

function deps(opts: {
  existing?: { document_id: string; firmantes: TuFirmaFirmante[] }
  createImpl?: TuFirmaClient['createDocument']
}): { d: TuFirmaContratoDeps; created: number } {
  const store = new Map<string, { document_id: string; firmantes: TuFirmaFirmante[] }>()
  if (opts.existing) store.set('OP1', opts.existing)
  let created = 0
  const client: TuFirmaClient = {
    createDocument: async (body) => {
      created += 1
      if (opts.createImpl) return opts.createImpl(body)
      return {
        ok: true,
        data: { _id: 'new-id', ready: false, firmantes: [] } satisfies TuFirmaDocument,
      }
    },
    getDocument: async (id) => ({
      ok: true,
      data: { _id: id, ready: false, firmantes: [] },
    }),
    downloadDocument: async () => ({ ok: true, pdf: miniPdf() }),
    getCostCenters: async () => ({ requiresCostUnit: false, firstUnitId: null }),
  }
  const d: TuFirmaContratoDeps = {
    emailOverride: '',
    findByNumOperacion: async (n) => {
      const row = store.get(n)
      if (!row) return null
      return { num_operacion: n, document_id: row.document_id, firmantes: row.firmantes }
    },
    insertRow: async (row) => {
      store.set(row.numOperacion, { document_id: row.documentId, firmantes: row.firmantes })
    },
    listRows: async () => [],
    buildPdf: async () => miniPdf(),
    client,
  }
  return { d, get created() { return created } } as { d: TuFirmaContratoDeps; created: number }
}

describe('ensureContratoFirma', () => {
  it('reutiliza documento existente y no llama create', async () => {
    const bag = { n: 0 }
    const { d } = deps({
      existing: {
        document_id: 'doc-old',
        firmantes: [{ email: 'ana@x.cl', nombre: 'Ana', rut: '1-9', rol: 'alumno' }],
      },
    })
    const orig = d.client.createDocument
    d.client.createDocument = async (body) => {
      bag.n += 1
      return orig(body)
    }
    const r = await ensureContratoFirma({ ...model(), incluirApoderado: false, codcli: 'A1' }, d)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.created, false)
    assert.equal(r.documentId, 'doc-old')
    assert.equal(bag.n, 0)
  })

  it('400 si falta email y no hay override', async () => {
    const { d } = deps({})
    const r = await ensureContratoFirma(
      { ...model(), emailAlumno: '', incluirApoderado: false, codcli: 'A1' },
      d,
    )
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.equal(r.status, 400)
  })

  it('crea una vez e inserta', async () => {
    const { d } = deps({})
    const r = await ensureContratoFirma({ ...model(), incluirApoderado: false, codcli: 'A1' }, d)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.created, true)
    assert.equal(r.documentId, 'new-id')
    const again = await ensureContratoFirma({ ...model(), incluirApoderado: false, codcli: 'A1' }, d)
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.created, false)
    assert.equal(again.documentId, 'new-id')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/tufirma-contrato.service.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement service** (export `createDefaultTuFirmaContratoDeps()` that uses `query()`, `buildContratoPreviewPdf`, `createTuFirmaClient` from env)

`createDefaultTuFirmaContratoDeps`:
- `emailOverride = process.env.TU_FIRMA_EMAIL_OVERRIDE ?? ''`
- `baseUrl = process.env.TU_FIRMA_BASE_URL || 'https://api.aws.staging.tufirma.digital/api'`
- `apiKey = process.env.TU_FIRMA_API_KEY || ''`
- SQL find: `SELECT num_operacion, document_id, firmantes FROM rematricula_contrato_tufirma WHERE num_operacion = $1`
- insert: `INSERT INTO rematricula_contrato_tufirma (...) VALUES (...)`
- list: `SELECT num_operacion, document_id, rut, codcli, nombre, carrera, periodo, firmantes, created_at FROM rematricula_contrato_tufirma ORDER BY created_at DESC`

If `apiKey` empty, ensure/status return `{ ok: false, status: 503, error: 'TU_FIRMA_API_KEY no configurada' }`.

- [ ] **Step 4: Pass tests**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/tufirma-contrato.service.test.ts src/services/tufirma-firmantes.test.ts`

Expected: PASS

- [ ] **Step 5: Commit (uniacc-api-docker)**

```bash
cd /opt/uniacc-api-docker
git add src/services/tufirma-contrato.service.ts src/services/tufirma-contrato.service.test.ts
git commit -m "$(cat <<'EOF'
feat: ensure/status/list/download de contrato TuFirma

EOF
)"
```

---

### Task 6: Rutas HTTP rematrícula + env

**Files:**
- Create: `/opt/uniacc-api-docker/src/controllers/rematricula-alumno-contrato-firma.controller.ts`
- Modify: `/opt/uniacc-api-docker/src/routes/rematricula-alumno.routes.ts`
- Modify: `/opt/uniacc-api-docker/src/index.ts` (log de rutas nuevas junto al preview-pdf)
- Modify: uniacc-api `.env` / `.env.development` locally (do **not** git-add secrets)

**Interfaces:**
- Consumes: Task 5 functions
- Produces HTTP:
  - `POST /api/rematricula/alumno/contrato/firma/ensure`
  - `GET /api/rematricula/alumno/contrato/firma` (list — register **before** `/:numOperacion`)
  - `GET /api/rematricula/alumno/contrato/firma/:numOperacion/documento`
  - `GET /api/rematricula/alumno/contrato/firma/:numOperacion`

- [ ] **Step 1: Controller**

Reuse `validadoresContratoPreviewPdf` plus:

```ts
body('incluirApoderado').isBoolean()
body('codcli').isString().trim().notEmpty()
```

`ensure`: parse model like `generarContratoPreviewPdf`, add `incluirApoderado` / `codcli`, call `ensureContratoFirma`. 200 `{ ok: true, ... }` or `res.status(result.status).json(result)`.

`status` / `list` / `documento`: `documento` sends `Content-Type: application/pdf` and `res.send(pdf)` like preview-pdf.

- [ ] **Step 2: Routes** (order matters)

```ts
router.post('/contrato/firma/ensure', validadoresContratoFirmaEnsure, ensureContratoFirmaHttp)
router.get('/contrato/firma', listarContratoFirmaHttp)
router.get('/contrato/firma/:numOperacion/documento', descargarContratoFirmaHttp)
router.get('/contrato/firma/:numOperacion', estadoContratoFirmaHttp)
```

Keep existing `preview-pdf` route.

- [ ] **Step 3: Env (local, no commit)**

Add to uniacc-api `.env.development` (and `.env` if that is what the process loads):

```
TU_FIRMA_BASE_URL=https://api.aws.staging.tufirma.digital/api
TU_FIRMA_API_KEY=<mover la key de mol-docker/.env VITE_API_TU_FIRMA_STAGING, no commitear>
TU_FIRMA_EMAIL_OVERRIDE=juan.silva@uniacc.cl
```

In `mol-docker/.env` leave `VITE_API_TU_FIRMA_STAGING` unused (or delete locally). MOL must not read it.

- [ ] **Step 4: Typecheck**

Run: `cd /opt/uniacc-api-docker && npm run type-check`

Expected: PASS (tests stay excluded by tsconfig)

- [ ] **Step 5: Commit (uniacc-api-docker, no .env)**

```bash
cd /opt/uniacc-api-docker
git add src/controllers/rematricula-alumno-contrato-firma.controller.ts src/routes/rematricula-alumno.routes.ts src/index.ts
git commit -m "$(cat <<'EOF'
feat: endpoints BFF de firma de contrato TuFirma

EOF
)"
```

---

### Task 7: MOL — email apoderado + cliente BFF

**Files:**
- Modify: `/opt/mol-docker/src/composables/useMockAlumnoFuente.ts` (exponer `mailApoderadoMostrado`)
- Modify: `/opt/mol-docker/src/composables/useContratoMatriculaViewModel.ts` (`emailApoderado`)
- Create: `/opt/mol-docker/src/services/contratoFirmaApi.ts`
- Create: `/opt/mol-docker/src/services/contratoFirmaApi.test.ts` (solo URL builders / type guards if any; otherwise skip and test mapping in a tiny `contratoFirmaPayload.ts`)

**Interfaces:**
- Consumes: `admisionApiBaseUrl()`, `ContratoMatriculaViewModel`, `esPropioSostenedor`
- Produces:
  - `ensureContratoFirma(body: ContratoFirmaEnsureRequest): Promise<ContratoFirmaEstadoResponse>`
  - `getContratoFirmaEstado(numOperacion: string): Promise<...>`
  - `listContratoFirmas(): Promise<{ ok: boolean; data: ContratoFirmaListRow[] }>`
  - `downloadContratoFirmaPdf(numOperacion: string): Promise<{ ok: true; blob: Blob } | { ok: false; error: string }>`
  - `export type ContratoFirmaEnsureRequest = ContratoMatriculaViewModel & { incluirApoderado: boolean; codcli: string }`
  - `export type ContratoFirmaFirmanteEstado = { email: string; nombre: string; rol: 'alumno' | 'apoderado'; ready: boolean }`
  - `export type ContratoFirmaEstadoResponse = { ok: true; created: boolean; numOperacion: string; documentId: string; ready: boolean; firmantes: ContratoFirmaFirmanteEstado[] } | { ok: false; error: string }`

`mailApoderadoMostrado`: `pickStr(plan.value?.mail_apoder)` (same pattern as `nombreApoderadoMostrado`).

`emailApoderado` in view-model: if `mailApoderadoMostrado` is `—`, `null`; else the string. Do not use institucional.

- [ ] **Step 1: Wire emailApoderado** in view-model (replace `emailApoderado: null`).

- [ ] **Step 2: Implement `contratoFirmaApi.ts`** mirroring `contratoPreviewApi.ts` (JSON for ensure/status/list; blob for documento; 90s timeout on ensure).

- [ ] **Step 3: Type-check / unit if added**

Run: `cd /opt/mol-docker && yarn test:unit src/utils/apoderadoResponsable.test.ts`

Expected: PASS (sanity)

- [ ] **Step 4: Commit (mol-docker)**

```bash
cd /opt/mol-docker
git add src/composables/useMockAlumnoFuente.ts src/composables/useContratoMatriculaViewModel.ts src/services/contratoFirmaApi.ts
git commit -m "$(cat <<'EOF'
feat: cliente BFF TuFirma y email de apoderado en el contrato

EOF
)"
```

---

### Task 8: MOL — paso Firma (polling, sin FES mock)

**Files:**
- Modify: `/opt/mol-docker/src/views/matricula-mock/FirmaMockView.vue` (replace FES UI)
- Modify: `/opt/mol-docker/src/router/index.ts` (guard resumen)

**Interfaces:**
- Consumes: `ensureContratoFirma`, `getContratoFirmaEstado`, `useContratoMatriculaViewModel`, `esPropioSostenedor`, `setFirmaCompletada`
- Produces: al entrar con plan confirmado llama ensure una vez; poll 5 s; `ready` → `setFirmaCompletada(true)` + `router.push({ name: 'matricula-mock-resumen' })`. Guard: `to.name === 'matricula-mock-resumen' && !firmaCompletada` → redirect firma.

- [ ] **Step 1: Replace FirmaMockView**

Remove serie/OTP/`firmarContrato`. Keep preview + descarga borrador.

On `watch(tienePlanConfirmado, { immediate: true })` when true, `enviarAFirmar()`:
- Build `incluirApoderado = !esPropioSostenedor(fuente.plan.value?.es_responsable_financiero)`
- `codcli = fuente.codcliMostrado`
- Call `ensureContratoFirma({ ...viewModel, incluirApoderado, codcli })`
- Store estado (firmantes, error)
- If `ready`, complete and navigate
- Else `setInterval` 5000 → `getContratoFirmaEstado(numOperacion)` until ready or unmount
- If ensure fails, show error + button **Reintentar** (only retries ensure; backend no-ops if row exists)

Copy (Spanish):

- Título: `Firma del contrato`
- Descripción: `Enviamos el contrato a firmar por correo. Esta pantalla espera a que firmen todos.`
- Lista: nombre + email + badge Pendiente / Firmado
- No auto-loop ensure on error.

`onUnmounted` clear interval.

- [ ] **Step 2: Router guard**

Inside `isMockFlowRoute` block, after existing bloqueos:

```ts
    if (to.name === 'matricula-mock-resumen' && !mockCtx.firmaCompletada) {
      return { name: 'matricula-mock-firma', replace: true }
    }
```

- [ ] **Step 3: Manual smoke without TuFirma** (optional): UI shows error 503 if API key missing — acceptable.

- [ ] **Step 4: Commit (mol-docker)**

```bash
cd /opt/mol-docker
git add src/views/matricula-mock/FirmaMockView.vue src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: paso Firma espera TuFirma por correo en lugar de FES mock

EOF
)"
```

---

### Task 9: Backoffice Gestión de firmas

**Files:**
- Create: `/opt/mol-docker/src/views/dashboard/rematricula/GestionFirmasView.vue`
- Modify: `/opt/mol-docker/src/router/index.ts` (ruta nueva, mismo `meta` que Casos rematrícula: `requiresAdminAdmision`, `requiresSoloGrupoDvU`, `requiresPerfilUsuarioIn: [1, 2, 3]`)
- Modify: `/opt/mol-docker/src/constants/dashboardRouteNames.ts` add `'dashboard-gestion-firmas'`
- Modify: `/opt/mol-docker/src/views/dashboard/layout/menuIcons.ts` import `PenLine` and add to `ICON_MAP`
- Create: `/opt/mol-docker/supabase/migrations/20260911180000_bo_menu_gestion_firmas.sql`

**Interfaces:**
- Consumes: `listContratoFirmas`, `downloadContratoFirmaPdf`
- Produces: bandeja Todos / Pendiente / Firmado; search RUT/nombre/codcli; Actualizar; Ver → dialog con iframe PDF (blob URL) + lista firmantes. Sin aprobar/rechazar.

Menu row:

```sql
INSERT INTO public.bo_menu_item (
  id, parent_id, tipo, label, route_name, icon_key, orden, activo
) VALUES (
  'b0000001-0001-4000-8000-000000000041',
  'b0000001-0001-4000-8000-000000000020',
  'link',
  'Gestión de firmas',
  'dashboard-gestion-firmas',
  'PenLine',
  15,
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000041', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
```

Route: `path: '/dashboard/gestion-firmas'`, `name: 'dashboard-gestion-firmas'`.

UI: copy Casos card/table/tabs pattern. Tabs values: `todos` | `pendiente` | `firmado` filter `row.ready`. Columns: RUT, Alumno, Carrera, N° operación, Quién falta (`firmantes.filter(f => !f.ready).map(f => f.rol).join(', ') || '—'`), Estado (`row.ready ? 'Firmado' : 'Pendiente'`), Ver.

Dialog (`Dialog` + `DialogContent` class wide): iframe `blob:` of PDF; revoke URL on close. Load PDF when opening Ver.

- [ ] **Step 1: Migration + icon + route name + router**

- [ ] **Step 2: Implement GestionFirmasView.vue** (Composition API, tipos explícitos)

- [ ] **Step 3: Apply menu SQL** on the MOL Supabase used by this env (same process as other `bo_menu_item` migrations).

- [ ] **Step 4: Commit (mol-docker)**

```bash
cd /opt/mol-docker
git add src/views/dashboard/rematricula/GestionFirmasView.vue src/router/index.ts src/constants/dashboardRouteNames.ts src/views/dashboard/layout/menuIcons.ts supabase/migrations/20260911180000_bo_menu_gestion_firmas.sql
git commit -m "$(cat <<'EOF'
feat: bandeja Gestión de firmas con PDF TuFirma en pantalla

EOF
)"
```

---

### Task 10: Verificación staging (flujo completo)

No code unless a bug appears. Checklist:

1. `TU_FIRMA_API_KEY` + `TU_FIRMA_EMAIL_OVERRIDE=juan.silva@uniacc.cl` en uniacc-api; tabla migrada.
2. Alumno mock con plan confirmado entra a Firma → ensure 200 `created: true`.
3. Casilla `juan.silva@uniacc.cl` recibe correo(s) (`+alumno` y `+apoderado` si aplica).
4. MOL queda en Pendiente; no entra a resumen.
5. Firmar en TuFirma; en ≤5 s MOL pasa a resumen.
6. Recargar Firma: `created: false`, mismo `documentId`.
7. Gestión de firmas: fila pendiente luego firmada; Ver muestra PDF en ambos estados.
8. Confirm `VITE_API_TU_FIRMA_STAGING` no se usa en el bundle MOL.

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| create + firmantes simples + paralelo | 1, 5 |
| override juan.silva +aliases | 1, 6 |
| auto ensure al entrar | 8 |
| reutilizar numOperacion | 5 |
| wait until ready / poll 5s | 8 |
| guard resumen | 8 |
| PDF last page + fields | 1, 2, 5 |
| key solo servidor | 4, 6 |
| BFF endpoints | 6 |
| bandeja + PDF dialog | 9 |
| no webhook / no Acepta replace / no FEA | constraints |
| staging e2e | 10 |
