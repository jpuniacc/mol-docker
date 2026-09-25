# Sync discapacidad ERP (`SP_MOL_ACTUALIZA_DISCAPACIDAD`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al contestar la encuesta de discapacidad, persistir el tipo en ERP vía `SP_MOL_ACTUALIZA_DISCAPACIDAD` y las afirmaciones solo en Supabase; al omitir, no llamar al SP y dejar el valor ERP intacto.

**Architecture:** Endpoint en `uniacc-api` (mismo patrón que contacto OTP) resuelve ambiente ERP y ejecuta el SP. MOL actualiza labels a códigos `MT_DISCAPACIDAD`, guarda en Supabase, y solo si `contesta=true` dispara el POST ERP sin bloquear el avance.

**Tech Stack:** Express + mssql (`uniacc-api-docker`), Vue 3 + TypeScript + Supabase (`mol-docker`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-25-discapacidad-erp-sync-design.md`
- Ambiente: `resolveAmbienteActivo()` (no hardcode prod)
- Omitir: **no** llamar SP; ERP sin cambio
- Contestar: Supabase + SP; fallo SP no bloquea al alumno
- `@DISCAPACIDAD` = `MT_DISCAPACIDAD.CODIGO` exacto (incl. guion en `Física–Visceral` como en U+)
- Afirmaciones: solo Supabase
- `codcli` con DV
- Tipos explícitos; sin `any`

## File map

| Archivo | Rol |
|---------|-----|
| `uniacc-api-docker/src/services/actualiza-discapacidad-mol.service.ts` | EXEC SP |
| `uniacc-api-docker/src/controllers/rematricula-discapacidad.controller.ts` | HTTP + validators |
| `uniacc-api-docker/src/routes/rematricula-discapacidad.routes.ts` | Ruta |
| `uniacc-api-docker/src/index.ts` | Montar `/api/rematricula/discapacidad` |
| `mol-docker/src/constants/discapacidadEncuesta.ts` | Tipos = códigos U+ |
| `mol-docker/supabase/migrations/20260925120000_mnp_discapacidad_tipos_mt.sql` | CHECK + RPC |
| `mol-docker/src/services/actualizarDiscapacidadMolApi.ts` | Cliente fetch |
| `mol-docker/src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue` | Orquestación |

Códigos UI (sin `Ninguna`):

```ts
'Física-Motora' | 'Física–Visceral' | 'Visual' | 'Auditiva' | 'Psíquica' | 'Intelectual' | 'Espectro del Autismo'
```

Usar el carácter exacto de `MT_DISCAPACIDAD` para Visceral (en-dash `–` U+2013 si así está en la tabla; verificar con `SELECT CODIGO FROM MT_DISCAPACIDAD`).

---

### Task 1: Servicio SP en uniacc-api

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/actualiza-discapacidad-mol.service.ts`
- Test: `/opt/uniacc-api-docker/src/services/actualiza-discapacidad-mol.service.test.ts` (si el repo ya tiene vitest/jest para servicios; si no, smoke manual en Task 2)

**Interfaces:**
- Consumes: `getConnectionErpSp`, `resolveAmbienteActivo`, `hostEnmascarado` (mismo import path que `actualiza-datos-mol.service.ts`)
- Produces:
  - `actualizaDiscapacidadMolService.actualizar(params: { codcli: string; discapacidad: string }): Promise<ActualizaDiscapacidadMolResult>`
  - `ActualizaDiscapacidadMolResult`:
    - ok true: `{ ok: true; message: string; data: { resultado: string; raw: Record<string, unknown> }; params; duracionMs }`
    - ok false: `{ ok: false; message: string; error?: string; code: 'ERP_ERROR' | 'NO_ROWS' | 'INVALID_CODE'; params; duracionMs }`

- [ ] **Step 1: Crear el servicio**

```ts
// actualiza-discapacidad-mol.service.ts — núcleo EXEC
const result = await pool.request()
  .input('CODCLI', sql.VarChar(20), params.codcli)
  .input('DISCAPACIDAD', sql.VarChar(100), params.discapacidad)
  .query(`
EXEC SP_MOL_ACTUALIZA_DISCAPACIDAD
    @CODCLI = @CODCLI,
    @DISCAPACIDAD = @DISCAPACIDAD
`)
```

Leer primera fila del recordset. Si `RESULTADO === 'OK'` → ok. Si `RESULTADO === 'ERROR'` o falta fila → `ok: false` con `code: 'ERP_ERROR'` y `ERROR_MESSAGE` del SP. Log: `[actualiza-discapacidad-mol] ambiente=… host=… codcli=…`.

No copiar discapacidad PROD→TEST: el SP hace `UPDATE` del valor elegido; si la fila no existe en TEST, el SP falla y se loguea (mismo “no inventar fila” que contacto).

- [ ] **Step 2: Commit** (solo si el usuario pide commits; si no, dejar staged mentalmente y continuar)

```bash
cd /opt/uniacc-api-docker
git add src/services/actualiza-discapacidad-mol.service.ts
git commit -m "feat(rematricula): servicio SP_MOL_ACTUALIZA_DISCAPACIDAD"
```

---

### Task 2: Controller + routes + mount

**Files:**
- Create: `/opt/uniacc-api-docker/src/controllers/rematricula-discapacidad.controller.ts`
- Create: `/opt/uniacc-api-docker/src/routes/rematricula-discapacidad.routes.ts`
- Modify: `/opt/uniacc-api-docker/src/index.ts`

**Interfaces:**
- Consumes: `actualizaDiscapacidadMolService.actualizar`
- Produces: `POST /api/rematricula/discapacidad/actualizar-erp`

- [ ] **Step 1: Controller**

```ts
export const validadoresActualizarDiscapacidadErp = [
  body('codcli').isString().trim().notEmpty().isLength({ max: 20 }),
  body('discapacidad').isString().trim().notEmpty().isLength({ max: 100 }),
]

export async function actualizarDiscapacidadErpHttp(req: Request, res: Response): Promise<void> {
  // validation → 400
  // result = await actualizaDiscapacidadMolService.actualizar({ codcli, discapacidad })
  // !ok → 502 si ERP_ERROR, 200 si NO_ROWS/INVALID_CODE (mismo estilo contacto)
  // ok → 200 json
}
```

Lista blanca opcional en controller (códigos conocidos) **además** del SP; si falla la lista → 400. Incluir los 7 tipos UI (no `Ninguna` en el body de “contesta”).

- [ ] **Step 2: Routes**

```ts
router.post('/actualizar-erp', validadoresActualizarDiscapacidadErp, actualizarDiscapacidadErpHttp)
```

- [ ] **Step 3: Mount en `index.ts`**

```ts
app.use('/api/rematricula/discapacidad', rematriculaDiscapacidadRoutes)
// startup log:
// POST /api/rematricula/discapacidad/actualizar-erp
```

- [ ] **Step 4: Verificar build TypeScript**

Run: `cd /opt/uniacc-api-docker && npx tsc --noEmit` (o el script `npm run build` del repo)  
Expected: sin errores en archivos nuevos.

- [ ] **Step 5: Commit** (si el usuario lo pide)

```bash
git add src/services/actualiza-discapacidad-mol.service.ts \
  src/controllers/rematricula-discapacidad.controller.ts \
  src/routes/rematricula-discapacidad.routes.ts src/index.ts
git commit -m "feat(rematricula): endpoint actualizar discapacidad ERP"
```

---

### Task 3: Constantes MOL + migración Supabase

**Files:**
- Modify: `/opt/mol-docker/src/constants/discapacidadEncuesta.ts`
- Create: `/opt/mol-docker/supabase/migrations/20260925120000_mnp_discapacidad_tipos_mt.sql`
- Modify: `/opt/mol-docker/src/utils/…` solo si hay tests de tipos hardcoded
- Test: actualizar cualquier test que liste `'Física' | 'Autismo'`

**Interfaces:**
- Produces: `DISCAPACIDAD_TIPOS` alineado a U+; RPC acepta los nuevos literales

- [ ] **Step 1: Actualizar constantes**

```ts
export const DISCAPACIDAD_TIPOS = [
  'Física-Motora',
  'Física–Visceral', // mismo glyph que MT_DISCAPACIDAD.CODIGO
  'Visual',
  'Auditiva',
  'Psíquica',
  'Intelectual',
  'Espectro del Autismo',
] as const
```

Ajustar copy de UI si menciona “SENADIS” de forma que siga siendo válida (subtítulo puede decir “Códigos institucionales / SENADIS alineados a ERP”).

- [ ] **Step 2: Migración**

```sql
-- Drop/recreate CHECK en mnp_discapacidad_encuesta
ALTER TABLE public.mnp_discapacidad_encuesta
  DROP CONSTRAINT IF EXISTS mnp_discapacidad_encuesta_tipo_chk;

ALTER TABLE public.mnp_discapacidad_encuesta
  ADD CONSTRAINT mnp_discapacidad_encuesta_tipo_chk
  CHECK (
    tipo_discapacidad IS NULL
    OR tipo_discapacidad IN (
      'Física-Motora',
      'Física–Visceral',
      'Visual',
      'Auditiva',
      'Psíquica',
      'Intelectual',
      'Espectro del Autismo'
    )
  );

-- Reemplazar función guardar_mnp_discapacidad_encuesta:
-- en la rama contesta, validar IN (mismos 7 literales)
```

Aplicar en desarrollo con el mismo método que otras migraciones del proyecto (archivo en `supabase/migrations/` + DDL en Supabase desarrollo si el flujo del equipo lo exige).

- [ ] **Step 3: Commit** (si el usuario lo pide)

```bash
cd /opt/mol-docker
git add src/constants/discapacidadEncuesta.ts \
  supabase/migrations/20260925120000_mnp_discapacidad_tipos_mt.sql
git commit -m "feat(rematricula): tipos discapacidad alineados a MT_DISCAPACIDAD"
```

---

### Task 4: Cliente MOL + orquestación del paso

**Files:**
- Create: `/opt/mol-docker/src/services/actualizarDiscapacidadMolApi.ts`
- Modify: `/opt/mol-docker/src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue`
- Modify: `/opt/mol-docker/src/services/discapacidadEncuesta.ts` (solo si hace falta tipar `tipoDiscapacidad` con el union nuevo)

**Interfaces:**
- Consumes: `POST /api/rematricula/discapacidad/actualizar-erp`, `guardarDiscapacidadEncuesta`
- Produces: `actualizarDiscapacidadMolErp({ codcli, discapacidad })`

- [ ] **Step 1: Cliente API** (copiar patrón de `actualizarDatosMolApi.ts`)

```ts
export async function actualizarDiscapacidadMolErp(payload: {
  codcli: string
  discapacidad: string
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const url = apiUrl('/api/rematricula/discapacidad/actualizar-erp')
  // fetch POST, timeout 60s, no throw al caller
}
```

- [ ] **Step 2: En `guardar()` (contesta=true)**

Orden:
1. `persistirEncuesta` (Supabase)
2. `mockCtx.setDiscapacidad`
3. Fire-and-forget ERP (no await bloqueante del router, o await con try/catch que nunca impide `router.push`):

```ts
const codcli = (ctx.codcli ?? '').trim()
if (codcli && respuesta.tipo) {
  void actualizarDiscapacidadMolErp({
    codcli,
    discapacidad: respuesta.tipo,
  }).then((r) => {
    if (!r.ok) console.warn('[discapacidadErp]', r.error ?? r.message)
  })
}
void router.push({ name: 'matricula-mock-forma-pago' })
```

- [ ] **Step 3: En `omitir()`**

Solo Supabase + `setDiscapacidad` + navigate. **Ninguna** llamada a `actualizarDiscapacidadMolErp`.

- [ ] **Step 4: Smoke UI**

1. Contestar con Visual → red: POST discapacidad/actualizar-erp; ERP `MT_CLIENT.DISCAPACIDAD` = Visual (ambiente activo).  
2. Omitir → no POST ERP; valor ERP previo intacto.  
3. Afirmaciones siguen en Supabase.

- [ ] **Step 5: Commit** (si el usuario lo pide)

```bash
cd /opt/mol-docker
git add src/services/actualizarDiscapacidadMolApi.ts \
  src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue
git commit -m "feat(rematricula): sync discapacidad a ERP al contestar encuesta"
```

---

### Task 5: Rebuild / verificación de contenedores

**Files:** ninguno de código (ops)

- [ ] **Step 1:** Rebuild `uniacc-api` si corre en Docker (`docker compose up -d --build` en `/opt/uniacc-api-docker`).
- [ ] **Step 2:** Rebuild `mol-dev` (`docker compose up -d --build --force-recreate` en `/opt/mol-docker`) si se valida en `mol-dev.uniacc.cl`.
- [ ] **Step 3:** Health + smoke de los 2 casos del Task 4.

---

## Spec coverage (self-review)

| Requisito spec | Task |
|----------------|------|
| Endpoint uniacc-api + SP | 1–2 |
| Labels = códigos MT (split Física, Autismo→Espectro) | 3 |
| Afirmaciones solo Supabase | 3–4 (sin cambio de modelo; no SP) |
| Omitir sin SP | 4 Step 3 |
| Contestar → Supabase + SP | 4 Step 2 |
| Fallo no bloquea | 4 Step 2 |
| CODCLI con DV | 4 (usa `ctx.codcli`) |
| Ambiente activo | 1 (resolveAmbienteActivo) |

## Fuera de este plan

- Mantenedor de catálogo discapacidad
- Escribir afirmaciones en ERP
- Bloquear matrícula por fallo SP
