# Task 3 Report: Constantes MOL + migración Supabase

**Fecha:** 2026-09-25  
**Repo:** `/opt/mol-docker`

## Objetivo

Alinear `DISCAPACIDAD_TIPOS` y validación Supabase (`CHECK` + RPC `guardar_mnp_discapacidad_encuesta`) con los 7 códigos de `MT_DISCAPACIDAD` usados en uniacc-api (sin `Ninguna`).

## Archivos

| Acción | Ruta |
|--------|------|
| Modificado | `src/constants/discapacidadEncuesta.ts` |
| Creado | `supabase/migrations/20260925120000_mnp_discapacidad_tipos_mt.sql` |

## Constantes UI (`DISCAPACIDAD_TIPOS`)

1. `Física-Motora` (guion ASCII)
2. `Física–Visceral` (en-dash U+2013)
3. `Visual`
4. `Auditiva`
5. `Psíquica`
6. `Intelectual`
7. `Espectro del Autismo`

Copy: subtítulo pregunta 1 → «Códigos institucionales alineados a ERP (TyC §4.4).»

## Tests

No había tests con literales `'Física'` / `'Autismo'`; sin cambios en suite.

## Migración SQL

- `DROP` constraint `mnp_discapacidad_encuesta_tipo_chk`
- `UPDATE` legacy: `Física` → `Física-Motora`, `Autismo` → `Espectro del Autismo`
- `ADD` CHECK con los 7 literales
- `CREATE OR REPLACE` `guardar_mnp_discapacidad_encuesta` con array `v_tipos_permitidos` (mismos 7)

## Supabase desarrollo

**Conexión:** DBCode `supabase@uniacc-desarrollo` (`cVJ5jtBrhIF00usy-bbiN`, DB `postgres`)

**Aplicado:** sí (2026-09-25)

- Constraint nuevo verificado vía `pg_get_constraintdef`
- 4 filas mock con `Física` migradas a `Física-Motora`; `Visual` sin cambio
- RPC reemplazada + `GRANT EXECUTE` a `anon`, `authenticated`

## Commit

Ver `git log -1` en mol-docker tras commit Task 3.

## Siguiente

Task 4: cliente `actualizarDiscapacidadMolApi.ts` + orquestación en `MatriculaMockDiscapacidadStep.vue`.
