# FECREG Webpay = día de caja + `grabado_en` en Postgres

**Fecha:** 2026-11-16  
**Repos:** `mol-docker` (SP U+) + `uniacc-api-docker` / Supabase MOL (columna Postgres)  
**Estado:** implementado 2026-11-16 (SP TEST+PROD; API deploy; grabado_en en supabase-db; smoke E2E pendiente)

## Problema

En `dbo.sp_mol_grabar_plan_pagos`, la boleta 41 escribe `FECREG = @fecreg_caja` (fecha de `MT_PARCAJA` para la caja abierta), pero el pago Webpay escribe:

- `MT_CTAPAG.FECREG = @hoy` (`CAST(GETDATE() AS date)`)
- `MT_CTADEP.FECREG_DEP = @hoy`

Cuando la fecha de caja abierta ≠ día calendario del `EXEC`, pago y boleta quedan en días distintos. `SP_GENERAVOUCHER` no arma bien el asiento Webpay y tapa con plug `9-9-99-99` (~$200.000).

Casos MOL 2027-1 (usuario `68678`) ya se remedieron a mano alineando `FECREG`/`FECREG_DEP` al día de la boleta. Este cambio evita nuevos desfases.

En paralelo, U+ no conserva el instante real del grabado ERP (solo día de caja / fecha documento). En Postgres ya existen `transaction_date`, `creado_en` y `actualizado_en` del cobro Transbank; falta el momento en que ese cobro quedó escrito en U+.

## Decisión

| Decisión | Valor |
|----------|--------|
| Fecha canónica de registro en U+ | `@fecreg_caja` |
| Alcance U+ | Solo Webpay: `MT_CTAPAG` del JSON + su `MT_CTADEP` |
| Enfoque U+ | Cirugía mínima: dos literales `@hoy` → `@fecreg_caja` |
| `MT_CTAPAG.FECHA` | Sin cambio: sigue `@fecha_json` (Transbank) |
| Fecha real en MOL | Columna `grabado_en` en `public.mnp_webpay_transaccion` (no en el borrador) |
| Quién escribe `grabado_en` | API Node tras `EXEC sp_mol_grabar_plan_pagos` OK, sobre las filas Webpay del plan |

## Parte A — SP U+

En el cursor `#docs_web` del SP canónico `docs/SP a U+/sp_mol_grabar_plan_pagos.sql`:

1. `INSERT MT_CTAPAG` Webpay: columna `FECREG` de `@hoy` a `@fecreg_caja` (dejar `FECCANCEL`/`FECHA` como están).
2. `INSERT MT_CTADEP` con `aplicaBoleta = 1`: `FECREG_DEP` de `@hoy` a `@fecreg_caja`.

Actualizar el comentario de cabecera del SP: `FECREG`/`FECREG_DEP` del Webpay usan el día de caja, igual que la boleta 41.

**Artefacto:** patch idempotente `docs/SP a U+/patches/2026-11-16-sp_mol_grabar_plan_pagos_fecreg_webpay_caja.sql` (estilo `OBJECT_DEFINITION` + `REPLACE` de `2026-11-09-…_matricula_cero.sql`), con contexto único para no tocar otros `@hoy`.

**Despliegue:** U+ TEST → smoke → U+ PROD.

## Parte B — Postgres `grabado_en`

**Tabla:** `public.mnp_webpay_transaccion`  
**Columna:** `grabado_en timestamptz NULL`  
**Semántica:** instante en que el plan de pagos quedó grabado en U+ para ese cobro autorizado. Distinto de:

- `transaction_date` / autorización Transbank  
- `creado_en` / `actualizado_en` del ciclo Webpay  
- `FECREG` día de caja en U+

**No** va en `mol_borrador_rematricula` (estado UI, no fuente de verdad del cobro).

**Migración:** SQL en el repo que usa Supabase MOL (`uniacc-api-docker` o migración equivalente del proyecto), `ADD COLUMN IF NOT EXISTS`.

**Escritura:** en `grabarPlanPagosErp` (o helper inmediato), después de SP exitoso y con `num_operacion` / buy_orders del plan, `UPDATE … SET grabado_en = NOW() WHERE … AND grabado_en IS NULL` (idempotente si se reintenta). Solo filas `estado = 'autorizada'` del alumno/concepto involucrado.

**Lectura:** disponible para reportes/conciliación; no cambia el contrato Transbank ni el SP.

## Verificación

**U+ (Parte A):**

- `CONVERT(date, CTAPAG.FECREG) = CONVERT(date, boleta41.FECREG) = @fecreg_caja`
- `FECREG_DEP` igual; `CTAPAG.FECHA` = JSON Transbank
- Inventario MOL post-deploy: 0 desfases nuevos pago vs boleta

**Postgres (Parte B):**

- Tras un grabado Webpay de prueba, la(s) fila(s) autorizada(s) tienen `grabado_en` no nulo
- Re-ejecutar el mismo camino no pisa un `grabado_en` ya seteado (si se usa `IS NULL`)
- Filas solo autorizadas (sin grabar plan) siguen con `grabado_en` NULL

## Fuera de alcance

- Chequeo post-grabado que falle el request si pago ≠ boleta (observabilidad opcional después).
- Unificar `FECREG` de pagarés tipo 5, cuotas, beneficios u otros `@hoy`.
- Recentralización Finance / plugs `9-9-99-99` ya existentes.
- Backfill masivo de `grabado_en` en histórico (opcional aparte; se puede derivar de logs si hace falta).
- Campos nuevos en el borrador JSON.

## Criterios de éxito

- Grabado Webpay nuevo en TEST/PROD: sin desfase `FECREG` pago vs boleta.
- Patch SP idempotente.
- `FECHA` Transbank y companions 809/810/811 sin cambio de lógica.
- Cada Webpay que entra a U+ vía MOL deja `grabado_en` en Postgres.
