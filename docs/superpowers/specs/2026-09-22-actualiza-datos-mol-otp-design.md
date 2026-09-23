# Actualización ERP de contacto alumno (`SP_ACTUALIZA_DATOS_MOL`) tras OTP

Fecha: 2026-09-22  
Proyecto: `mol-docker` + `uniacc-api-docker`  
Estado: aprobado; implementado

## Problema

En el paso de datos personales (rematrícula), el alumno valida correo y teléfono (OTP o “continuar sin OTP”). Hoy eso solo queda en UI/auditoría local; **no se escribe** en ERP (`MT_CLIENT.FONOACT` / `MT_CLIENT.MAIL`).

Existe el SP:

```sql
EXEC SP_ACTUALIZA_DATOS_MOL
    @CODCLI = '12345678-9',
    @FONOACT = '56987654321',
    @MAIL = 'juanluis@uniacc.edu'
```

Hay que invocarlo desde MOL vía uniacc-api, en el ambiente ERP activo de rematrícula, sin bloquear al alumno si falla.

## Decisiones

| Tema | Decisión |
|------|----------|
| Enfoque | **A** — Endpoint dedicado en uniacc-api + orquestación en MOL |
| Momento del SP | Cuando **ambos** canales quedan OK (2.º OTP o 2.º “continuar sin OTP”) |
| Fallo del SP | Alumno **avanza igual**; se registra error (log API + consola/auditoría MOL) |
| Ambiente ERP | `resolveAmbienteActivo()` (`tp_mnp_erp_sp_ambiente`) |
| Continuar sin OTP | También llama SP, **solo si** correo o teléfono **cambió** vs valor ERP mostrado |
| CODCLI | Con DV, p. ej. `12345678-9` (como ejemplo del SP) |
| Sync TEST | Si ambiente = `test`, antes del SP: baseline `FONOACT`/`MAIL` desde PROD → TEST (si existe la fila) |

## Fuera de alcance (esta iteración)

- OTP SMS real en backend (sigue mock/UI en MOL).
- Insertar filas nuevas completas en `MT_CLIENT` TEST (sin espejo de columnas obligatorias).
- Actualizar apoderado / otras tablas ERP.
- Bloquear el flujo por fallo ERP.
- Push / deploy automático.

## Flujo

```text
Datos personales (contacto)
  │
  correo OK + teléfono OK
  │
  ¿cambió mail o fono vs valor mostrado del ERP?
  ├─ No  → no llama API; sigue irPostContacto
  └─ Sí  → MOL POST /api/rematricula/contacto/actualizar-datos-erp
              │
              ambiente = resolveAmbienteActivo()
              │
              si ambiente = test:
                leer PROD MT_CLIENT (CODCLI, FONOACT, MAIL)
                si existe en TEST → UPDATE baseline FONOACT/MAIL desde PROD
                si no existe → log NEED_SEED (sin INSERT inventado)
              │
              EXEC SP_ACTUALIZA_DATOS_MOL @CODCLI, @FONOACT, @MAIL
              │
              RESULTADO=1 → log OK
              RESULTADO=0 / ERP error → log error
              │
              (en paralelo) alumno ya puede irPostContacto — no espera éxito SP
```

Idempotencia UI: flag de sesión `erpSyncIntentado` (o equivalente) para **una** llamada por paso de contacto.

## API (uniacc-api)

### `POST /api/rematricula/contacto/actualizar-datos-erp`

**Body**

```json
{
  "codcli": "12345678-9",
  "fonoact": "56987654321",
  "mail": "juanluis@uniacc.edu"
}
```

**Validación (express-validator):**

- `codcli`: string, trim, notEmpty, max 20
- `fonoact`: string, trim, notEmpty, max 50
- `mail`: string, trim, isEmail, max 200

**Servicio:** `ActualizaDatosMolService` (mismo patrón que `alumno-deuda-net.service.ts`):

1. `resolveAmbienteActivo()` + `getConnectionErpSp(ambiente)` + `hostEnmascarado`
2. Si `ambiente === 'test'`: sync baseline PROD→TEST (ver abajo)
3. `EXEC SP_ACTUALIZA_DATOS_MOL` con inputs tipados
4. Interpretar primera fila: `RESULTADO`, `MENSAJE`

**Respuestas**

| Caso | HTTP | Body (resumen) |
|------|------|----------------|
| SP OK (`RESULTADO = 1`) | 200 | `{ ok: true, message, data, params, duracionMs }` |
| No encontrado (`RESULTADO = 0`) | 200 | `{ ok: false, code: 'NOT_FOUND', message }` |
| Error SQL / conexión | 502 | `{ ok: false, code: 'ERP_ERROR', error }` |
| Body inválido | 400 | validation errors |

`params` incluye `ambiente` y `host` enmascarado (auditoría).

### Sync PROD → TEST (dentro del mismo request)

Solo cuando ambiente activo es `test`:

1. Conexión **prod**: `SELECT CODCLI, FONOACT, MAIL FROM MT_CLIENT WHERE CODCLI = @CODCLI`
2. Si no hay fila en PROD: log; continuar al SP (fallará o no según TEST)
3. Conexión **test**:
   - Si existe `CODCLI`: `UPDATE MT_CLIENT SET FONOACT = @FONOACT_PROD, MAIL = @MAIL_PROD WHERE CODCLI = @CODCLI`
   - Si no existe: **no** INSERT; log `NEED_SEED`; continuar al SP

Objetivo: en TEST, el “antes” del contacto coincide con PROD; luego el SP aplica los valores nuevos del alumno.

### Ops opcional (misma iteración si cabe, o inmediata siguiente)

`POST /api/rematricula/contacto/sync-mt-client-prod-to-test`  
Body: `{ "codcli": "..." }`  
Misma lógica de sync **sin** ejecutar el SP. Útil para precargar cartera de prueba.

## MOL

### Cliente

`src/services/actualizarDatosMolApi.ts` — patrón `apiPath` + `fetchWithTimeout` (como `rematriculaOtpApi` / `alumnoDeudaNetApi`).

### Orquestación (`DatosPersonalesMockView.vue`)

Disparo cuando ambos `correoValidadoOk` y `telefonoValidadoOk` (watcher actual + puntos `aceptarContinuarSinOtp*` / verify OK):

1. Resolver `codcli` desde fuente alumno (`codcliMostrado`)
2. `fonoact` = `telefonoDraft` normalizado; `mail` = `emailDraft` trim
3. Baseline: valores iniciales ERP (`correoPersonalMostrado` / `telefonoMostrado` al cargar el paso)
4. Si no hay diff (normalizado) → skip
5. Si ya `erpSyncIntentado` → skip
6. Marcar flag; llamar API **sin** bloquear `irPostContacto`
7. Si `ok: false` o red: warn + opcional evento auditoría; no toast bloqueante

Comparación “cambió”: normalizar email (lower/trim) y teléfono (dígitos) antes de comparar.

## Logging

- API: `[actualiza-datos-mol] ambiente=… host=… codcli=… resultado=…`
- Sync: `[actualiza-datos-mol] sync-prod-to-test codcli=… status=updated|missing_test|missing_prod`
- MOL: reutilizar o extender log de contacto OTP / console warn en fallo

## Seguridad / PII

- Endpoint solo en red interna (mismo modelo que resto rematrícula SP).
- Sync PROD→TEST acotado a **un** `CODCLI` por request; no dump masivo.
- No exponer passwords ni hosts completos en responses de cliente.

## Criterios de éxito

1. Con ambos canales OK y datos cambiados, se ejecuta el SP en el ambiente activo.
2. Con datos iguales al ERP, no hay POST.
3. Fallo ERP no impide avanzar a apoderado/discapacidad.
4. En ambiente `test`, si el alumno existe en TEST, baseline FONOACT/MAIL se alinea a PROD antes del UPDATE del SP.
5. Respuestas y logs permiten diagnosticar `NOT_FOUND` vs `ERP_ERROR` vs `NEED_SEED`.

## Self-review

- Sin placeholders TBD en decisiones principales.
- No contradice “no bloquear por fallo SP” ni “ambiente activo”.
- Sync no inventa filas `MT_CLIENT` (alcance explícito).
- Scope acotado a contacto alumno + sync selectivo; apoderado queda fuera.
