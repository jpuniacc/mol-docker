# Confirmación apoderado mock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tras OTP de contacto en el mock, si el alumno no es su propio sostenedor, confirmar datos del apoderado; si están mal, bloquear el flujo y avisar por correo al área.

**Architecture:** Subpaso `apoderado` dentro de Datos personales (entre `contacto` y `discapacidad`). Estado en `mockMatriculaContext` (persistido en sessionStorage). Correo vía endpoint nuevo en `uniacc-api` (buzón fijo por env). Auditoría con `registrar_log_mol_evento` desde MOL.

**Tech Stack:** Vue 3 + Pinia + TypeScript (mol-docker), Express + nodemailer (uniacc-api), Supabase RPC `registrar_log_mol_evento`, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-09-confirmacion-apoderado-mock-design.md`
- Propio sostenedor solo si `es_responsable_financiero === 'S'` (comparar trim + uppercase)
- Cualquier otro valor → mostrar confirmación
- Bloqueo si el alumno dice que los datos no son correctos (no avanzar a discapacidad ni más allá)
- Correo real a buzón fijo (env); incluir RUT, codcli, nombre, periodo, carrera, jornada, datos apoderado
- No editar datos del apoderado en UI; no hardcodear destinatario en el front
- Composition API + `<script setup lang="ts">`; tipos explícitos; sin `any`

## File map

| Archivo | Rol |
|---------|-----|
| `mol-docker/src/utils/apoderadoResponsable.ts` | Helpers puros: propio sostenedor, nombre/tel/mail display |
| `mol-docker/src/utils/apoderadoResponsable.test.ts` | Unit tests |
| `mol-docker/src/stores/mockMatriculaContext.ts` | Estado `apoderadoConfirmado` / `apoderadoBloqueo` + persistencia |
| `mol-docker/src/views/matricula-mock/MatriculaMockApoderadoStep.vue` | UI confirmación / bloqueo |
| `mol-docker/src/views/matricula-mock/DatosPersonalesMockView.vue` | Orquestar subpaso `apoderado` |
| `mol-docker/src/services/apoderadoAuditLog.ts` | RPC `registrar_log_mol_evento` |
| `mol-docker/src/services/apoderadoDesactualizadoApi.ts` | POST a uniacc-api |
| `mol-docker/src/router/index.ts` (si aplica) | Guard: no salir de datos si bloqueo |
| `uniacc-api-docker/src/services/email.service.ts` | Método envío aviso área |
| `uniacc-api-docker/src/services/rematricula-apoderado.service.ts` | Lógica negocio |
| `uniacc-api-docker/src/controllers/rematricula-apoderado.controller.ts` | HTTP + validators |
| `uniacc-api-docker/src/routes/rematricula-apoderado.routes.ts` | Ruta |
| `uniacc-api-docker/src/index.ts` | Montar `/api/rematricula/apoderado` |
| `uniacc-api-docker/.env.example` (o docs) | `REMATRICULA_APODERADO_AVISO_TO` |

---

### Task 1: Helpers de apoderado + tests

**Files:**
- Create: `/opt/mol-docker/src/utils/apoderadoResponsable.ts`
- Create: `/opt/mol-docker/src/utils/apoderadoResponsable.test.ts`

**Interfaces:**
- Consumes: `PlanPagosMvRow` fields (partial)
- Produces:
  - `esPropioSostenedor(esResponsable: string | null | undefined): boolean`
  - `nombreCompletoApoderado(row: Pick<PlanPagosMvRow, 'nombre_apoderado' | 'apellido_paterno_apoderado' | 'apellido_materno_apoderado'>): string`
  - `telefonoApoderadoDisplay(row: Pick<PlanPagosMvRow, 'telefono_apoder' | 'telefono_apoderado'>): string`
  - `mailApoderadoDisplay(row: Pick<PlanPagosMvRow, 'mail_apoder'>): string`
  - Constante `APODERADO_SIN_INFO = 'Sin información'`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  APODERADO_SIN_INFO,
  esPropioSostenedor,
  mailApoderadoDisplay,
  nombreCompletoApoderado,
  telefonoApoderadoDisplay,
} from './apoderadoResponsable'

describe('esPropioSostenedor', () => {
  it('true solo para S', () => {
    expect(esPropioSostenedor('S')).toBe(true)
    expect(esPropioSostenedor(' s ')).toBe(true)
    expect(esPropioSostenedor('N')).toBe(false)
    expect(esPropioSostenedor('sin datos')).toBe(false)
    expect(esPropioSostenedor(null)).toBe(false)
    expect(esPropioSostenedor(undefined)).toBe(false)
  })
})

describe('displays', () => {
  it('arma nombre y fallbacks', () => {
    expect(
      nombreCompletoApoderado({
        nombre_apoderado: 'Ana',
        apellido_paterno_apoderado: 'Pérez',
        apellido_materno_apoderado: 'López',
      }),
    ).toBe('Ana Pérez López')
    expect(
      nombreCompletoApoderado({
        nombre_apoderado: null,
        apellido_paterno_apoderado: null,
        apellido_materno_apoderado: null,
      }),
    ).toBe(APODERADO_SIN_INFO)
    expect(
      telefonoApoderadoDisplay({ telefono_apoder: null, telefono_apoderado: '56911112222' }),
    ).toBe('56911112222')
    expect(mailApoderadoDisplay({ mail_apoder: '  ' })).toBe(APODERADO_SIN_INFO)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /opt/mol-docker && npx vitest run src/utils/apoderadoResponsable.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement helpers**

```ts
import type { PlanPagosMvRow } from '@/types/supabase'

export const APODERADO_SIN_INFO = 'Sin información'

export function esPropioSostenedor(esResponsable: string | null | undefined): boolean {
  return (esResponsable ?? '').trim().toUpperCase() === 'S'
}

function textoOSinInfo(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t.length > 0 ? t : APODERADO_SIN_INFO
}

export function nombreCompletoApoderado(
  row: Pick<
    PlanPagosMvRow,
    'nombre_apoderado' | 'apellido_paterno_apoderado' | 'apellido_materno_apoderado'
  >,
): string {
  const parts = [row.nombre_apoderado, row.apellido_paterno_apoderado, row.apellido_materno_apoderado]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim())
  return parts.length > 0 ? parts.join(' ') : APODERADO_SIN_INFO
}

export function telefonoApoderadoDisplay(
  row: Pick<PlanPagosMvRow, 'telefono_apoder' | 'telefono_apoderado'>,
): string {
  const preferido = (row.telefono_apoder ?? '').trim()
  if (preferido) return preferido
  return textoOSinInfo(row.telefono_apoderado)
}

export function mailApoderadoDisplay(row: Pick<PlanPagosMvRow, 'mail_apoder'>): string {
  return textoOSinInfo(row.mail_apoder)
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /opt/mol-docker && npx vitest run src/utils/apoderadoResponsable.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd /opt/mol-docker
git add src/utils/apoderadoResponsable.ts src/utils/apoderadoResponsable.test.ts
git commit -m "feat: helpers esPropioSostenedor y display apoderado"
```

---

### Task 2: Estado en `mockMatriculaContext`

**Files:**
- Modify: `/opt/mol-docker/src/stores/mockMatriculaContext.ts`

**Interfaces:**
- Consumes: existing store persist/hydrate
- Produces state fields:
  - `apoderadoConfirmado: boolean | null` (`true` OK, `false` desactualizado, `null` no respondió)
  - `apoderadoBloqueo: boolean`
- Produces actions:
  - `confirmarApoderadoOk(): void`
  - `marcarApoderadoDesactualizado(): void`
  - Reset both on `setAlumno` / clear

- [ ] **Step 1: Extend `StoredMockMatriculaContext` and state**

Add to type and `state()`:

```ts
apoderadoConfirmado: boolean | null
apoderadoBloqueo: boolean
```

Default: `null` / `false`. Include in `persistToSessionStorage` and `hydrateFromSessionStorage` (hydrate: only `true`/`false` for confirmado; bloqueo = `parsed.apoderadoBloqueo === true`).

- [ ] **Step 2: Actions**

```ts
confirmarApoderadoOk() {
  this.apoderadoConfirmado = true
  this.apoderadoBloqueo = false
  this.persistToSessionStorage()
},
marcarApoderadoDesactualizado() {
  this.apoderadoConfirmado = false
  this.apoderadoBloqueo = true
  this.persistToSessionStorage()
},
```

In `setAlumno` (and any full reset): set `apoderadoConfirmado = null`, `apoderadoBloqueo = false`.

- [ ] **Step 3: Manual smoke**

In DevTools: set alumno, call `confirmarApoderadoOk()`, reload page → hydrate restores values.

- [ ] **Step 4: Commit**

```bash
cd /opt/mol-docker
git add src/stores/mockMatriculaContext.ts
git commit -m "feat: estado apoderadoConfirmado/bloqueo en mock context"
```

---

### Task 3: Endpoint uniacc-api — correo aviso área

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/email.service.ts`
- Create: `/opt/uniacc-api-docker/src/services/rematricula-apoderado.service.ts`
- Create: `/opt/uniacc-api-docker/src/controllers/rematricula-apoderado.controller.ts`
- Create: `/opt/uniacc-api-docker/src/routes/rematricula-apoderado.routes.ts`
- Modify: `/opt/uniacc-api-docker/src/index.ts`
- Modify: env example if present (`REMATRICULA_APODERADO_AVISO_TO`)

**Interfaces:**
- Consumes: `EmailService` transporter
- Produces: `POST /api/rematricula/apoderado/aviso-desactualizado`
- Body JSON:

```ts
{
  rutAlumno: string
  codcli: string
  nombreAlumno: string
  periodoLabel: string
  carrera: string
  jornada: string
  apoderadoNombre: string
  apoderadoTelefono: string
  apoderadoEmail: string
  urlOrigen?: string | null
}
```

- Response: `{ ok: true }` or `{ ok: false, message: string }` with status 400/500/503

- [ ] **Step 1: Add `EmailService.enviarAvisoApoderadoDesactualizado(...)`**

Read destinatario from `process.env.REMATRICULA_APODERADO_AVISO_TO` (comma-separated OK). If empty → return `false` and log warn. Subject: `Rematrícula — datos apoderado desactualizados ({codcli})`. Body text+html with all fields from payload (carrera + jornada included).

- [ ] **Step 2: Service + controller + route**

Mirror `rematricula-contacto-otp` pattern: express-validator on required strings (max lengths), controller calls service, service calls email.

- [ ] **Step 3: Register in `index.ts`**

```ts
app.use('/api/rematricula/apoderado', rematriculaApoderadoRoutes)
```

Log the new route on startup alongside OTP routes.

- [ ] **Step 4: Smoke local**

With `REMATRICULA_APODERADO_AVISO_TO` set:

```bash
curl -sS -X POST http://localhost:3001/api/rematricula/apoderado/aviso-desactualizado \
  -H 'Content-Type: application/json' \
  -d '{"rutAlumno":"1-9","codcli":"X","nombreAlumno":"Test","periodoLabel":"2027-1","carrera":"Psicología","jornada":"S","apoderadoNombre":"Apod","apoderadoTelefono":"569","apoderadoEmail":"a@b.cl"}'
```

Expected: `{ "ok": true }` (o 503 si SMTP no configurado — documentar).

- [ ] **Step 5: Commit** (en repo uniacc-api-docker)

```bash
cd /opt/uniacc-api-docker
git add src/services/email.service.ts src/services/rematricula-apoderado.service.ts \
  src/controllers/rematricula-apoderado.controller.ts src/routes/rematricula-apoderado.routes.ts src/index.ts
git commit -m "feat: aviso correo apoderado desactualizado rematrícula"
```

---

### Task 4: Cliente MOL — API + audit log

**Files:**
- Create: `/opt/mol-docker/src/services/apoderadoDesactualizadoApi.ts`
- Create: `/opt/mol-docker/src/services/apoderadoAuditLog.ts`

**Interfaces:**
- Consumes: `admisionApiBaseUrl`, `contextoMolAuditoria`, supabase `registrar_log_mol_evento`
- Produces:
  - `avisarApoderadoDesactualizado(payload): Promise<{ ok: true } | { ok: false; message: string }>`
  - `registrarApoderadoAudit(params: { accion: 'confirma_ok' | 'confirma_desactualizado' | 'correo_ok' | 'correo_error'; payload?: Record<string, unknown>; ...contexto }): Promise<string | null>`

- [ ] **Step 1: API client**

Same `fetchWithTimeout` pattern as `rematriculaOtpApi.ts`, path `/api/rematricula/apoderado/aviso-desactualizado`.

- [ ] **Step 2: Audit via RPC**

```ts
await supabase.rpc('registrar_log_mol_evento', {
  p_sesion_id: ctx.sesionId,
  p_categoria: 'apoderado',
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
```

On error: `console.warn`, return null (no tumbar UI).

- [ ] **Step 3: Commit**

```bash
cd /opt/mol-docker
git add src/services/apoderadoDesactualizadoApi.ts src/services/apoderadoAuditLog.ts
git commit -m "feat: cliente aviso apoderado y audit log"
```

---

### Task 5: UI `MatriculaMockApoderadoStep` + wiring en Datos personales

**Files:**
- Create: `/opt/mol-docker/src/views/matricula-mock/MatriculaMockApoderadoStep.vue`
- Modify: `/opt/mol-docker/src/views/matricula-mock/DatosPersonalesMockView.vue`

**Interfaces:**
- Consumes: helpers Task 1, store Task 2, services Task 4, `useMockAlumnoFuente` / `selectedPlanPagos`, periodo store
- Emits / callbacks:
  - `@continuar` when confirm OK (parent sets `paso = 'discapacidad'`)
- Parent changes:
  - `type PasoDatosPersonales = 'tyc' | 'contacto' | 'apoderado' | 'discapacidad'`
  - Replace auto-advance from contacto: call `irPostContacto()` instead of always `discapacidad`

- [ ] **Step 1: Implement `irPostContacto` in DatosPersonalesMockView**

```ts
function irPostContacto(): void {
  if (!puedeContinuarDesdeContacto.value) return
  emailConfirmado.value = emailDraft.value.trim()
  telefonoConfirmado.value = telefonoDraft.value.trim()
  const plan = mockCtx.selectedPlanPagos
  if (plan && esPropioSostenedor(plan.es_responsable_financiero)) {
    paso.value = 'discapacidad'
    return
  }
  if (mockCtx.apoderadoBloqueo) {
    paso.value = 'apoderado'
    return
  }
  if (mockCtx.apoderadoConfirmado === true) {
    paso.value = 'discapacidad'
    return
  }
  paso.value = 'apoderado'
}
```

Change watch + `continuarADiscapacidadDesdeContacto` to use `irPostContacto`.

- [ ] **Step 2: Build `MatriculaMockApoderadoStep.vue`**

Card with title “Confirma los datos de tu apoderado / sostenedor”, rows nombre/tel/email, buttons:

- “Sí, estos datos son correctos” → audit `confirma_ok` → `confirmarApoderadoOk()` → emit continuar
- “No, necesito actualizarlos” → `marcarApoderadoDesactualizado()` → audit `confirma_desactualizado` → call API → audit `correo_ok`/`correo_error` → show Alert bloqueo (no emit continuar)

Blocking Alert copy:

> Debes comunicarte con tu consejero para actualizar los datos de tu apoderado. También informamos al área para gestionar la actualización.

If already `apoderadoBloqueo`, show only the Alert (no buttons to continue).

- [ ] **Step 3: Template branch**

```vue
<MatriculaMockApoderadoStep
  v-else-if="paso === 'apoderado'"
  @continuar="paso = 'discapacidad'"
/>
```

- [ ] **Step 4: Manual QA**

1. Alumno con `es_responsable_financiero = 'S'`: OTP → discapacidad (sin pantalla apoderado).
2. Alumno con `N`: OTP → ficha → Sí → discapacidad.
3. Alumno con `N`: No → bloqueo + correo (revisar logs API / bandeja) + no avanza.

- [ ] **Step 5: Commit**

```bash
cd /opt/mol-docker
git add src/views/matricula-mock/MatriculaMockApoderadoStep.vue \
  src/views/matricula-mock/DatosPersonalesMockView.vue
git commit -m "feat: subpaso confirmación apoderado en mock datos personales"
```

---

### Task 6: Guardas de navegación (bloqueo)

**Files:**
- Modify: `/opt/mol-docker/src/views/matricula-mock/MatriculaMockLayout.vue` and/or `/opt/mol-docker/src/router/index.ts` (donde ya se protege el mock)

**Interfaces:**
- Consumes: `mockCtx.apoderadoBloqueo`
- Produces: impedir ir a `forma-pago` / `firma` / `resumen` si bloqueo; redirigir a datos personales

- [ ] **Step 1: Locate existing mock navigation guards** (alumno seleccionado, tyc, etc.) and extend:

```ts
if (mockCtx.apoderadoBloqueo && to.name !== 'matricula-mock-datos') {
  return { name: 'matricula-mock-datos' }
}
```

(Use the real route name already used for datos.)

- [ ] **Step 2: Manual QA** — con bloqueo activo, intentar URL directa a forma-pago → vuelve a datos / apoderado.

- [ ] **Step 3: Commit**

```bash
cd /opt/mol-docker
git add src/router/index.ts src/views/matricula-mock/MatriculaMockLayout.vue
git commit -m "fix: bloquear navegación mock si apoderado desactualizado"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Subpaso entre OTP y discapacidad | 5 |
| `S` salta confirmación | 1 + 5 |
| `≠ S` muestra ficha | 5 |
| Confirmar datos vigentes | 5 |
| Bloqueo si No | 2 + 5 + 6 |
| Correo real buzón fijo | 3 + 4 |
| Correo con carrera + jornada | 3 |
| Log auditoría | 4 + 5 |
| Fallo correo no desbloquea | 5 |
| Datos desde PlanPagosMv | 1 + 5 |
| Sin edición apoderado | 5 (solo lectura) |

## Placeholder / consistency scan

- Nombres de acciones audit: `confirma_ok` | `confirma_desactualizado` | `correo_ok` | `correo_error`
- Env destinatario: `REMATRICULA_APODERADO_AVISO_TO`
- Endpoint: `POST /api/rematricula/apoderado/aviso-desactualizado`
- Store fields: `apoderadoConfirmado`, `apoderadoBloqueo`
