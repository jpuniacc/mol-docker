# Task 2 Report: Controller + routes + mount (uniacc-api)

**Fecha:** 2026-09-25  
**Repo:** `/opt/uniacc-api-docker`  
**Commit:** `8b943ff` — feat(rematricula): endpoint actualizar discapacidad ERP (Task 1 servicio: `5d81a28`)

## Objetivo

Exponer `POST /api/rematricula/discapacidad/actualizar-erp` consumiendo `actualizaDiscapacidadMolService.actualizar`, con validación HTTP y lista blanca de códigos alineada a `MT_DISCAPACIDAD`.

## Archivos

| Acción | Ruta |
|--------|------|
| Creado | `src/controllers/rematricula-discapacidad.controller.ts` |
| Creado | `src/routes/rematricula-discapacidad.routes.ts` |
| Modificado | `src/index.ts` |

## Endpoint

- **Método y path:** `POST /api/rematricula/discapacidad/actualizar-erp`
- **Body JSON:**
  - `codcli` (string, max 20, requerido)
  - `discapacidad` (string, max 100, requerido)

### Lista blanca (`discapacidad`)

Validación adicional en controller (400 + `code: INVALID_CODE` si no coincide):

1. `Física-Motora` (guion ASCII)
2. `Física–Visceral` (en-dash U+2013, según diseño / tabla U+ Test)
3. `Visual`
4. `Auditiva`
5. `Psíquica`
6. `Intelectual`
7. `Espectro del Autismo`

No se acepta `Ninguna` en este endpoint (flujo “contesta”).

Constante exportada: `DISCAPACIDAD_CODIGOS_PERMITIDOS`.

## Comportamiento HTTP (espejo contacto-datos)

| Caso | Status | Cuerpo |
|------|--------|--------|
| express-validator falla | 400 | `ok: false`, `errors` |
| Fuera de lista blanca | 400 | `ok: false`, `code: INVALID_CODE`, `allowed` |
| Servicio `ok: true` | 200 | `ok: true`, `data`, `params`, `duracionMs` |
| Servicio `ok: false`, `code: ERP_ERROR` | 502 | `ok: false`, `code`, `message`, `error`, … |
| Servicio `ok: false`, `NO_ROWS` / `INVALID_CODE` | 200 | mismo shape que contacto |
| Excepción no capturada en servicio | 500 | error interno |

## Mount y startup

```ts
app.use('/api/rematricula/discapacidad', rematriculaDiscapacidadRoutes)
```

Log al arrancar:

```
POST   /api/rematricula/discapacidad/actualizar-erp
```

## Verificación

```bash
cd /opt/uniacc-api-docker && npx tsc --noEmit
```

**Resultado:** exit code 0, sin errores.

## Dependencias previas (Task 1)

- `src/services/actualiza-discapacidad-mol.service.ts` — ya en commit `5d81a28`.

## Pendiente / fuera de scope Task 2

- Integración MOL front → llamada a este endpoint tras RPC Supabase.
- Sync PROD→TEST de fila MT_CLIENT si aplica (diseño; no implementado en contacto para discapacidad en este task).
