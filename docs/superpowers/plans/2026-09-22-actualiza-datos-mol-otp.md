# SP_ACTUALIZA_DATOS_MOL tras OTP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tras validar correo y teléfono en datos personales, si cambiaron, ejecutar `SP_ACTUALIZA_DATOS_MOL` en el ambiente ERP activo (con sync baseline PROD→TEST cuando aplica), sin bloquear al alumno si falla.

**Architecture:** Endpoint en `uniacc-api` que resuelve ambiente, opcionalmente alinea `MT_CLIENT.FONOACT/MAIL` PROD→TEST, y ejecuta el SP. MOL llama una vez al completar ambos canales OK si hay diff vs baseline ERP.

**Tech Stack:** Express + mssql (`uniacc-api-docker`), Vue 3 + TypeScript (`mol-docker`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-22-actualiza-datos-mol-otp-design.md`
- Ambiente: `resolveAmbienteActivo()` (no hardcode prod)
- Fallo SP: no bloquea avance del alumno
- Solo POST si cambió mail o fono (normalizado)
- Una llamada por sesión de contacto (`erpSyncIntentado`)
- Sync TEST: UPDATE baseline si existe fila; nunca INSERT inventado
- `codcli` con DV; `fonoact` sin `+` (ej. `56987654321`)
- Tipos explícitos; sin `any`

## File map

| Archivo | Rol |
|---------|-----|
| `uniacc-api-docker/src/services/actualiza-datos-mol.service.ts` | Sync PROD→TEST + EXEC SP |
| `uniacc-api-docker/src/controllers/rematricula-contacto-datos.controller.ts` | HTTP + validators |
| `uniacc-api-docker/src/routes/rematricula-contacto-datos.routes.ts` | Rutas contacto datos ERP |
| `uniacc-api-docker/src/index.ts` | Montar `/api/rematricula/contacto` |
| `mol-docker/src/services/actualizarDatosMolApi.ts` | Cliente fetch |
| `mol-docker/src/views/matricula-mock/DatosPersonalesMockView.vue` | Orquestación post-OTP |

---

### Task 1: Servicio actualiza-datos-mol (uniacc-api)

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/actualiza-datos-mol.service.ts`

**Interfaces:**
- Produces:
  - `syncMtClientProdToTest(codcli: string): Promise<{ status: 'updated' | 'missing_prod' | 'missing_test' | 'skipped_not_test'; detalle?: string }>`
  - `actualizaDatosMol(input: { codcli: string; fonoact: string; mail: string }): Promise<ActualizaDatosMolResult>`
  - Types: `ActualizaDatosMolResult` con `ok`, `code?: 'NOT_FOUND' | 'ERP_ERROR'`, `message`, `data?`, `params`, `duracionMs`, `syncStatus?`

- [x] **Step 1: Implementar servicio**
- [x] **Step 2: Commit** (diferido; solo si el usuario lo pide)

---

### Task 2: Controller + routes + mount

**Files:**
- Create: `/opt/uniacc-api-docker/src/controllers/rematricula-contacto-datos.controller.ts`
- Create: `/opt/uniacc-api-docker/src/routes/rematricula-contacto-datos.routes.ts`
- Modify: `/opt/uniacc-api-docker/src/index.ts`

- [ ] **Step 1: Controller**

Endpoints:
- `POST /actualizar-datos-erp` → `actualizaDatosMol`
- `POST /sync-mt-client-prod-to-test` → solo sync (body `{ codcli }`)

HTTP mapping del spec (200 NOT_FOUND, 502 ERP_ERROR, 400 validation).

- [ ] **Step 2: Routes + `app.use('/api/rematricula/contacto', ...)`**

- [ ] **Step 3: Log en startup** las rutas nuevas (junto a las de OTP)

---

### Task 3: Cliente MOL

**Files:**
- Create: `/opt/mol-docker/src/services/actualizarDatosMolApi.ts`

- [ ] **Step 1: Implementar `actualizarDatosMolErp({ codcli, fonoact, mail })`**

Mismo patrón timeout/`admisionApiBaseUrl` que `alumnoDeudaNetApi.ts`.  
`fonoact` enviado ya sin `+` (caller normaliza).

---

### Task 4: Orquestación DatosPersonalesMockView

**Files:**
- Modify: `/opt/mol-docker/src/views/matricula-mock/DatosPersonalesMockView.vue`

- [ ] **Step 1: Estado**

- `erpSyncIntentado = ref(false)`
- Capturar baseline al inicializar drafts: `baselineMail`, `baselineFono` (o usar `correoPersonalMostrado`/`telefonoMostrado` al momento del sync)

- [ ] **Step 2: Función `maybeActualizarDatosErp()`**

```ts
async function maybeActualizarDatosErp(): Promise<void> {
  if (erpSyncIntentado.value) return
  if (!correoValidadoOk.value || !telefonoValidadoOk.value) return
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  if (!codcli) return
  const mail = emailDraft.value.trim()
  const fonoNormUi = telefonoDraft.value.trim() // ya +569…
  const fonoSp = fonoNormUi.replace(/\D/g, '') // 569…
  const mailBase = (valorInicialCorreoPersonal() or baseline).toLowerCase().trim()
  const fonoBase = extraerDigitos… / digits of baseline
  if (mail.toLowerCase() === mailBase && digits(fono) === digits(baseline)) return
  erpSyncIntentado.value = true
  try {
    const res = await actualizarDatosMolErp({ codcli, fonoact: fonoSp, mail })
    if (!res.ok) console.warn('[actualiza-datos-mol]', res)
  } catch (e) {
    console.warn('[actualiza-datos-mol]', e)
  }
}
```

- [ ] **Step 3: Llamar sin await bloqueante** desde el watcher que dispara `irPostContacto` (fire-and-forget `void maybeActualizarDatosErp()` **antes** o en paralelo a `irPostContacto`). También tras verify OK / continuar sin OTP cuando ambos quedan true (el watcher cubre todos los casos).

- [ ] **Step 4: Reset `erpSyncIntentado` en el mismo sitio que `otpUi.resetAll()` al montar/reiniciar paso**

---

### Task 5: Verificación

- [ ] **Step 1:** Typecheck / rebuild contenedores si aplica (`uniacc-api` + `mol-dev`)
- [ ] **Step 2:** Actualizar estado del spec a `aprobado; implementado`
- [ ] **Step 3:** Commit solo si el usuario lo pide

## Self-review plan vs spec

| Spec | Task |
|------|------|
| Endpoint actualizar-datos-erp | 2 |
| Sync PROD→TEST en test | 1 |
| Ops sync endpoint | 2 |
| Cliente MOL | 3 |
| Orquestación + flag + solo si cambió | 4 |
| No bloquear por fallo | 4 |
| Ambiente activo | 1 |
