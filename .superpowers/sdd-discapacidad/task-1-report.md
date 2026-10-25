# Task 1 Report: Servicio SP en uniacc-api

**Status:** DONE  
**Date:** 2026-09-25  
**Repo:** `/opt/uniacc-api-docker`

## Deliverable

Created `src/services/actualiza-discapacidad-mol.service.ts` with:

- `ActualizaDiscapacidadMolService.actualizar({ codcli, discapacidad })`
- Exported singleton `actualizaDiscapacidadMolService`
- Types: `ActualizaDiscapacidadMolParams`, `ActualizaDiscapacidadMolData`, `ActualizaDiscapacidadMolResult`

## Implementation notes

- Imports mirror `actualiza-datos-mol.service.ts`: `getConnectionErpSp`, `hostEnmascarado`, `resolveAmbienteActivo`, `mssql`.
- Executes `SP_MOL_ACTUALIZA_DISCAPACIDAD` with `@CODCLI` (VarChar 20) and `@DISCAPACIDAD` (VarChar 100).
- Empty recordset → `ok: false`, `code: 'NO_ROWS'` (same pattern as contacto OTP service).
- First row `RESULTADO === 'OK'` (case-insensitive) → success with `data.resultado` and `data.raw`.
- `RESULTADO === 'ERROR'` or other non-OK → `ok: false`; message from `ERROR_MESSAGE` / `MENSAJE`; `code` from `classifySpFailureCode` (`INVALID_CODE` when message or row code indicates invalid `MT_DISCAPACIDAD`, else `ERP_ERROR`).
- SQL exceptions → `ERP_ERROR` with logged message.
- **No** PROD→TEST sync for discapacidad (per spec: SP UPDATE only; missing TEST row fails and is logged).
- Startup log: `[actualiza-discapacidad-mol] ambiente=… host=… codcli=…`.

## Tests

- No unit test file added: repo uses `node:test` for some services; brief allows smoke in Task 2.
- Typecheck: `npx tsc --noEmit` — **pass** (exit 0).

## Commit

```
feat(rematricula): servicio SP_MOL_ACTUALIZA_DISCAPACIDAD
```

`5d81a28` — feat(rematricula): servicio SP_MOL_ACTUALIZA_DISCAPACIDAD

## Self-review

| Check | Result |
|-------|--------|
| Matches task brief EXEC block | Yes |
| Result union types per plan | Yes |
| No `any` | Yes |
| No discapacidad PROD→TEST copy | Yes |
| Follows actualiza-datos-mol structure | Yes |

## Concerns

- `INVALID_CODE` classification is heuristic (ERROR_MESSAGE / optional CODE column from SP) until Task 2 validates against real SP responses in TEST.
- Success path uses `ERROR_MESSAGE` only as fallback for `message` if present; primary success message defaults to generic text or `MENSAJE` from row.

## Next (Task 2)

Wire `POST /api/rematricula/discapacidad/actualizar-erp` to `actualizaDiscapacidadMolService.actualizar`.
