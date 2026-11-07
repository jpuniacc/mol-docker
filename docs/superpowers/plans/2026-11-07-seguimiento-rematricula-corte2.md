# Seguimiento rematrícula — CORTE 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar envío manual Correo/SMS desde el drawer CRM (chips 1–7) y re-cablear retención automática T+2h/T+24h a `mnp_retencion_outbox` con copy wireframes 06/07, solo en mol-dev.

**Architecture:** Capas sobre CRM v5. API: firma ejecutivo PG + `enviar-correo`/`enviar-sms` → bitácora. Batch retención deja de escribir `mol_retencion_aviso` y pasa a upsert/enviar/cancelar en outbox. UI: Contactar ▾ → TipTap correo + composer SMS. WhatsApp fuera (CORTE 3).

**Tech Stack:** Vue 3 + TipTap (ya en `package.json`) + shadcn-vue · Express/TS uniacc-api · EmailService + Celmedia · Postgres/Supabase · node:test

**Spec:** `docs/superpowers/specs/2026-11-06-seguimiento-rematricula-corte2-design.md` (`ea51ee3`)  
**Wireframes:** `docs/wireframes/seguimiento-rematricula-v2/` (04–07)

## Global Constraints

- Solo **mol-dev / uniacc-desarrollo**; no prod.
- **From manual** = email de **sesión** (`X-Mol-Email` / autor). **From auto** = email ejecutivo de **cartera** (`mnp_cartera_oficial`). Si un supervisor envía sobre caso ajeno, From sesión ≠ cartera — **intencional**; documentar en UI (De bloqueado = sesión).
- **Sin backfill** `mol_retencion_aviso` → outbox: indicadores arrancan con el batch nuevo; casos ya avisados por el job viejo pueden verse “sin mail 2h / n/a” hasta el próximo ciclo — aceptable; mencionar en smoke.
- Chip 8 Matriculado U+: **sin** Contactar ni envíos.
- WhatsApp: disabled «Próximamente» (nunca texto «corte 3» en UI).
- No bypass SMS (`OTP_SMS_BYPASS_SIN_SALDO`) en caminos nuevos.
- SMS (manual y auto): solo 09:00–21:00 America/Santiago.
- No mezclar hotfix progreso / Webpay forma_pago.
- Naranja `#FF5B00`, navy `#1E3A5F`.
- Bitácora manual: canal `correo|sms`, origen `manual`; plantilla/asunto/preview van en `nota` (texto estructurado; no hay columnas dedicadas).
- **Batch automático apagado por defecto en mol-dev:** `RETENCION_OUTBOX_DRY_RUN=1` (default si unset en non-prod) **o** allowlist `RETENCION_OUTBOX_RUTS` (RUTs normalizados separados por coma). Sin dry-run=0 **y** sin allowlist → el batch **no envía** a alumnos reales (solo enqueue/log). Smoke usa dry-run o 1–2 RUT de prueba.
- **`mnp_ejecutivo_firma`:** solo `service_role` (SELECT/INSERT/UPDATE). **Prohibido** `GRANT … TO anon, authenticated` — la anon key vive en el front.
- **From SMTP:** confirmar relay/SPF; plan B si From ejecutivo falla → From=`SMTP_FROM` + display name ejecutivo + Reply-To=email ejecutivo.

## File map

| Archivo | Rol |
|---------|-----|
| `mol-docker/supabase/migrations/20261107120000_seguimiento_corte2.sql` | `mnp_ejecutivo_firma` (solo service_role) + GRANT INSERT/UPDATE outbox |
| `uniacc-api-docker/src/services/email.service.ts` | From/Reply-To por envío |
| `uniacc-api-docker/src/services/seguimiento-html-sanitize.ts` (+ test) | Sanitizar HTML TipTap |
| `uniacc-api-docker/src/services/seguimiento-firma-ejecutivo.service.ts` (+ test) | GET/PUT firma |
| `uniacc-api-docker/src/services/seguimiento-envio.service.ts` (+ test) | enviar correo/SMS + bitácora |
| `uniacc-api-docker/src/services/rematricula-retencion-templates.ts` (+ test) | Copy 06/07 |
| `uniacc-api-docker/src/services/rematricula-retencion.service.ts` (+ test) | Batch → outbox; cancelar F |
| `uniacc-api-docker/src/controllers/rematricula-seguimiento.controller.ts` | HTTP envíos + firma |
| `uniacc-api-docker/src/routes/rematricula-seguimiento.routes.ts` | Rutas nuevas |
| `mol-docker/src/services/seguimientoRematriculaApi.ts` | Client envíos/firma |
| `mol-docker/src/components/rich-text/RichTextEditor.vue` | Reutilizar TipTap existente (no reinventar) |
| `mol-docker/src/components/seguimiento/SeguimientoComposerCorreo.vue` | Dialog correo 04 |
| `mol-docker/src/components/seguimiento/SeguimientoComposerSms.vue` | Dialog SMS 05 |
| `mol-docker/src/components/seguimiento/SeguimientoCasoDrawer.vue` | Contactar ▾ real |
| `mol-docker/docs/wireframes/.../smoke/` | Notas smoke + matiz sin backfill |

---

### Task 1: Migración firma + grants outbox

**Files:**
- Create: `mol-docker/supabase/migrations/20261107120000_seguimiento_corte2.sql`

**SQL:**

```sql
CREATE TABLE IF NOT EXISTS public.mnp_ejecutivo_firma (
  email text PRIMARY KEY,
  mime text NOT NULL CHECK (mime IN ('image/png', 'image/jpeg')),
  bytes bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mnp_ejecutivo_firma_size_chk CHECK (octet_length(bytes) <= 512000)
);

GRANT SELECT, INSERT, UPDATE ON public.mnp_ejecutivo_firma TO service_role;
-- NO grant a anon/authenticated (firma privada; API via service_role)

GRANT INSERT, UPDATE ON public.mnp_retencion_outbox TO service_role;
```

- [ ] **Step 1:** Crear migración con el SQL de arriba (sin grants anon/authenticated).
- [ ] **Step 2:** Apply en supabase-db:
  `docker cp … supabase-db:/tmp/… && docker exec supabase-db psql -U postgres -d postgres -f /tmp/…`
- [ ] **Step 3:** Verificar `\d public.mnp_ejecutivo_firma`, grants solo `service_role`, y grants outbox.
- [ ] **Step 4:** Commit  
  `feat(seguimiento): migración firma ejecutivo + grants outbox CORTE 2`

---

### Task 2: Mailer From/Reply-To + sanitize HTML

**Files:**
- Modify: `uniacc-api-docker/src/services/email.service.ts` (`enviarMailRematriculaAviso`)
- Create: `uniacc-api-docker/src/services/seguimiento-html-sanitize.ts`
- Create: `uniacc-api-docker/src/services/seguimiento-html-sanitize.test.ts`

**Interfaces:**

```ts
// email.service — ampliar payload
enviarMailRematriculaAviso(payload: {
  to: string
  cc?: string | null
  subject: string
  html: string
  text: string
  fromEmail?: string   // si falta → SMTP_FROM (compat)
  fromName?: string
  replyTo?: string
}): Promise<void>

// sanitize
export function sanitizeSeguimientoHtml(html: string): string
// allow: p, br, strong, b, em, i, u, ul, ol, li, a[href]
// strip: script, style, on*, javascript: URLs
```

**From mode helper (exportable):**

```ts
export type FromMode = 'direct' | 'relay_reply_to'
/** direct: From=ejecutivo; relay_reply_to (plan B): From=SMTP_FROM, name=ejecutivo, Reply-To=ejecutivo */
export function resolverFromSeguimiento(input: {
  ejecutivoEmail: string
  ejecutivoNombre?: string
  mode: FromMode
  smtpFrom: string
}): { fromEmail: string; fromName: string; replyTo: string }
```

Env `SEGUIMIENTO_FROM_MODE=direct|relay_reply_to` (default `direct` hasta smoke SMTP).

- [ ] **Step 1:** Test sanitize: strip `<script>`, `onerror=`, keep `<b>`/`<a href="https://…">`.
- [ ] **Step 2:** RED → implementar sanitize (usar `sanitize-html` si ya está en deps; si no, allowlist regex mínima + tests, o añadir dep con justificación).
- [ ] **Step 3:** Extender `enviarMailRematriculaAviso` con From/Reply-To + `resolverFromSeguimiento`; test unitario del armado de opciones.
- [ ] **Step 4:** Envío real de prueba (mol-dev SMTP) a un buzón interno con From=ejecutivo. Si rebota/SPF falla → set `SEGUIMIENTO_FROM_MODE=relay_reply_to` y documentar en smoke. No dejar `direct` en prod-like sin evidencia.
- [ ] **Step 5:** Commit  
  `feat(seguimiento): From/Reply-To por envío + sanitize HTML composer`

---

### Task 3: API firma ejecutivo

**Files:**
- Create: `uniacc-api-docker/src/services/seguimiento-firma-ejecutivo.service.ts`
- Create: `uniacc-api-docker/src/services/seguimiento-firma-ejecutivo.service.test.ts`
- Modify: controller + routes

**Interfaces:**

```ts
export async function obtenerFirmaEjecutivo(email: string): Promise<{
  mime: string
  base64: string
  updated_at: string
} | null>

export async function guardarFirmaEjecutivo(input: {
  email: string
  mime: 'image/png' | 'image/jpeg'
  base64: string // sin data: prefix; max 512000 decoded
}): Promise<void>
```

HTTP:
- `GET /api/rematricula/seguimiento/ejecutivo/firma` → email desde `X-Mol-Email`
- `PUT` body `{ mime, base64 }`

- [ ] **Step 1:** Tests: reject mime inválido; reject >512KB; roundtrip mock query si el patrón del repo lo permite (o validación pura + integración ligera).
- [ ] **Step 2:** Implementar service + HTTP.
- [ ] **Step 3:** Commit  
  `feat(seguimiento): GET/PUT firma ejecutivo CORTE 2`

---

### Task 4: Envío manual correo/SMS + bitácora

**Files:**
- Create: `uniacc-api-docker/src/services/seguimiento-envio.service.ts`
- Create: `uniacc-api-docker/src/services/seguimiento-envio.service.test.ts`
- Modify: controller + routes
- Modify: `crearContactoSeguimiento` usage o insert directo

**Interfaces:**

```ts
export type PlantillaCorreoSeguimiento =
  | 'retencion_2h'
  | 'recordatorio_firma'
  | 'recordatorio_forma_pago'
  | 'personalizado'

export async function enviarCorreoSeguimientoManual(input: {
  codcli: string
  anio: number
  semestre: number
  autorEmail: string // SESIÓN → From + Reply-To + autor bitácora
  emailFiltroCartera: string | null
  plantilla: PlantillaCorreoSeguimiento
  asunto: string
  html: string
  incluirFirma: boolean
}): Promise<{ ok: true } | { ok: false; status: number; message: string }>

export async function enviarSmsSeguimientoManual(input: {
  codcli: string
  anio: number
  semestre: number
  autorEmail: string
  emailFiltroCartera: string | null
  texto: string // ≤139
  ahora?: Date
}): Promise<{ ok: true } | { ok: false; status: number; message: string }>
```

**Reglas:**
1. `obtenerCasoSeguimiento` + chip ≠ `matriculado` (403/400 si chip 8).
2. Correo: `email_alumno` requerido; sanitize HTML; From/Reply-To = **`autorEmail` (sesión)**; adjuntar firma si pedida y existe.
3. SMS: `telefono` requerido; `horaPermiteSmsChile`; Celmedia; **sin** bypass.
4. Bitácora solo si envío OK:  
   `nota` ej. `[plantilla:retencion_2h] asunto=… | preview=…` / `[sms] texto=…`
5. Fallo proveedor → no bitácora; status 502.

Plantillas correo: precargar asunto/cuerpo desde funciones puras (retención 2h = copy 06; otras = stubs cortos editables).

- [ ] **Step 1:** Tests: chip matriculado rechaza; sin email/tel 400; SMS fuera de ventana 400; sanitize aplicado; bitácora solo en éxito (mock deps).
- [ ] **Step 2:** Implementar + HTTP  
  `POST .../casos/:codcli/enviar-correo`  
  `POST .../casos/:codcli/enviar-sms`
- [ ] **Step 3:** Commit  
  `feat(seguimiento): enviar correo/SMS manual + bitácora CORTE 2`

---

### Task 5: Batch retención → outbox + copy 06/07

**Files:**
- Modify: `rematricula-retencion-templates.ts` (+ test)
- Modify: `rematricula-retencion.service.ts` (+ test)
- Optionally create: `seguimiento-retencion-outbox.ts` si el service crece demasiado

**Copy aprobado:**

```ts
// Asunto 2h
'¡Tu matrícula ya está pagada! Completa tu rematrícula 2027-1'

// SMS 24h (≤139; URL desde env)
`UNIACC: Tu matrícula 2027-1 está pagada, pero falta elegir forma de pago para tu arancel y firmar tu contrato. Completa aquí: ${urlCorta}`
```

Cuerpo correo = wireframe 06 / PLAN (pasos arancel+firma, no volver a pagar, CTA retomar, aviso login).

**Batch (reemplazar writes a `mol_retencion_aviso`):**

```ts
// Guardas envío (mol-dev seguro por defecto)
function puedeEnviarRetencionReal(rutNorm: string): boolean {
  if (process.env.RETENCION_OUTBOX_DRY_RUN !== '0') return false // default ON dry-run
  const allow = (process.env.RETENCION_OUTBOX_RUTS ?? '')
    .split(',').map(s => s.replace(/[^0-9Kk]/g,'').toUpperCase()).filter(Boolean)
  if (allow.length === 0) return false
  return allow.includes(rutNorm)
}

// Pseudocódigo
for candidato in listarCandidatos(ahora): // M && !F
  const ejecutivo = emailCartera(candidato.rut_norm) // From AUTO
  ensureOutbox(candidato, 'mail_2h', due = autorizadoEn+2h)
  ensureOutbox(candidato, 'sms_24h', due = autorizadoEn+24h)

for fila in outboxPendienteVencida(ahora):
  if firmaCompleta(fila): mark cancelado; continue
  if tipo sms && !horaPermiteSmsChile: skip
  if !puedeEnviarRetencionReal(fila.rut_norm):
    // dry-run: log + dejar pendiente (o marcar enviado_simulado solo en logs; NO enviar)
    continue
  send with From=resolverFromSeguimiento(ejecutivo cartera)
  mark enviado | error

// También: cancelar pendientes cuando F completa (scan o en mismo loop)
```

Idempotencia = UNIQUE outbox. **No** insertar en `mol_retencion_aviso`.  
En `.env` mol-dev / uniacc-api: `RETENCION_OUTBOX_DRY_RUN=1` hasta smoke controlado.

- [ ] **Step 1:** Tests templates: asunto exacto; SMS con `process.env.REMATRICULA_RETENCION_URL_RETOMAR` (o valor de mol-dev) **length ≤ 139**.
- [ ] **Step 2:** Tests batch mock: enqueue 2 filas; dry-run no llama email/sms; allowlist sí envía; cancelación F; no escribe `mol_retencion_aviso`.
- [ ] **Step 3:** Implementar; dejar scheduler intacto (`procesarRetencionBatch`); default dry-run.
- [ ] **Step 4:** Commit  
  `feat(seguimiento): retención batch escribe mnp_retencion_outbox + copy 06/07`

---

### Task 6: UI Contactar + composers TipTap/SMS

**Files:**
- Create: `SeguimientoComposerCorreo.vue`, `SeguimientoComposerSms.vue`
- Modify: `SeguimientoCasoDrawer.vue`, `seguimientoRematriculaApi.ts`
- Modify: `BandejaSeguimientoRematriculaView.vue` (orquestar dialogs si hace falta)

**UI rules:**
- Contactar ▾ (DropdownMenu): Correo · SMS · WhatsApp disabled «Próximamente».
- Solo si `chip !== 'matriculado'`.
- Correo: De = email sesión (lock) · Para = `email_alumno` · plantillas · `RichTextEditor.vue` (TipTap ya en repo) · firma subir/usar · Enviar.
- SMS: Para = `telefono` · contador 139 · plantilla retención / personalizado.
- Tras OK: toast + refresh bitácora drawer.

Client API:

```ts
postSeguimientoEnviarCorreo(codcli, body)
postSeguimientoEnviarSms(codcli, body)
fetchFirmaEjecutivo() / putFirmaEjecutivo({ mime, base64 })
```

- [ ] **Step 1:** Cablear API client.
- [ ] **Step 2:** Composers + menú Contactar; Matriculado sin menú.
- [ ] **Step 3:** Smoke visual local/mol-dev parcial.
- [ ] **Step 4:** Commit  
  `feat(seguimiento): composers Correo/SMS + Contactar drawer CORTE 2`

---

### Task 7: Deploy mol-dev + smoke

**Files:**
- Create/Update: `docs/wireframes/seguimiento-rematricula-v2/smoke/README.md` (o bajo v5/smoke con sección CORTE 2)

- [ ] **Step 1:** Apply SQL; rebuild `uniacc-api` + `mol-dev` con `RETENCION_OUTBOX_DRY_RUN=1`.
- [ ] **Step 2:** Smoke funcional (caso **prueba**, no masivo):
  1. Chip ≠ 8: enviar correo → bitácora
  2. Enviar SMS (dentro de ventana) → bitácora
  3. Chip 8: sin Contactar
  4. Outbox: tras batch dry-run, filas `pendiente` visibles; **sin** envíos reales masivos
  5. Opcional: `RETENCION_OUTBOX_DRY_RUN=0` + `RETENCION_OUTBOX_RUTS=<rut_prueba>` para un envío real acotado
- [ ] **Step 3:** Documentar en smoke: **sin backfill**; From manual=sesión vs auto=cartera; dry-run default; resultado SMTP (direct vs relay_reply_to).
- [ ] **Step 4:** Commit  
  `docs(seguimiento): smoke CORTE 2 mol-dev`

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| Contactar chips 1–7 / Matriculado sin envíos | T4, T6 |
| TipTap + plantillas + firma imagen | T3, T6 |
| From sesión (manual) / cartera (auto) | T2, T4, T5 + Global |
| Outbox única verdad; no dual-write aviso | T1, T5 |
| Copy 06/07 + cancelación F | T5 |
| SMS ventana + no bypass | T4, T5 |
| Smoke + sin backfill note | T7 |
| WhatsApp CORTE 3 | Global / UI disabled |

## Decisiones clavadas en plan

- From **manual = sesión**; From **auto = cartera** (pueden diferir si supervisor envía caso ajeno).
- Sin backfill `mol_retencion_aviso` → outbox.
- Plantilla/asunto/preview en campo `nota` de bitácora (sin migración de columnas).
- Batch: **dry-run por defecto**; envío real solo con `DRY_RUN=0` + allowlist RUT.
- Firma: **solo service_role** (no anon/authenticated).
- SMTP: probar From ejecutivo; plan B `relay_reply_to` si SPF/relay lo bloquea.
