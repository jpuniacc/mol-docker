# Task 4 Report: Cliente MOL + orquestación paso discapacidad

**Fecha:** 2026-09-25  
**Repo:** `/opt/mol-docker`

## Objetivo

Tras guardar la encuesta en Supabase (`contesta=true`), sincronizar `MT_CLIENT.DISCAPACIDAD` vía `POST /api/rematricula/discapacidad/actualizar-erp` sin bloquear la navegación. En `omitir`, solo Supabase — sin ERP.

## Archivos

| Acción | Ruta |
|--------|------|
| Creado | `src/services/actualizarDiscapacidadMolApi.ts` |
| Modificado | `src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue` |

`discapacidadEncuesta.ts`: sin cambios (tipos ya alineados en Task 3).

## Cliente API

- **Función:** `actualizarDiscapacidadMolErp({ codcli, discapacidad })`
- **Patrón:** espejo de `actualizarDatosMolApi.ts` (base `admisionApiBaseUrl`, timeout 60s, JSON, no throw al caller).
- **Payload:** `codcli` y `discapacidad` con `.trim()`; `codcli` se toma del contexto de auditoría **con DV tal cual** muestra la UI.

## Orquestación UI

### `guardar()` (`contesta=true`)

1. `persistirEncuesta` → RPC Supabase  
2. `mockCtx.setDiscapacidad`  
3. Fire-and-forget: `void actualizarDiscapacidadMolErp(...).then(...)`; fallos → `console.warn('[discapacidadErp]', ...)`  
4. `void router.push({ name: 'matricula-mock-forma-pago' })` (no depende del ERP)

### `omitir()`

Sin cambios funcionales respecto al brief: Supabase + `setDiscapacidad` + navigate; **ninguna** llamada ERP.

## Verificación

```bash
cd /opt/mol-docker && npx tsc --noEmit
```

**Resultado:** exit code 0.

### Smoke UI (manual)

| Caso | Esperado |
|------|----------|
| Contestar con tipo Visual | POST `discapacidad/actualizar-erp`; ERP `DISCAPACIDAD` = Visual |
| Omitir | Sin POST ERP; valor ERP previo intacto |
| Afirmaciones | Solo en Supabase (RPC), no en ERP |

## Commit

`ed766f0` — feat(rematricula): sync discapacidad a ERP al contestar encuesta

## Dependencias

- **Task 2 (uniacc-api):** endpoint `POST /api/rematricula/discapacidad/actualizar-erp`
- **Task 3:** `DISCAPACIDAD_TIPOS` = lista blanca API

## Fix review: persistirEncuesta (2026-09-25)

**Hallazgo:** `guardar()` y `omitir()` ignoraban el `boolean` de `persistirEncuesta`; ante fallo Supabase seguían toast/ERP/navegación.

**Cambio:** En ambos flujos, si `persistirEncuesta` devuelve `false` → `toast.error('No se pudo guardar la encuesta. Intenta de nuevo.')` y `return` antes de `setDiscapacidad`, toast de éxito, ERP o `router.push`.

### Verificación

```bash
cd /opt/mol-docker && npx tsc --noEmit
```

**Resultado:** exit code 0.

| Caso | Esperado |
|------|----------|
| `guardar()` con RPC Supabase fallido | Toast error; sin ERP; sin navegación; mock ctx sin actualizar |
| `omitir()` con RPC fallido | Toast error; sin navegación; mock ctx sin actualizar |
| `guardar()` con RPC OK | Flujo previo: ctx, toast éxito, ERP fire-and-forget, navigate |
