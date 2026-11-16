# FECREG Webpay día de caja + `grabado_en` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el Webpay grabado en U+ use `FECREG`/`FECREG_DEP` = día de caja (igual que la boleta 41) y que Postgres registre `grabado_en` al cerrar el plan en ERP.

**Architecture:** Parte A parchea `sp_mol_grabar_plan_pagos` (dos literales). Parte B agrega `grabado_en` en `mnp_webpay_transaccion` y lo setea desde `grabarPlanPagosErp` tras SP OK. Desplegables en orden: migración Postgres → API → patch U+ TEST → smoke → U+ PROD (A y B pueden ir en paralelo hasta el smoke conjunto).

**Tech Stack:** T-SQL (U+), Postgres/Supabase MOL, TypeScript Node (`uniacc-api-docker`), `tsx --test`.

**Spec:** [`docs/superpowers/specs/2026-11-16-fecreg-webpay-dia-caja-design.md`](../specs/2026-11-16-fecreg-webpay-dia-caja-design.md)

## Global Constraints

- Canónica U+: `@fecreg_caja` solo en Webpay `MT_CTAPAG.FECREG` y `MT_CTADEP.FECREG_DEP`.
- No tocar `MT_CTAPAG.FECHA` (`@fecha_json`), ni otros `@hoy` (pagarés, beneficios, DOCITEM).
- `grabado_en` solo en `public.mnp_webpay_transaccion`; no en borrador.
- `UPDATE … SET grabado_en = NOW() … AND grabado_en IS NULL` (idempotente).
- Fallo al marcar `grabado_en` → log + no tumbar el grabado U+ ya committed (mismo espíritu que avisos post-ficha).
- Sin backfill histórico ni chequeo que falle el HTTP si fechas U+ desfasaran.

---

## File map

| Archivo | Rol |
|---------|-----|
| `/opt/mol-docker/docs/SP a U+/sp_mol_grabar_plan_pagos.sql` | Canónico SP: 2 literales + comentario cabecera |
| `/opt/mol-docker/docs/SP a U+/patches/2026-11-16-sp_mol_grabar_plan_pagos_fecreg_webpay_caja.sql` | Patch idempotente U+ TEST/PROD |
| `/opt/mol-docker/supabase/migrations/20261116123000_webpay_grabado_en.sql` | `ADD COLUMN grabado_en` |
| `/opt/uniacc-api-docker/src/migrations/011_webpay_grabado_en.sql` | Mirror apply manual (como `010_webpay_num_operacion.sql`) |
| `/opt/uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.ts` | `marcarWebpayGrabadoEn` + call post-SP |
| `/opt/uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.test.ts` | Tests idempotencia / no bloqueo |

---

### Task 1: Migración Postgres `grabado_en`

**Files:**
- Create: `/opt/mol-docker/supabase/migrations/20261116123000_webpay_grabado_en.sql`
- Create: `/opt/uniacc-api-docker/src/migrations/011_webpay_grabado_en.sql`
- Produces: columna `public.mnp_webpay_transaccion.grabado_en timestamptz NULL`

- [ ] **Step 1: Escribir migración (ambos repos, mismo SQL)**

```sql
-- Instante en que el cobro Webpay quedó grabado en U+ vía sp_mol_grabar_plan_pagos.
-- Distinto de transaction_date (Transbank) y de FECREG día de caja en ERP.
ALTER TABLE public.mnp_webpay_transaccion
  ADD COLUMN IF NOT EXISTS grabado_en timestamptz NULL;

COMMENT ON COLUMN public.mnp_webpay_transaccion.grabado_en IS
  'Timestamp MOL cuando el plan de pagos escribió este cobro en U+';
```

- [ ] **Step 2: Aplicar en Supabase MOL (dev/prod según proceso del equipo)**

Ejemplo si usan `psql` contra el pooler del proyecto:

```bash
# Ajustar conexión al ambiente destino
psql "$DATABASE_URL" -f /opt/mol-docker/supabase/migrations/20261116123000_webpay_grabado_en.sql
```

Verificar:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'mnp_webpay_transaccion'
  AND column_name = 'grabado_en';
```

Expected: `timestamp with time zone`, `YES`.

- [ ] **Step 3: Commit**

```bash
git -C /opt/mol-docker add supabase/migrations/20261116123000_webpay_grabado_en.sql
git -C /opt/mol-docker commit -m "$(cat <<'EOF'
feat(webpay): columna grabado_en en mnp_webpay_transaccion

EOF
)"

git -C /opt/uniacc-api-docker add src/migrations/011_webpay_grabado_en.sql
git -C /opt/uniacc-api-docker commit -m "$(cat <<'EOF'
feat(webpay): mirror migración grabado_en

EOF
)"
```

---

### Task 2: API — marcar `grabado_en` tras SP OK

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.ts`
- Modify: `/opt/uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.test.ts`
- Consumes: `querySupabase`, `GrabarPlanPagosInput`, conceptos webpay del plan
- Produces: `marcarWebpayGrabadoEn(...)` (exportada o interna + hook `deps.marcarWebpayGrabadoEn` para tests)

- [ ] **Step 1: Write the failing test**

En `grabar-plan-pagos-erp.service.test.ts`, dentro de `describe('grabarPlanPagosErp Webpay matrícula')`, agregar:

```ts
it('marca grabado_en en filas webpay autorizadas tras SP OK', async () => {
  const calls: Array<{ codigos: string[]; conceptos: string[] }> = []
  const result = await grabarPlanPagosErp(webpayMatInput(), {
    ambiente: { ambiente: 'test', label: 't' },
    pool: poolWebpay({ postSpTieneFolios: true }) as never,
    leerWebpayAutorizada: async () => filaVd,
    marcarWebpayGrabadoEn: async (p) => {
      calls.push({ codigos: p.codigos, conceptos: p.conceptos })
    },
  })
  assert.equal(result.ok, true)
  assert.equal(calls.length, 1)
  assert.ok(calls[0].conceptos.includes('matricula'))
})

it('si marcar grabado_en falla, el grabado U+ igual responde ok', async () => {
  const result = await grabarPlanPagosErp(webpayMatInput(), {
    ambiente: { ambiente: 'test', label: 't' },
    pool: poolWebpay({ postSpTieneFolios: true }) as never,
    leerWebpayAutorizada: async () => filaVd,
    marcarWebpayGrabadoEn: async () => {
      throw new Error('postgres down')
    },
  })
  assert.equal(result.ok, true)
})
```

Ajustar nombres (`webpayMatInput`, `poolWebpay`, `filaVd`, `ASIGNADO`) a los ya existentes en ese describe.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /opt/uniacc-api-docker && npx tsx --test src/services/grabar-plan-pagos-erp.service.test.ts
```

Expected: FAIL (dep `marcarWebpayGrabadoEn` no tipada / no llamada).

- [ ] **Step 3: Implement**

1. Extender `GrabarPlanPagosDeps`:

```ts
marcarWebpayGrabadoEn?: (params: {
  codigos: string[]
  ano: number
  periodo: number
  conceptos: Array<'matricula' | 'arancel'>
}) => Promise<void>
```

2. Función (misma firma) que por defecto hace:

```ts
async function marcarWebpayGrabadoEn(params: {
  codigos: string[]
  ano: number
  periodo: number
  conceptos: Array<'matricula' | 'arancel'>
}): Promise<void> {
  if (params.conceptos.length === 0) return
  await querySupabase(
    `UPDATE public.mnp_webpay_transaccion
        SET grabado_en = NOW(),
            actualizado_en = NOW()
      WHERE codcli = ANY($1::text[])
        AND anio_periodo = $2
        AND semestre_periodo = $3
        AND concepto = ANY($4::text[])
        AND estado = 'autorizada'
        AND grabado_en IS NULL`,
    [params.codigos, params.ano, params.periodo, params.conceptos],
  )
}
```

3. En `grabarPlanPagosErp`, **después** de validar folios/companeros Webpay y **antes** de `registrarIntentoCuenta(… ok)`, construir `conceptos` desde `medioMatricula`/`medioArancel` (solo los que fueron `webpay` y entraron al JSON), luego:

```ts
try {
  const marcar = deps?.marcarWebpayGrabadoEn ?? marcarWebpayGrabadoEn
  await marcar({
    codigos: Array.from(new Set([input.codcli, codcliAcademico].filter(Boolean))),
    ano: input.ano,
    periodo: input.periodo,
    conceptos,
  })
} catch (err) {
  const mensaje = err instanceof Error ? err.message : String(err)
  console.error(
    `[grabar-plan-pagos] plan OK (${numOperacion}) pero no se marcó grabado_en: ${mensaje}`,
  )
}
```

Si el plan no tiene ningún medio webpay, no llamar.

- [ ] **Step 4: Run tests**

```bash
cd /opt/uniacc-api-docker && npx tsx --test src/services/grabar-plan-pagos-erp.service.test.ts
```

Expected: PASS (incluidos los nuevos).

- [ ] **Step 5: Commit**

```bash
git -C /opt/uniacc-api-docker add \
  src/services/grabar-plan-pagos-erp.service.ts \
  src/services/grabar-plan-pagos-erp.service.test.ts
git -C /opt/uniacc-api-docker commit -m "$(cat <<'EOF'
feat(webpay): setear grabado_en al grabar plan en U+

EOF
)"
```

---

### Task 3: Canónico SP + patch U+

**Files:**
- Modify: `/opt/mol-docker/docs/SP a U+/sp_mol_grabar_plan_pagos.sql`
- Create: `/opt/mol-docker/docs/SP a U+/patches/2026-11-16-sp_mol_grabar_plan_pagos_fecreg_webpay_caja.sql`
- Produces: SP en disco listo; script aplicable con DBCode / SSMS

- [ ] **Step 1: Editar canónico**

Cabecera (cerca líneas 14–16): aclarar que **también** `FECREG`/`FECREG_DEP` del Webpay usan `@fecreg_caja`.

En el cursor Webpay, VALUES de `MT_CTAPAG` (hoy):

```sql
                    @fecven_json, @hoy, @hoy, @fecha_json, @usuario, @num_operacion, @jornada
```

Cambiar a:

```sql
                    @fecven_json, @hoy, @fecreg_caja, @fecha_json, @usuario, @num_operacion, @jornada
```

(`FECCANCEL` queda `@hoy`; `FECREG` pasa a `@fecreg_caja`; `FECHA` sigue `@fecha_json`.)

VALUES de `MT_CTADEP` Webpay (hoy):

```sql
                        41, @ctadoc_boleta, @ctapag_json, @ctapagnum, @codcli, @codcarr, @codapod_boleta,
                        @monto_json, 1, @usuario, 0, '1', @ctadoc_boleta, @num_operacion,
                        @caja, @hoy, @ano, @jornada
```

Cambiar la última línea a:

```sql
                        @caja, @fecreg_caja, @ano, @jornada
```

- [ ] **Step 2: Escribir patch idempotente**

Archivo nuevo, estilo `2026-11-09-sp_mol_grabar_plan_pagos_matricula_cero.sql`:

```sql
SET NOCOUNT ON;
DECLARE @sql nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.sp_mol_grabar_plan_pagos'));
IF @sql IS NULL THROW 50000, 'No existe dbo.sp_mol_grabar_plan_pagos', 1;

IF LEFT(LTRIM(@sql), 6) = 'CREATE'
  SET @sql = STUFF(LTRIM(@sql), 1, 6, 'ALTER');

-- Ya aplicado
IF CHARINDEX(N'@fecven_json, @hoy, @fecreg_caja, @fecha_json', @sql) > 0
   AND CHARINDEX(N'@caja, @fecreg_caja, @ano, @jornada', @sql) > 0
   AND CHARINDEX(
         N'41, @ctadoc_boleta, @ctapag_json, @ctapagnum, @codcli, @codcarr, @codapod_boleta',
         @sql) > 0
BEGIN
  PRINT 'Patch FECREG Webpay ya aplicado';
  RETURN;
END

DECLARE @old_pag nvarchar(400) =
  N'@fecven_json, @hoy, @hoy, @fecha_json, @usuario, @num_operacion, @jornada';
DECLARE @new_pag nvarchar(400) =
  N'@fecven_json, @hoy, @fecreg_caja, @fecha_json, @usuario, @num_operacion, @jornada';

IF CHARINDEX(@old_pag, @sql) = 0
BEGIN
  SET @old_pag = REPLACE(@old_pag, CHAR(10), CHAR(13) + CHAR(10));
  SET @new_pag = REPLACE(@new_pag, CHAR(10), CHAR(13) + CHAR(10));
END
IF CHARINDEX(@old_pag, @sql) = 0
  THROW 50000, 'Patron CTAPAG FECREG Webpay no encontrado', 1;

SET @sql = REPLACE(@sql, @old_pag, @new_pag);

DECLARE @old_dep nvarchar(400) = N'@caja, @hoy, @ano, @jornada';
DECLARE @new_dep nvarchar(400) = N'@caja, @fecreg_caja, @ano, @jornada';
-- Anclar al bloque Webpay: solo la ocurrencia tras @ctapag_json en CTADEP.
-- Preferir REPLACE del bloque largo si @old_dep aparece más de una vez:
DECLARE @old_dep_block nvarchar(900) =
  N'41, @ctadoc_boleta, @ctapag_json, @ctapagnum, @codcli, @codcarr, @codapod_boleta,
                        @monto_json, 1, @usuario, 0, ''1'', @ctadoc_boleta, @num_operacion,
                        @caja, @hoy, @ano, @jornada';
DECLARE @new_dep_block nvarchar(900) =
  N'41, @ctadoc_boleta, @ctapag_json, @ctapagnum, @codcli, @codcarr, @codapod_boleta,
                        @monto_json, 1, @usuario, 0, ''1'', @ctadoc_boleta, @num_operacion,
                        @caja, @fecreg_caja, @ano, @jornada';

IF CHARINDEX(@old_dep_block, @sql) = 0
BEGIN
  SET @old_dep_block = REPLACE(@old_dep_block, CHAR(10), CHAR(13) + CHAR(10));
  SET @new_dep_block = REPLACE(@new_dep_block, CHAR(10), CHAR(13) + CHAR(10));
END
IF CHARINDEX(@old_dep_block, @sql) = 0
  THROW 50000, 'Patron CTADEP FECREG_DEP Webpay no encontrado', 1;

SET @sql = REPLACE(@sql, @old_dep_block, @new_dep_block);

IF CHARINDEX(N'@fecven_json, @hoy, @hoy, @fecha_json', @sql) > 0
  THROW 50000, 'Quedo FECREG=@hoy en CTAPAG Webpay', 1;

EXEC sys.sp_executesql @sql;
PRINT 'Patch FECREG Webpay aplicado';
```

Ajustar escapes/`CHAR(13)+CHAR(10)` contra el `OBJECT_DEFINITION` real en TEST antes de PROD (misma técnica que matrícula $0).

- [ ] **Step 3: Commit canónico + patch (mol-docker)**

```bash
git -C /opt/mol-docker add \
  "docs/SP a U+/sp_mol_grabar_plan_pagos.sql" \
  "docs/SP a U+/patches/2026-11-16-sp_mol_grabar_plan_pagos_fecreg_webpay_caja.sql"
git -C /opt/mol-docker commit -m "$(cat <<'EOF'
fix(sp): FECREG Webpay alineado al día de caja

EOF
)"
```

---

### Task 4: Aplicar SP en U+ TEST + smoke

**Files:** ninguno nuevo (ejecución DB)

- [ ] **Step 1: Aplicar patch en U+ TEST**

Con DBCode (`U+ Test` / `TEST_UNIACC`) o SSMS: ejecutar el contenido de  
`docs/SP a U+/patches/2026-11-16-sp_mol_grabar_plan_pagos_fecreg_webpay_caja.sql`.

Verificar definición:

```sql
DECLARE @d nvarchar(max) = OBJECT_DEFINITION(OBJECT_ID('dbo.sp_mol_grabar_plan_pagos'));
SELECT
  CASE WHEN @d LIKE N'%@fecven_json, @hoy, @fecreg_caja, @fecha_json%' THEN 1 ELSE 0 END AS ctapag_ok,
  CASE WHEN @d LIKE N'%@caja, @fecreg_caja, @ano, @jornada%'
        AND @d LIKE N'%@ctapag_json%' THEN 1 ELSE 0 END AS ctadep_ok,
  CASE WHEN @d LIKE N'%@fecven_json, @hoy, @hoy, @fecha_json%' THEN 1 ELSE 0 END AS ctapag_viejo;
```

Expected: `ctapag_ok=1`, `ctadep_ok=1`, `ctapag_viejo=0`.

- [ ] **Step 2: Smoke grabado Webpay en TEST**

Grabar un plan de prueba (flujo MOL test) con matrícula Webpay. Luego:

```sql
-- Sustituir @Codcli / @Op
SELECT
  CONVERT(date, p.FECREG) FECREG_PAGO,
  CONVERT(date, p.FECHA) FECHA_DOC,
  CONVERT(date, d.FECREG_DEP) FECREG_DEP,
  CONVERT(date, b.FECREG) FECREG_BOL,
  CASE WHEN CONVERT(date,p.FECREG)=CONVERT(date,b.FECREG)
        AND CONVERT(date,p.FECREG)=CONVERT(date,d.FECREG_DEP)
       THEN 'OK_MISMO_DIA' ELSE 'AUN_DESFASE' END FLAG
FROM dbo.MT_CTAPAG p
JOIN dbo.MT_CTADEP d
  ON d.CODCLI=p.CODCLI AND d.CTAPAG=p.CTAPAG AND d.CTAPAGNUM=p.CTAPAGNUM
 AND d.NUM_OPERACION=p.NUM_OPERACION
JOIN dbo.MT_CTADOC b
  ON b.CODCLI=d.CODCLI AND b.CTADOC=d.CTADOC AND b.CTADOCNUM=d.CTADOCNUM AND b.CTADOC=41
WHERE p.CODCLI = @Codcli AND p.NUM_OPERACION = @Op AND p.CTAPAG IN (434,435,440);
```

Expected: `OK_MISMO_DIA`. Ideal: caja abierta con `FECHA <> CAST(GETDATE() AS date)` para probar el bug real.

- [ ] **Step 3: Verificar `grabado_en` en Postgres**

```sql
SELECT buy_order, concepto, estado, transaction_date, creado_en, grabado_en, num_operacion
FROM public.mnp_webpay_transaccion
WHERE codcli IN (@rut, @codcliAcademico)
  AND anio_periodo = @ano AND semestre_periodo = @periodo
  AND estado = 'autorizada'
ORDER BY actualizado_en DESC;
```

Expected: fila(s) del smoke con `grabado_en IS NOT NULL`.

---

### Task 5: Deploy PROD (API + SP + migración si falta)

**Files:** deploy ops

- [ ] **Step 1: Migración `grabado_en` en Supabase MOL prod** (si Task 1 solo fue a dev)

- [ ] **Step 2: Deploy `uniacc-api` / contenedor que sirve `grabarPlanPagosErp`**

- [ ] **Step 3: Aplicar el mismo patch SP en U+ PROD** (`UNIACC`)

Re-correr query de definición del Task 4 Step 1 en PROD.

- [ ] **Step 4: Inventario post-deploy (opcional el mismo día)**

```sql
SELECT COUNT(*) AS n_desfases
FROM dbo.MT_CONTROL_MATRICULA cm
JOIN dbo.MT_CTAPAG p
  ON p.CODCLI=cm.CODCLI AND p.NUM_OPERACION=cm.NUM_OPERACION AND p.CTAPAG IN (434,435,440)
JOIN dbo.MT_CTADEP d
  ON d.CODCLI=p.CODCLI AND d.CTAPAG=p.CTAPAG AND d.CTAPAGNUM=p.CTAPAGNUM
 AND d.NUM_OPERACION=p.NUM_OPERACION
JOIN dbo.MT_CTADOC b
  ON b.CODCLI=d.CODCLI AND b.CTADOC=d.CTADOC AND b.CTADOCNUM=d.CTADOCNUM AND b.CTADOC=41
WHERE cm.ANO=2027 AND cm.PERIODO=1 AND cm.USUARIO='68678'
  AND CONVERT(date,p.FECREG) <> CONVERT(date,b.FECREG)
  AND cm.FECHA >= CAST(GETDATE() AS date);  -- solo grabados del día post-patch
```

Expected: `0` (no reabre casos históricos ya remedidos si se filtra por `FECHA` del día).

- [ ] **Step 5: Commit de notas / actualizar estado del spec** (si aplica)

En el spec, marcar estado: `implementado` con fecha de apply TEST/PROD.

---

## Self-review (plan vs spec)

| Spec | Task |
|------|------|
| FECREG/FECREG_DEP Webpay → `@fecreg_caja` | Task 3–5 |
| Patch estilo OBJECT_DEFINITION | Task 3 |
| `grabado_en` + migración | Task 1 |
| Escritura API post-SP, `IS NULL` | Task 2 |
| No borrador / no backfill / no fallar HTTP | Task 2 constraints |
| Smoke OK_MISMO_DIA + grabado_en | Task 4 |
| Deploy PROD | Task 5 |
