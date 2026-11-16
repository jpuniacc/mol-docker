# FECREG Webpay = día de caja (`sp_mol_grabar_plan_pagos`)

**Fecha:** 2026-11-16  
**Repo:** `mol-docker` (SP en U+)  
**Estado:** diseño aprobado; pendiente plan de implementación

## Problema

En `dbo.sp_mol_grabar_plan_pagos`, la boleta 41 escribe `FECREG = @fecreg_caja` (fecha de `MT_PARCAJA` para la caja abierta), pero el pago Webpay escribe:

- `MT_CTAPAG.FECREG = @hoy` (`CAST(GETDATE() AS date)`)
- `MT_CTADEP.FECREG_DEP = @hoy`

Cuando la fecha de caja abierta ≠ día calendario del `EXEC`, pago y boleta quedan en días distintos. `SP_GENERAVOUCHER` no arma bien el asiento Webpay y tapa con plug `9-9-99-99` (~$200.000).

Casos MOL 2027-1 (usuario `68678`) ya se remedieron a mano alineando `FECREG`/`FECREG_DEP` al día de la boleta. Este cambio evita nuevos desfases.

## Decisión

| Decisión | Valor |
|----------|--------|
| Fecha canónica de registro | `@fecreg_caja` |
| Alcance | Solo Webpay: `MT_CTAPAG` del JSON + su `MT_CTADEP` |
| Superficie | Solo patch del SP en U+ (TEST → PROD) |
| Enfoque | Cirugía mínima: dos literales `@hoy` → `@fecreg_caja` |
| `MT_CTAPAG.FECHA` | Sin cambio: sigue `@fecha_json` (Transbank) |

## Cambio concreto

En el cursor `#docs_web` del SP canónico `docs/SP a U+/sp_mol_grabar_plan_pagos.sql`:

1. `INSERT MT_CTAPAG` Webpay: columna `FECREG` de `@hoy` a `@fecreg_caja` (dejar `FECCANCEL`/`FECHA` como están).
2. `INSERT MT_CTADEP` con `aplicaBoleta = 1`: `FECREG_DEP` de `@hoy` a `@fecreg_caja`.

Actualizar el comentario de cabecera del SP para documentar que `FECREG`/`FECREG_DEP` del Webpay usan el día de caja, igual que la boleta 41.

## Artefactos

1. Diff en `docs/SP a U+/sp_mol_grabar_plan_pagos.sql`.
2. Patch idempotente `docs/SP a U+/patches/2026-11-16-sp_mol_grabar_plan_pagos_fecreg_webpay_caja.sql`, mismo estilo que `2026-11-09-sp_mol_grabar_plan_pagos_matricula_cero.sql`:
   - leer `OBJECT_DEFINITION`
   - `CREATE` → `ALTER` si aplica
   - `REPLACE` de fragmentos con contexto único (no tocar otros `@hoy`)
   - fallar si el patrón no aparece o si queda `@hoy` en esos dos INSERT Webpay

## Despliegue

1. Aplicar patch en **U+ TEST** (`TEST_UNIACC`).
2. Smoke: grabar plan con Webpay (idealmente con `@fecreg_caja <> @hoy`, o forzar caja en día distinto).
3. Verificar por folio Webpay:
   - `CONVERT(date, CTAPAG.FECREG) = CONVERT(date, boleta41.FECREG) = @fecreg_caja`
   - `CONVERT(date, CTADEP.FECREG_DEP)` igual
   - `CTAPAG.FECHA` = fecha JSON Transbank (puede diferir del día de caja)
4. Aplicar el mismo patch en **U+ PROD**.
5. Query inventario post-deploy (usuario MOL, periodo activo): 0 filas nuevas con `FECREG` pago ≠ boleta 41.

## Fuera de alcance

- Cambios en Node / `uniacc-api-docker` (chequeo post-grabado queda como follow-up opcional).
- Unificar `FECREG` de pagarés tipo 5, cuotas, beneficios u otros `@hoy`.
- Recentralización Finance / limpieza de plugs `9-9-99-99` ya existentes.
- Reescritura de filas históricas ya alineadas el 2026-11-16.

## Criterios de éxito

- En TEST y PROD, un grabado Webpay nuevo no genera desfase `FECREG` pago vs boleta.
- El patch es idempotente (segunda ejecución no rompe ni reescribe de más).
- No cambian `FECHA` documento Transbank ni la lógica de correlativos / companions 809/810/811.
