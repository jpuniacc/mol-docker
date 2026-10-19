# Correlativo de operación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al entrar a la forma de pago, escribir el correlativo de U+ y usar ese número en Webpay, pagaré, firma y grabado.

**Architecture:** Una reserva en `mnp.rematricula_operacion` gana el derecho a escribir. Solo esa petición hace `UPDATE Valor = Valor + 1` sobre la fila vigente de `CORRELATIVO`. El número queda fijo para RUT + código de cliente + período. Webpay copia ese número en cada cobro y conserva su buy order. La firma no pide otro número si TuFirma falla. `sp_mol_grabar_plan_pagos` recibe el número ya escrito.

**Tech Stack:** Fastify no: Express + TypeScript en `uniacc-api-docker` (`node:test`, `tsx`). Vue 3 + TypeScript en `mol-docker`. Postgres esquema `mnp`. SQL Server `mssql`, procedimiento `dbo.sp_mol_grabar_plan_pagos`.

## Global Constraints

- El texto de espera es exactamente: «Estamos procesando tu operación para continuar con el pago».
- La identidad es RUT + código de cliente + período activo (`anio` y `semestre`).
- El RUT se compara sin puntos, recortado y en mayúsculas, conservando el guion del dígito verificador. El código de cliente se compara recortado.
- El `UPDATE` pega a la fila de `CORRELATIVO` de mayor `NumLinea` cuya fecha cubre hoy, en el mismo SQL Server donde se graba el plan.
- Matrícula y arancel Webpay son dos cobros, cada uno con su buy order de Transbank, y los dos guardan el mismo número de operación.
- Si TuFirma queda en `render_status: FAILED` o el enlace viene vacío, se reintenta ese documento. No se pide otro número.
- El cambio silencioso de un número ajeno exige las cuatro condiciones del spec. Si falta RUT o código de cliente en el dueño, no se consume otro correlativo y los medios no se abren.
- No se corrige el `render_status: FAILED` de TuFirma, no se cambia el formato del buy order y no se devuelve a U+ un número ya escrito.

---

### Task 1: Decidir si se usa, se escribe o se bloquea

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/operacion-rematricula.ts`
- Test: `/opt/uniacc-api-docker/src/services/operacion-rematricula.test.ts`
- Modify: `/opt/uniacc-api-docker/src/services/correlativo-operacion.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `normalizarRutOperacion(rut: string): string`
  - `decidirOperacion(input: { propia: { numOperacion: string | null } | null; sesion: { num: string; rut: string; codcli: string } | null; rut: string; codcli: string }): { tipo: 'usar'; numOperacion: string } | { tipo: 'escribir' } | { tipo: 'bloquear' }`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decidirOperacion, normalizarRutOperacion } from './operacion-rematricula'

describe('decidirOperacion', () => {
  it('normaliza el RUT conservando el guion', () => {
    assert.equal(normalizarRutOperacion(' 15.608.279-1 '), '15608279-1')
  })

  it('devuelve el número propio sin escribir', () => {
    assert.deepEqual(
      decidirOperacion({
        propia: { numOperacion: '981380' },
        sesion: null,
        rut: '15.608.279-1',
        codcli: ' 20251PSIC1VR015 ',
      }),
      { tipo: 'usar', numOperacion: '981380' },
    )
  })

  it('escribe cuando el alumno no tiene número', () => {
    assert.deepEqual(
      decidirOperacion({
        propia: null,
        sesion: null,
        rut: '21055227-8',
        codcli: '20241BIBL1AR023',
      }),
      { tipo: 'escribir' },
    )
  })

  it('cambia en silencio si el dueño de la sesión es otro alumno completo', () => {
    assert.deepEqual(
      decidirOperacion({
        propia: null,
        sesion: { num: '981377', rut: '15608279-1', codcli: '20251PSIC1VR015' },
        rut: '21055227-8',
        codcli: '20241BIBL1AR023',
      }),
      { tipo: 'escribir' },
    )
  })

  it('bloquea si al dueño de la sesión le falta RUT o código de cliente', () => {
    assert.deepEqual(
      decidirOperacion({
        propia: null,
        sesion: { num: '981377', rut: '', codcli: '20251PSIC1VR015' },
        rut: '21055227-8',
        codcli: '20241BIBL1AR023',
      }),
      { tipo: 'bloquear' },
    )
  })

  it('usa el propio aunque la sesión traiga otro número', () => {
    assert.deepEqual(
      decidirOperacion({
        propia: { numOperacion: '981382' },
        sesion: { num: '981377', rut: '15608279-1', codcli: '20251PSIC1VR015' },
        rut: '21055227-8',
        codcli: '20241BIBL1AR023',
      }),
      { tipo: 'usar', numOperacion: '981382' },
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/uniacc-api-docker && npm test -- src/services/operacion-rematricula.test.ts`

Expected: FAIL, cannot find module `./operacion-rematricula`

- [ ] **Step 3: Write minimal implementation**

```ts
export function normalizarRutOperacion(rut: string): string {
  return rut.replace(/\./g, '').trim().toUpperCase()
}

export type DecisionOperacion =
  | { tipo: 'usar'; numOperacion: string }
  | { tipo: 'escribir' }
  | { tipo: 'bloquear' }

export function decidirOperacion(input: {
  propia: { numOperacion: string | null } | null
  sesion: { num: string; rut: string; codcli: string } | null
  rut: string
  codcli: string
}): DecisionOperacion {
  const propia = input.propia?.numOperacion?.trim() ?? ''
  if (/^\d+$/.test(propia)) return { tipo: 'usar', numOperacion: propia }
  const sesion = input.sesion
  if (sesion) {
    const rut = normalizarRutOperacion(sesion.rut)
    const codcli = sesion.codcli.trim()
    if (!rut || !codcli) return { tipo: 'bloquear' }
    const mismo =
      rut === normalizarRutOperacion(input.rut) && codcli === input.codcli.trim()
    if (!mismo) return { tipo: 'escribir' }
  }
  return { tipo: 'escribir' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/uniacc-api-docker && npm test -- src/services/operacion-rematricula.test.ts`

Expected: PASS, 6 tests

- [ ] **Step 5: Retire the peek assignment tests**

Delete the cases in `correlativo-operacion.test.ts` that expect a peek to be returned or incremented in memory. Leave the file only if another export is still imported. If `asignarNumeroOperacion` has no remaining caller after Task 4, delete `correlativo-operacion.ts` and its test in that later task. Do not do it in this task.

- [ ] **Step 6: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/operacion-rematricula.ts src/services/operacion-rematricula.test.ts
git commit -m "$(cat <<'EOF'
feat: decidir si el número de operación se usa, se escribe o se bloquea

EOF
)"
```

### Task 2: Reserva en Postgres y escritura en U+

**Files:**
- Create: `/opt/uniacc-api-docker/src/migrations/009_rematricula_operacion.sql`
- Create: `/opt/uniacc-api-docker/src/services/operacion-rematricula-store.ts`
- Test: `/opt/uniacc-api-docker/src/services/operacion-rematricula-store.test.ts`

**Interfaces:**
- Consumes: `decidirOperacion` from Task 1
- Produces:
  - `SQL_CONSUMIR_CORRELATIVO` string
  - `obtenerNumeroOperacion(input, deps): Promise<{ ok: true; numOperacion: string } | { ok: false; code: 'identidad-incompleta' | 'reserva-en-curso' | 'u-plus-no-escribio' }>`
  - `deps.consumirCorrelativo(): Promise<string>` serializes callers. The SQL text is `SQL_CONSUMIR_CORRELATIVO`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SQL_CONSUMIR_CORRELATIVO, obtenerNumeroOperacion } from './operacion-rematricula-store'

type Fila = { rut: string; codcli: string; anio: number; semestre: number; num: string | null; lock: Promise<void> | null }

function memoria() {
  const filas: Fila[] = []
  let valor = 981379
  let cadena = Promise.resolve()
  return {
    filas,
    async consumirCorrelativo() {
      const turno = cadena.then(async () => {
        valor += 1
        return String(valor)
      })
      cadena = turno.then(() => undefined)
      return turno
    },
    async leer(rut: string, codcli: string, anio: number, semestre: number) {
      return filas.find((f) => f.rut === rut && f.codcli === codcli && f.anio === anio && f.semestre === semestre) ?? null
    },
    async reservar(fila: Omit<Fila, 'lock'>) {
      const existe = filas.find((f) => f.rut === fila.rut && f.codcli === fila.codcli && f.anio === fila.anio && f.semestre === fila.semestre)
      if (existe) return false
      filas.push({ ...fila, lock: null })
      return true
    },
    async guardar(rut: string, codcli: string, anio: number, semestre: number, num: string) {
      const fila = filas.find((f) => f.rut === rut && f.codcli === codcli && f.anio === anio && f.semestre === semestre)
      if (!fila) return false
      fila.num = num
      return true
    },
  }
}

describe('obtenerNumeroOperacion', () => {
  it('el SQL incrementa la fila vigente y devuelve el valor nuevo', () => {
    assert.match(SQL_CONSUMIR_CORRELATIVO, /UPDATE dbo\.MT_PARAME_DET/)
    assert.match(SQL_CONSUMIR_CORRELATIVO, /SET Valor = CONVERT\(varchar\(30\), CONVERT\(bigint, Valor\) \+ 1\)/)
    assert.match(SQL_CONSUMIR_CORRELATIVO, /OUTPUT INSERTED\.Valor/)
    assert.match(SQL_CONSUMIR_CORRELATIVO, /ORDER BY NumLinea DESC/)
  })

  it('treinta alumnos seguidos reciben treinta números', async () => {
    const db = memoria()
    const deps = {
      consumirCorrelativo: db.consumirCorrelativo,
      buscarPropia: async (rut: string, codcli: string) => {
        const fila = await db.leer(rut, codcli, 2027, 1)
        return fila ? { numOperacion: fila.num } : null
      },
      buscarDueno: async () => null,
      reservar: (rut: string, codcli: string) => db.reservar({ rut, codcli, anio: 2027, semestre: 1, num: null }),
      guardarNumero: (rut: string, codcli: string, num: string) => db.guardar(rut, codcli, 2027, 1, num),
    }
    const respuestas = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        obtenerNumeroOperacion(
          { rut: `1000000${i}-1`, codcli: `CLI${i}`, anio: 2027, semestre: 1, sesion: null },
          deps,
        ),
      ),
    )
    const nums = respuestas.map((r) => (r.ok ? r.numOperacion : 'fallo'))
    assert.deepEqual(nums, Array.from({ length: 30 }, (_, i) => String(981380 + i)))
  })

  it('la segunda entrada del mismo alumno no escribe', async () => {
    const db = memoria()
    let escrituras = 0
    const consumir = db.consumirCorrelativo.bind(db)
    const deps = {
      consumirCorrelativo: async () => {
        escrituras += 1
        return consumir()
      },
      buscarPropia: async (rut: string, codcli: string) => {
        const fila = await db.leer(rut, codcli, 2027, 1)
        return fila ? { numOperacion: fila.num } : null
      },
      buscarDueno: async () => null,
      reservar: (rut: string, codcli: string) => db.reservar({ rut, codcli, anio: 2027, semestre: 1, num: null }),
      guardarNumero: (rut: string, codcli: string, num: string) => db.guardar(rut, codcli, 2027, 1, num),
    }
    const input = { rut: '21055227-8', codcli: '20241BIBL1AR023', anio: 2027, semestre: 1, sesion: null }
    const primera = await obtenerNumeroOperacion(input, deps)
    const segunda = await obtenerNumeroOperacion(input, deps)
    assert.equal(primera.ok && segunda.ok && primera.numOperacion === segunda.numOperacion, true)
    assert.equal(escrituras, 1)
  })

  it('dos pestañas del mismo alumno dejan un solo número', async () => {
    const db = memoria()
    const deps = {
      consumirCorrelativo: db.consumirCorrelativo,
      buscarPropia: async (rut: string, codcli: string) => {
        const fila = await db.leer(rut, codcli, 2027, 1)
        return fila ? { numOperacion: fila.num } : null
      },
      buscarDueno: async () => null,
      reservar: (rut: string, codcli: string) => db.reservar({ rut, codcli, anio: 2027, semestre: 1, num: null }),
      guardarNumero: (rut: string, codcli: string, num: string) => db.guardar(rut, codcli, 2027, 1, num),
    }
    const input = { rut: '21055227-8', codcli: '20241BIBL1AR023', anio: 2027, semestre: 1, sesion: null }
    const [a, b] = await Promise.all([
      obtenerNumeroOperacion(input, deps),
      obtenerNumeroOperacion(input, deps),
    ])
    const ok = [a, b].filter((r) => r.ok)
    assert.equal(ok.length >= 1, true)
    if (a.ok && b.ok) assert.equal(a.numOperacion, b.numOperacion)
    assert.equal(db.filas.filter((f) => f.num).length, 1)
  })

  it('bloquea un dueño incompleto y no llama a U+', async () => {
    let escrituras = 0
    const resultado = await obtenerNumeroOperacion(
      {
        rut: '21055227-8',
        codcli: '20241BIBL1AR023',
        anio: 2027,
        semestre: 1,
        sesion: { num: '981377', rut: '', codcli: '20251PSIC1VR015' },
      },
      {
        consumirCorrelativo: async () => {
          escrituras += 1
          return '981380'
        },
        buscarPropia: async () => null,
        buscarDueno: async () => ({ num: '981377', rut: '', codcli: '20251PSIC1VR015' }),
        reservar: async () => true,
        guardarNumero: async () => true,
      },
    )
    assert.deepEqual(resultado, { ok: false, code: 'identidad-incompleta' })
    assert.equal(escrituras, 0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/uniacc-api-docker && npm test -- src/services/operacion-rematricula-store.test.ts`

Expected: FAIL, cannot find module `./operacion-rematricula-store`

- [ ] **Step 3: Write the migration**

```sql
-- psql -U postgres -d <POSTGRES_DB> -f src/migrations/009_rematricula_operacion.sql

CREATE TABLE IF NOT EXISTS mnp.rematricula_operacion (
    id BIGSERIAL PRIMARY KEY,
    rut TEXT NOT NULL,
    codcli TEXT NOT NULL,
    anio_periodo INTEGER NOT NULL,
    semestre_periodo INTEGER NOT NULL,
    num_operacion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rematricula_operacion_identidad UNIQUE (rut, codcli, anio_periodo, semestre_periodo),
    CONSTRAINT rematricula_operacion_num_unico UNIQUE (num_operacion)
);
```

Apply it on the Postgres that the API uses for `mnp` before the endpoint is exercised.

- [ ] **Step 4: Write minimal implementation**

`SQL_CONSUMIR_CORRELATIVO` updates only the current row:

```sql
UPDATE dbo.MT_PARAME_DET
SET Valor = CONVERT(varchar(30), CONVERT(bigint, Valor) + 1)
OUTPUT INSERTED.Valor
WHERE IdParametro = 'CORRELATIVO'
  AND NumLinea = (
    SELECT TOP (1) NumLinea
    FROM dbo.MT_PARAME_DET
    WHERE IdParametro = 'CORRELATIVO'
      AND CONVERT(date, GETDATE()) BETWEEN CONVERT(date, FechaInicio) AND CONVERT(date, FechaTermino)
    ORDER BY NumLinea DESC
  );
```

`obtenerNumeroOperacion` calls `decidirOperacion`. On `usar`, return that number. On `bloquear`, return `{ ok: false, code: 'identidad-incompleta' }` and do not call `consumirCorrelativo`. On `escribir`:

1. `reservar`. If it returns false, `buscarPropia`. If that row has a number, return it. If the row exists and the number is null, return `{ ok: false, code: 'reserva-en-curso' }`.
2. If `reservar` returns true, call `consumirCorrelativo` and then `guardarNumero`.
3. If `guardarNumero` returns false after U+ wrote, leave that number consumed. The next call of the same student finds the empty reservation from the failed save only when `reservar` was true and the save failed: call `consumirCorrelativo` again and save the next value. Do not roll back U+.

Normalize `rut` with `normalizarRutOperacion` and `codcli` with `trim` before every lookup and insert.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /opt/uniacc-api-docker && npm test -- src/services/operacion-rematricula-store.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/migrations/009_rematricula_operacion.sql src/services/operacion-rematricula-store.ts src/services/operacion-rematricula-store.test.ts
git commit -m "$(cat <<'EOF'
feat: reservar y escribir el correlativo de operación por alumno

EOF
)"
```

### Task 3: Endpoint al entrar a la forma de pago

**Files:**
- Modify: `/opt/uniacc-api-docker/src/controllers/rematricula-alumno-contrato-firma.controller.ts`
- Modify: `/opt/uniacc-api-docker/src/services/correlativo-operacion.ts` (delete if unused)
- Modify: `/opt/uniacc-api-docker/src/services/correlativo-operacion.test.ts` (delete with the service)

**Interfaces:**
- Consumes: `obtenerNumeroOperacion`
- Produces: `POST /api/rematricula/alumno/contrato/firma/correlativo`
  - Body: `{ rut, codcli, anio, semestre, sesionNum? }`
  - `200 { ok: true, numOperacion }`
  - `409 { ok: false, code: 'identidad-incompleta' }`
  - `503 { ok: false, code: 'reserva-en-curso' | 'u-plus-no-escribio' }`

- [ ] **Step 1: Replace `correlativoOperacionHttp`**

Stop reading `peek` and `actualEnError`. Read `rut`, `codcli`, `anio`, `semestre` and optional `sesionNum`. Resolve the session owner from `mnp.rematricula_operacion` first and, if absent, from `mnp.rematricula_contrato_tufirma`. Pass that owner to `obtenerNumeroOperacion`. Wire `consumirCorrelativo` to a SQL Server transaction on the same pool `grabar-plan-pagos` uses for test: begin, run `SQL_CONSUMIR_CORRELATIVO`, commit, return `OUTPUT`. Roll back and return `u-plus-no-escribio` when the statement affects zero rows.

- [ ] **Step 2: Run the service tests**

Run: `cd /opt/uniacc-api-docker && npm test -- src/services/operacion-rematricula.test.ts src/services/operacion-rematricula-store.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/controllers/rematricula-alumno-contrato-firma.controller.ts src/services
git commit -m "$(cat <<'EOF'
feat: entregar el número de operación al entrar a la forma de pago

EOF
)"
```

### Task 4: Webpay guarda el número y rechaza el cobro sin él

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.service.ts`
- Modify: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.repo.ts`
- Test: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.service.test.ts`

**Interfaces:**
- Consumes: the student's `numOperacion` already stored by Task 2
- Produces: `FilaWebpay.numOperacion: string`. `crearCobroWebpay` returns `{ ok: false, error: 'sin-numero-operacion' }` when that value is missing. Buy order still comes from `armarBuyOrder`.

- [ ] **Step 1: Write the failing test**

Add to `webpay-plus.service.test.ts`:

```ts
it('rechaza el cobro cuando no hay número de operación', async () => {
  const resultado = await crearCobroWebpay(
    { ...inputBase, numOperacion: '' },
    depsBase,
  )
  assert.deepEqual(resultado, { ok: false, error: 'sin-numero-operacion' })
})

it('guarda el mismo número en matrícula y arancel con buy orders distintos', async () => {
  const repo = repoMemoria()
  const matricula = await crearCobroWebpay({ ...inputBase, concepto: 'matricula', numOperacion: '981380' }, { ...depsBase, repo })
  const arancel = await crearCobroWebpay({ ...inputBase, concepto: 'arancel', numOperacion: '981380' }, { ...depsBase, repo })
  assert.equal(matricula.ok && arancel.ok, true)
  if (!matricula.ok || !arancel.ok) return
  assert.notEqual(matricula.buyOrder, arancel.buyOrder)
  assert.equal(repo.filas[0].numOperacion, '981380')
  assert.equal(repo.filas[1].numOperacion, '981380')
})
```

Use the existing `inputBase` and `depsBase` names already in that test file. Add `numOperacion` to the in-memory row.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/uniacc-api-docker && npm test -- src/services/webpay-plus/webpay-plus.service.test.ts`

Expected: FAIL because `numOperacion` is not on the row

- [ ] **Step 3: Write minimal implementation**

Add nullable-in-type but required-at-create `numOperacion: string` to `FilaWebpay`. At the start of `crearCobroWebpay`, if `!/^\d+$/.test(input.numOperacion)`, return `{ ok: false, error: 'sin-numero-operacion' }`. Pass it through `insertarCreada`. Add column `num_operacion TEXT` to the insert and to `COLUMNAS` in the repo. Create the column on the live table:

```sql
ALTER TABLE mnp.mnp_webpay_transaccion ADD COLUMN IF NOT EXISTS num_operacion TEXT;
```

If the live table name differs, use the name already queried by `webpay-plus.repo.ts`. Do not change `armarBuyOrder`.

The crear HTTP handler looks up `mnp.rematricula_operacion` for the student and period and passes that `num_operacion` into `crearCobroWebpay`. It does not trust a number sent only by the browser.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/uniacc-api-docker && npm test -- src/services/webpay-plus/webpay-plus.service.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/webpay-plus src/migrations
git commit -m "$(cat <<'EOF'
feat: guardar el número de operación en cada cobro Webpay

EOF
)"
```

### Task 5: La forma de pago espera el número

**Files:**
- Modify: `/opt/mol-docker/src/services/contratoFirmaApi.ts`
- Modify: `/opt/mol-docker/src/views/matricula-alumno/FormaPagoAlumnoView.vue`

**Interfaces:**
- Consumes: `POST .../correlativo` from Task 3
- Produces: `pedirNumeroOperacion({ rut, codcli, anio, semestre, sesionNum })`

- [ ] **Step 1: Change the client**

Replace `pedirCorrelativoOperacion` so the body is `{ rut, codcli, anio, semestre, sesionNum }`. Map `409` with `code: 'identidad-incompleta'` to `{ ok: false, code: 'identidad-incompleta' }`. Map `503` to `{ ok: false, code: 'reintentar' }`.

- [ ] **Step 2: Block the payment screen**

In `FormaPagoAlumnoView.vue`, add `operacionLista = ref(false)`. On `onMounted`, after the periodo and the student rut/codcli exist, call `pedirNumeroOperacion`. While `operacionLista` is false, render only the sentence `Estamos procesando tu operación para continuar con el pago` and hide the payment methods. On `{ ok: true }`, store the number with `alumnoCtx.setPagoMatricula` or `setNumOperacionCuenta`, set `operacionLista` true. On `identidad-incompleta`, leave `operacionLista` false and do not call `mostrarErrorRematricula`. On `reintentar`, keep the same sentence and show a button that calls the same request again.

- [ ] **Step 3: Stop using the peek when confirming the pagaré**

In `confirmarPagareMatricula`, set `numOperacion` from the value stored in step 2. Remove the assignment from `correlativoPreview`.

- [ ] **Step 4: Verify in the browser**

Open the alumno forma de pago. Before the response, the only copy is the agreed sentence. After the response, the payment methods are visible and the stored number is the one returned by the API.

- [ ] **Step 5: Commit**

```bash
cd /opt/mol-docker
git add src/services/contratoFirmaApi.ts src/views/matricula-alumno/FormaPagoAlumnoView.vue
git commit -m "$(cat <<'EOF'
feat: pedir el número de operación antes de mostrar los medios de pago

EOF
)"
```

### Task 6: La firma no pide otro número

**Files:**
- Modify: `/opt/mol-docker/src/views/matricula-alumno/FirmaAlumnoView.vue`

**Interfaces:**
- Consumes: `pagoMatricula.numOperacion` written in Task 5
- Produces: no call to `pedirNumeroOperacion` when the signature link is missing

- [ ] **Step 1: Remove the replacement on TuFirma failure**

Delete the `reemplazarCorrelativo(true)` call that runs when the link error contains `enlace de firma pendiente`. Keep `mostrarErrorRematricula` so the existing modal «El enlace se quedó en el sobre» still appears. A retry calls `getEnlaceFirmaFirmante` again with the same `numOperacion`.

Delete `reemplazarCorrelativo(false)` on the identity 409 path inside the firma view. The silent swap already happened in forma de pago. If firma is opened with a foreign number, navigate back to forma de pago instead of allocating another number here.

- [ ] **Step 2: Verify the call sites**

Run: `rg -n "actualEnError|reemplazarCorrelativo" /opt/mol-docker/src`

Expected: no remaining call with `actualEnError: true`

- [ ] **Step 3: Commit**

```bash
cd /opt/mol-docker
git add src/views/matricula-alumno/FirmaAlumnoView.vue
git commit -m "$(cat <<'EOF'
fix: conservar el número de operación cuando TuFirma no entrega enlace

EOF
)"
```

### Task 7: El grabado usa el número ya escrito

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.ts`
- Test: `/opt/uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.test.ts` (create if absent)

**Interfaces:**
- Consumes: `numOperacion` from `mnp.rematricula_operacion` for `codcli + ano + periodo`
- Produces: `request.input('num_operacion_asignado', sql.Decimal(20, 0), asignado)` before `execute`. After `execute`, throw `GrabarPlanPagosError` with status 502 when `String(result.output.num_operacion)` is not the assigned value.

- [ ] **Step 1: Write the failing test with a fake pool**

The fake records `request.input` calls and `execute` returns `{ output: { num_operacion: asignado } }`. Assert the input `num_operacion_asignado` equals the stored operation. A second fake that returns a different output asserts the 502.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/uniacc-api-docker && npm test -- src/services/grabar-plan-pagos-erp.service.test.ts`

Expected: FAIL because the input is not sent

- [ ] **Step 3: Pass the number from the service**

Before building the request, load `num_operacion` from `mnp.rematricula_operacion` for the academic client, year and semester. If it is missing, throw `GrabarPlanPagosError` 422 with message `No hay número de operación reservado`. Add the input above. Compare the output to that value.

- [ ] **Step 4: Stop the procedure from incrementing**

On the test SQL Server, read the body:

```sql
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.sp_mol_grabar_plan_pagos'));
```

Add parameter `@num_operacion_asignado DECIMAL(20, 0)`. Use that value as the account `NUM_OPERACION` and as the procedure output. Remove the statement that updates `MT_PARAME_DET` for `IdParametro = 'CORRELATIVO'` inside this procedure. Keep every other insert. Deploy that alteration only on the ambiente the service already calls (`test`).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /opt/uniacc-api-docker && npm test -- src/services/grabar-plan-pagos-erp.service.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/grabar-plan-pagos-erp.service.ts src/services/grabar-plan-pagos-erp.service.test.ts
git commit -m "$(cat <<'EOF'
feat: grabar la cuenta con el número de operación ya escrito

EOF
)"
```

The SQL Server procedure change is applied on the server; it is not a git commit unless a reviewed script is saved beside the service.
