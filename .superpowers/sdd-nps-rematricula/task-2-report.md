# Task 2 Report: Migración Postgres (tabla, RPCs, menú)

**Status:** DONE  
**Branch:** `dev`  
**Date:** 2026-10-18

## Summary

Migración Postgres + tipos TypeScript para NPS rematrícula creados y aplicados en `supabase-db` local.

## Deliverables

| Acción | Archivo |
|--------|---------|
| Creado | `supabase/migrations/20261018180000_mnp_nps_rematricula.sql` |
| Modificado | `src/types/supabase.ts` (`MnpNpsRematricula` + Functions) |

### SQL (migración)

- Tabla `public.mnp_nps_rematricula` con CHECK calificación 1–5, comentario solo si 1–3 (≤500), UNIQUE `(codcli, anio_periodo, semestre_periodo)`
- RLS: deny SELECT/INSERT para `anon` y `authenticated`
- RPC `guardar_mnp_nps_rematricula(...) RETURNS uuid` (SECURITY DEFINER + log evento)
- RPC `estado_mnp_nps_rematricula(...) RETURNS jsonb` → `{ respondio, calificacion }`
- Menú BO: id `...000048`, route `dashboard-nps-rematricula`, label `NPS rematrícula`, icon `Star`, parent Rematrícula `...000020`, grupo DVU `1`, orden `30`

### TypeScript

- `export type MnpNpsRematricula` junto a tipos MNP de discapacidad
- `Functions.guardar_mnp_nps_rematricula` y `Functions.estado_mnp_nps_rematricula` junto a `guardar_mnp_discapacidad_encuesta`

## Step 3 — Aplicar migración

Aplicada con éxito en entorno local:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/20261018180000_mnp_nps_rematricula.sql
```

Verificado: `\d mnp_nps_rematricula`, ambas funciones en `pg_proc`, fila menú `...000048`.

## Tests

N/A (tarea solo DB + types; sin tests unitarios en scope).

## Commit

Solo archivos de esta tarea (sin WIP ajeno).

## Concerns

Ninguno. Migración aplicada en DB local de desarrollo; otros entornos (QA/prod) deben aplicar el mismo archivo SQL cuando corresponda.
