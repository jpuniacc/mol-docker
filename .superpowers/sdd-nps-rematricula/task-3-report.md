# Task 3 Report: Cliente alumno (estado + guardar)

**Status:** DONE  
**Branch:** `dev`  
**Date:** 2026-10-18  
**Commit:** `dee9238` — feat(nps): cliente API estado y guardar NPS rematrícula

## Summary

Cliente TypeScript para consultar estado y guardar respuesta NPS rematrícula vía RPCs de Task 2, siguiendo el patrón de `discapacidadEncuesta.ts`.

## Deliverables

| Acción | Archivo |
|--------|---------|
| Creado | `src/services/npsRematriculaApi.ts` |
| Omitido | `src/services/npsRematriculaApi.test.ts` (sin patrón de mock `supabase.rpc` en el repo) |

### Exports

| Export | Contrato |
|--------|----------|
| `EstadoNpsRematricula` | `{ respondio: boolean; calificacion: CalificacionNps \| null }` |
| `GuardarNpsRematriculaPayload` | rut, codcli, carrera, jornada, periodo, calificación, comentario opcional, labels/sesión |
| `estadoNpsRematricula(codcli, anio, semestre)` | `EstadoNpsRematricula \| { error: string }` → RPC `estado_mnp_nps_rematricula` |
| `guardarNpsRematricula(payload)` | `null` ok / `string` error → RPC `guardar_mnp_nps_rematricula` |

### Comportamiento clave

- `estadoNpsRematricula`: valida calificación con `esCalificacionNps`; `respondio` solo si `=== true`.
- `guardarNpsRematricula`: normaliza comentario con `normalizarComentarioNps`; envía `p_url_origen` desde `window.location.href` en browser.

## Tests

- **Unit test del servicio:** omitido. Los tests de services existentes (`periodoActivo`, `grabarPlanPagosApi`, etc.) prueban helpers puros; no hay mock de `supabase.rpc`/`supabaseClient` fácil de reutilizar.
- **Smoke manual:** diferido a Task 4 (doble guardar mismo codcli/periodo debe fallar por unicidad).
- Cobertura de lógica de comentario/calificación ya cubierta en Task 1 (`npsRematricula.test.ts`).

## Commit

Solo `src/services/npsRematriculaApi.ts` (sin WIP ajeno).

## Concerns

Ninguno bloqueante. Falta smoke E2E hasta Task 4. Tipos `Functions` de Task 2 ya incluyen ambos RPCs; el cliente confía en esos nombres.
