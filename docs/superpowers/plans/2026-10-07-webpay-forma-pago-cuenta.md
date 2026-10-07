# Webpay en forma de pago, contrato y cuenta corriente — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El alumno elige primero la matrícula, sale a Webpay con un aviso de 3 segundos, y al firmar la cuenta corriente y el contrato quedan como en el diseño del 2026-10-07.

**Architecture:** La confirmación de Transbank sigue en `mnp_webpay_transaccion`, con las cuotas y el JSON de la respuesta. Un módulo puro arma los documentos de tarjeta y el 5 % del arancel. El SP de U+ los inserta en la misma transacción del plan. El resultado del intento se inserta en `log_mol_intento` y un trigger lo copia a `log_mol_evento`. El diálogo y el contrato leen el medio de cada concepto.

**Tech Stack:** Vue 3 + Vitest (`vitest.unit.config.ts`) en `mol-docker`. Express + TypeScript + `node:test` en `uniacc-api-docker`. Postgres de Supabase. SQL Server U+ Test, procedimiento `dbo.sp_mol_grabar_plan_pagos`.

**Spec:** `docs/superpowers/specs/2026-10-07-webpay-forma-pago-cuenta-design.md`

## Global Constraints

- Rematrícula del alumno. El mock de forma de pago no cambia.
- La grabación en U+ ocurre al firmar, en una sola transacción. Si una fila falla, no queda nada escrito. El ambiente activo tiene que ser test, como hoy.
- El API inserta `log_mol_intento` y no llama a `registrar_log_mol_evento` para este tema. El trigger copia la fila. Si la copia falla, el intento permanece. Si el insert del intento falla, U+ no se deshace.
- Tema `cuenta`, acción `grabar`, resultado `ok` o `error`. Sin número de tarjeta ni llave de Transbank.
- Arancel apagado hasta que la matrícula sea pagaré o ya esté autorizada en Webpay. Botón apagado: `opacity-50 cursor-not-allowed`.
- Aviso exacto: «Vas a salir de MOL hacia el sitio seguro de Webpay. Al terminar, volverás a la rematrícula.» Contador de 3 segundos. Cancelar y la X vuelven a las opciones. La misma pestaña hace el POST. Sin texto de ventanas emergentes.
- Abortada: «El pago con Webpay se canceló. Debes seleccionar la opción de pago.»
- Rechazada: «El pago con Webpay fue rechazado. Debes seleccionar la opción de pago.»
- Boleta 41 por el bruto. CAE (`CODBEN` 4) no baja el saldo del alumno ni la base del 5 %.
- El 5 % es solo arancel Webpay, pago tipo 20, saldo 0, estado 1, sin fila en `MT_POSBEN`. `Math.round(saldo * 0.05)`. La tarjeta paga el saldo menos ese descuento.
- Débito `VD` y prepago `VP`: pago 435 y cargo 810, folio autorización + `01`, fecha de la transacción.
- Crédito `VN`, `VC`, `SI`, `S2`, `NC`. Cuotas 0, 1 o ausentes: pago 434 y cargo 809, cuota 1 de 1, folio autorización + `01`.
- Crédito con 2 o más cuotas: un 434 por el monto de la tarjeta, folio + `01`, aplicado a la boleta. Calendario 440 y 811, folios + `01` … + `N`, fecha de registro = fecha de la transacción, vencimiento el mismo día del mes siguiente o el último día si ese mes no lo tiene. Partes iguales, la última absorbe el resto. El 440 no se aplica a la boleta. El 434 y el 440 de la cuota 1 comparten folio y se distinguen por el tipo.
- El pagaré sigue en tipo 5 y cuotas 14. No lleva 434, 435, 809, 810 ni 811.
- El contrato muestra el bruto. «Pagado con Webpay» no lista el calendario 440. El mandato de pagaré entra solo si hay al menos un pagaré. Los dos Webpay igual producen contrato.
- No se eligen las cuotas dentro de MOL. No se reescriben operaciones ya grabadas.

---

### Task 1: Guardar cuotas y respuesta de Transbank

**Files:**
- Create: `supabase/migrations/20261007130000_webpay_cuotas_respuesta.sql`
- Modify: `/opt/uniacc-api-docker/src/services/webpay-plus/transbank-client.ts`
- Modify: `/opt/uniacc-api-docker/src/services/webpay-plus/transbank-client.test.ts`
- Modify: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.service.ts`
- Modify: `/opt/uniacc-api-docker/src/services/webpay-plus/webpay-plus.repo.ts`
- Test: `/opt/uniacc-api-docker/src/services/webpay-plus/transbank-client.test.ts`

**Interfaces:**
- Consumes: `mapCommit` y `CommitWebpay` actuales.
- Produces: `CommitWebpay.installmentsNumber: number | null` y `CommitWebpay.respuesta: Record<string, unknown>`. `FilaWebpay` gana `installmentsNumber: number | null`.

- [ ] **Step 1: Write the failing test**

En `transbank-client.test.ts`, dentro de `describe('crearClienteTransbank')`:

```ts
it('guarda las cuotas y el cuerpo de la confirmación', async () => {
  const cuerpo = {
    amount: 50000,
    status: 'AUTHORIZED',
    buy_order: '123456782027-1-15',
    session_id: '12345678-2027-1-matricula-15',
    authorization_code: '1213',
    payment_type_code: 'VC',
    response_code: 0,
    card_detail: { card_number: '6623' },
    transaction_date: '2019-05-22T16:41:21.063Z',
    installments_number: 10,
    vci: 'TSY',
    accounting_date: '0522',
  }
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify(cuerpo), { status: 200 })
  const cliente = crearClienteTransbank({
    host: 'https://webpay3gint.transbank.cl',
    commerceCode: '597055555532',
    apiKey: 'llave-prueba',
    fetchImpl,
  })
  const commit = await cliente.confirmar('tok')
  assert.equal(commit.installmentsNumber, 10)
  assert.equal(commit.respuesta.vci, 'TSY')
  assert.equal(commit.respuesta.accounting_date, '0522')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `/opt/uniacc-api-docker`: `npx tsx --test src/services/webpay-plus/transbank-client.test.ts`

Expected: FAIL because `installmentsNumber` is undefined.

- [ ] **Step 3: Write minimal implementation**

En `CommitWebpay` agregar:

```ts
installmentsNumber: number | null
respuesta: Record<string, unknown>
```

En `mapCommit`:

```ts
installmentsNumber:
  body.installments_number == null || body.installments_number === ''
    ? null
    : Number(body.installments_number),
respuesta: body,
```

Migración:

```sql
ALTER TABLE public.mnp_webpay_transaccion
  ADD COLUMN IF NOT EXISTS installments_number integer,
  ADD COLUMN IF NOT EXISTS respuesta jsonb;
```

En `FilaWebpay` y `FilaDb` agregar `installmentsNumber` / `installments_number`. Incluir la columna en `COLUMNAS` y en el `UPDATE` de `guardarCierre`:

```sql
installments_number=$8,
respuesta=$9::jsonb,
```

Pasar `commit?.installmentsNumber ?? null` y `commit ? JSON.stringify(commit.respuesta) : null`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/services/webpay-plus/transbank-client.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261007130000_webpay_cuotas_respuesta.sql
git commit -m "feat(rematricula): guardar las cuotas y la respuesta de Transbank"
```

El commit de `uniacc-api-docker` va en ese repo, con los archivos del cliente y del repo. Aplicar la migración en la base de Supabase del entorno de desarrollo antes de probar un pago real.

---

### Task 2: Intento genérico y trigger al log

**Files:**
- Create: `supabase/migrations/20261007131000_log_mol_intento.sql`
- Test: el mismo archivo SQL, verificado con un insert de prueba que se borra al final del paso manual.

**Interfaces:**
- Consumes: `public.registrar_log_mol_evento`.
- Produces: tabla `public.log_mol_intento` e insert que dispara el log. Columnas: `id uuid`, `creado_en timestamptz`, `tema text`, `accion text`, `resultado text`, `mensaje text`, `payload jsonb`, `rut_alumno text`, `codcli text`, `anio_periodo integer`, `semestre_periodo integer`, `periodo_label text`.

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE IF NOT EXISTS public.log_mol_intento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creado_en timestamptz NOT NULL DEFAULT now(),
  tema text NOT NULL,
  accion text NOT NULL,
  resultado text NOT NULL,
  mensaje text,
  payload jsonb,
  rut_alumno text,
  codcli text,
  anio_periodo integer,
  semestre_periodo integer,
  periodo_label text,
  CONSTRAINT log_mol_intento_resultado_chk CHECK (resultado IN ('ok', 'error'))
);

ALTER TABLE public.log_mol_intento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_mol_intento_no_anon ON public.log_mol_intento;
CREATE POLICY log_mol_intento_no_anon ON public.log_mol_intento
  FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS log_mol_intento_no_auth ON public.log_mol_intento;
CREATE POLICY log_mol_intento_no_auth ON public.log_mol_intento
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT SELECT, INSERT ON public.log_mol_intento TO service_role;

CREATE OR REPLACE FUNCTION public.log_mol_intento_a_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.registrar_log_mol_evento(
      p_categoria => NEW.tema,
      p_accion => NEW.accion,
      p_origen_tabla => 'log_mol_intento',
      p_origen_id => NEW.id,
      p_payload => jsonb_build_object(
        'resultado', NEW.resultado,
        'mensaje', NEW.mensaje
      ) || coalesce(NEW.payload, '{}'::jsonb),
      p_rut_alumno => NEW.rut_alumno,
      p_codcli => NEW.codcli,
      p_anio_periodo => NEW.anio_periodo,
      p_semestre_periodo => NEW.semestre_periodo,
      p_periodo_label => NEW.periodo_label
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'log_mol_intento no copió a log_mol_evento: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_mol_intento_a_evento ON public.log_mol_intento;
CREATE TRIGGER trg_log_mol_intento_a_evento
  AFTER INSERT ON public.log_mol_intento
  FOR EACH ROW
  EXECUTE FUNCTION public.log_mol_intento_a_evento();
```

- [ ] **Step 2: Apply and check the copy**

Aplicar la migración en Supabase. Insertar una fila de prueba con `tema = 'cuenta'`, `accion = 'grabar'`, `resultado = 'error'`, `mensaje = 'prueba'`. Confirmar que `log_mol_evento` tiene `origen_tabla = 'log_mol_intento'` y el mismo `origen_id`. Borrar las dos filas de prueba.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261007131000_log_mol_intento.sql
git commit -m "feat(rematricula): registrar cada intento y copiarlo al log"
```

---

### Task 3: Armar los documentos de tarjeta y el 5 %

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/documentos-webpay-cuenta.ts`
- Create: `/opt/uniacc-api-docker/src/services/documentos-webpay-cuenta.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores. El llamador ya excluyó el CAE del saldo.
- Produces:

```ts
export type DocumentoCuenta = {
  concepto: 'matricula' | 'arancel'
  ctapag: number | null
  ctadoc: number | null
  folio: string | null
  monto: number
  fecha: string
  fecven: string
  cuota: number
  numcuot: number
  aplicaBoleta: boolean
}

export function armarDocumentosWebpay(input: {
  concepto: 'matricula' | 'arancel'
  paymentTypeCode: string
  installmentsNumber: number | null
  autorizacion: string
  fecha: string
  saldoTrasBeneficios: number
}): DocumentoCuenta[]
```

`folio` null significa que el SP pide `CORRPAGNUM` (el tipo 20). El folio de tarjeta es la autorización más la cuota en dos dígitos.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { armarDocumentosWebpay } from './documentos-webpay-cuenta'

describe('armarDocumentosWebpay', () => {
  it('el crédito de Felipe reparte el 5 % después de la beca y deja diez cuotas', () => {
    const docs = armarDocumentosWebpay({
      concepto: 'arancel',
      paymentTypeCode: 'VC',
      installmentsNumber: 10,
      autorizacion: '48825',
      fecha: '2025-12-04',
      saldoTrasBeneficios: 2_667_000,
    })
    const tipo20 = docs.find((d) => d.ctapag === 20)
    const pago434 = docs.find((d) => d.ctapag === 434)
    const cuotas440 = docs.filter((d) => d.ctapag === 440)
    const cargos811 = docs.filter((d) => d.ctadoc === 811)
    assert.equal(tipo20?.monto, 133_350)
    assert.equal(tipo20?.folio, null)
    assert.equal(tipo20?.aplicaBoleta, true)
    assert.equal(pago434?.monto, 2_533_650)
    assert.equal(pago434?.folio, '4882501')
    assert.equal(pago434?.aplicaBoleta, true)
    assert.equal(cuotas440.length, 10)
    assert.equal(cargos811.length, 10)
    assert.equal(cuotas440.reduce((s, d) => s + d.monto, 0), 2_533_650)
    assert.equal(cuotas440[0].folio, '4882501')
    assert.equal(cuotas440[0].aplicaBoleta, false)
    assert.equal(cuotas440[0].fecven, '2025-12-04')
    assert.equal(cuotas440[1].fecven, '2026-01-04')
    assert.equal(cuotas440[9].folio, '4882510')
    assert.equal(cuotas440.every((d) => d.fecha === '2025-12-04'), true)
    assert.equal(docs.some((d) => d.ctadoc === 809), false)
  })

  it('el débito de Catalina es un 435, un 810 y el 5 %', () => {
    const docs = armarDocumentosWebpay({
      concepto: 'arancel',
      paymentTypeCode: 'VD',
      installmentsNumber: 0,
      autorizacion: '331436',
      fecha: '2025-11-14',
      saldoTrasBeneficios: 2_640_000,
    })
    assert.deepEqual(
      docs.map((d) => [d.ctapag, d.ctadoc, d.monto, d.folio]),
      [
        [20, null, 132_000, null],
        [435, null, 2_508_000, '33143601'],
        [null, 810, 2_508_000, '33143601'],
      ],
    )
  })

  it('la matrícula con crédito de una cuota no lleva 5 % ni calendario', () => {
    const docs = armarDocumentosWebpay({
      concepto: 'matricula',
      paymentTypeCode: 'VN',
      installmentsNumber: 0,
      autorizacion: '48825',
      fecha: '2025-12-01',
      saldoTrasBeneficios: 200_000,
    })
    assert.equal(docs.some((d) => d.ctapag === 20), false)
    assert.equal(docs.find((d) => d.ctapag === 434)?.monto, 200_000)
    assert.equal(docs.find((d) => d.ctadoc === 809)?.cuota, 1)
    assert.equal(docs.find((d) => d.ctadoc === 809)?.numcuot, 1)
  })

  it('un día 31 cae al último día del mes siguiente', () => {
    const docs = armarDocumentosWebpay({
      concepto: 'matricula',
      paymentTypeCode: 'VC',
      installmentsNumber: 2,
      autorizacion: '100',
      fecha: '2026-01-31',
      saldoTrasBeneficios: 100,
    })
    const cuotas = docs.filter((d) => d.ctapag === 440)
    assert.equal(cuotas[1].fecven, '2026-02-28')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/services/documentos-webpay-cuenta.test.ts`

Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

```ts
export type DocumentoCuenta = {
  concepto: 'matricula' | 'arancel'
  ctapag: number | null
  ctadoc: number | null
  folio: string | null
  monto: number
  fecha: string
  fecven: string
  cuota: number
  numcuot: number
  aplicaBoleta: boolean
}

const CREDITO = new Set(['VN', 'VC', 'SI', 'S2', 'NC'])
const DEBITO = new Set(['VD', 'VP'])

function folio(autorizacion: string, cuota: number): string {
  return `${autorizacion.trim()}${String(cuota).padStart(2, '0')}`
}

function vence(fecha: string, indice: number): string {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  const mes0 = m - 1 + (indice - 1)
  const year = y + Math.floor(mes0 / 12)
  const month = ((mes0 % 12) + 12) % 12
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(d, last)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function repartir(monto: number, n: number): number[] {
  const base = Math.floor(monto / n)
  const rows = Array.from({ length: n }, () => base)
  rows[n - 1] = monto - base * (n - 1)
  return rows
}

function fila(
  concepto: 'matricula' | 'arancel',
  parcial: Omit<DocumentoCuenta, 'concepto'>,
): DocumentoCuenta {
  return { concepto, ...parcial }
}

export function armarDocumentosWebpay(input: {
  concepto: 'matricula' | 'arancel'
  paymentTypeCode: string
  installmentsNumber: number | null
  autorizacion: string
  fecha: string
  saldoTrasBeneficios: number
}): DocumentoCuenta[] {
  const tipo = input.paymentTypeCode.trim().toUpperCase()
  if (!CREDITO.has(tipo) && !DEBITO.has(tipo)) {
    throw new Error(`Tipo de pago Transbank no reconocido: ${input.paymentTypeCode}`)
  }
  const fecha = input.fecha.slice(0, 10)
  const descuento =
    input.concepto === 'arancel' ? Math.round(input.saldoTrasBeneficios * 0.05) : 0
  const tarjeta = input.saldoTrasBeneficios - descuento
  const docs: DocumentoCuenta[] = []
  if (descuento > 0) {
    docs.push(
      fila(input.concepto, {
        ctapag: 20,
        ctadoc: null,
        folio: null,
        monto: descuento,
        fecha,
        fecven: fecha,
        cuota: 1,
        numcuot: 1,
        aplicaBoleta: true,
      }),
    )
  }
  const cuotas = DEBITO.has(tipo)
    ? 1
    : input.installmentsNumber == null || input.installmentsNumber < 2
      ? 1
      : input.installmentsNumber
  const codigoTarjeta = DEBITO.has(tipo) ? 435 : 434
  docs.push(
    fila(input.concepto, {
      ctapag: codigoTarjeta,
      ctadoc: null,
      folio: folio(input.autorizacion, 1),
      monto: tarjeta,
      fecha,
      fecven: fecha,
      cuota: 1,
      numcuot: 1,
      aplicaBoleta: true,
    }),
  )
  if (cuotas === 1 && DEBITO.has(tipo)) {
    docs.push(
      fila(input.concepto, {
        ctapag: null,
        ctadoc: 810,
        folio: folio(input.autorizacion, 1),
        monto: tarjeta,
        fecha,
        fecven: fecha,
        cuota: 1,
        numcuot: 1,
        aplicaBoleta: false,
      }),
    )
    return docs
  }
  if (cuotas === 1) {
    docs.push(
      fila(input.concepto, {
        ctapag: null,
        ctadoc: 809,
        folio: folio(input.autorizacion, 1),
        monto: tarjeta,
        fecha,
        fecven: fecha,
        cuota: 1,
        numcuot: 1,
        aplicaBoleta: false,
      }),
    )
    return docs
  }
  const montos = repartir(tarjeta, cuotas)
  for (let i = 1; i <= cuotas; i += 1) {
    const vencimiento = vence(fecha, i)
    const numero = folio(input.autorizacion, i)
    docs.push(
      fila(input.concepto, {
        ctapag: 440,
        ctadoc: null,
        folio: numero,
        monto: montos[i - 1],
        fecha,
        fecven: vencimiento,
        cuota: i,
        numcuot: cuotas,
        aplicaBoleta: false,
      }),
    )
    docs.push(
      fila(input.concepto, {
        ctapag: null,
        ctadoc: 811,
        folio: numero,
        monto: montos[i - 1],
        fecha,
        fecven: vencimiento,
        cuota: i,
        numcuot: cuotas,
        aplicaBoleta: false,
      }),
    )
  }
  return docs
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/services/documentos-webpay-cuenta.test.ts`

Expected: PASS. 133350 + 2533650 = 2667000. 132000 + 2508000 = 2640000.

- [ ] **Step 5: Commit**

```bash
git add src/services/documentos-webpay-cuenta.ts src/services/documentos-webpay-cuenta.test.ts
git commit -m "feat(rematricula): armar el 5 % y los documentos de la tarjeta"
```

---

### Task 4: El arancel puede no estar elegido todavía

**Files:**
- Modify: `src/utils/webpaySiguientePaso.ts`
- Modify: `src/utils/webpaySiguientePaso.test.ts`

**Interfaces:**
- Consumes: `MedioConcepto` actual.
- Produces: `medioArancel: MedioConcepto | null` y el paso `{ tipo: 'elegir-arancel' }`.

- [ ] **Step 1: Write the failing test**

```ts
it('matrícula Webpay sin arancel elegido vuelve al diálogo', () => {
  expect(
    siguientePaso({
      ...base,
      medioMatricula: 'webpay',
      medioArancel: null,
      matriculaAutorizada: true,
    }),
  ).toEqual({ tipo: 'elegir-arancel' })
})

it('matrícula Webpay sin autorizar sale a Webpay aunque el arancel no esté elegido', () => {
  expect(
    siguientePaso({
      ...base,
      medioMatricula: 'webpay',
      medioArancel: null,
    }),
  ).toEqual({ tipo: 'webpay', concepto: 'matricula' })
})
```

Cambiar el tipo del input de `medioArancel` a `MedioConcepto | null`. Los tests viejos siguen pasando un medio concreto.

- [ ] **Step 2: Run test to verify it fails**

Run from `/opt/mol-docker`: `npx vitest run --config vitest.unit.config.ts src/utils/webpaySiguientePaso.test.ts`

Expected: FAIL, `elegir-arancel` no existe.

- [ ] **Step 3: Write minimal implementation**

Agregar `{ tipo: 'elegir-arancel' }` a `PasoWebpay`. Al inicio de `siguientePaso`, después del caso de los dos pagaré:

```ts
if (input.medioMatricula === 'webpay' && !input.matriculaAutorizada) {
  return { tipo: 'webpay', concepto: 'matricula' }
}
if (input.medioArancel == null) {
  return { tipo: 'elegir-arancel' }
}
```

El resto de la función usa `input.medioArancel` ya estrecho a `'webpay' | 'pagare'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/webpaySiguientePaso.test.ts`

Expected: PASS, incluidos los casos anteriores.

- [ ] **Step 5: Commit**

```bash
git add src/utils/webpaySiguientePaso.ts src/utils/webpaySiguientePaso.test.ts
git commit -m "feat(rematricula): volver al diálogo si el arancel aún no tiene medio"
```

---

### Task 5: Estado del diálogo y cuenta regresiva

**Files:**
- Create: `src/utils/selectorMedioPago.ts`
- Create: `src/utils/selectorMedioPago.test.ts`
- Modify: `src/views/matricula-alumno/FormaPagoAlumnoView.vue`

**Interfaces:**
- Consumes: nada.
- Produces:

```ts
export type Medio = 'pagare' | 'webpay' | null

export function arancelHabilitado(input: {
  medioMatricula: Medio
  matriculaAutorizada: boolean
}): boolean

export function puedeContinuar(input: {
  medioMatricula: Medio
  medioArancel: Medio
  matriculaAutorizada: boolean
}): boolean
```

Continuar solo si ambos son pagaré, o si la matrícula ya está autorizada y el arancel es pagaré. Webpay no usa Continuar: el clic abre la salida.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { arancelHabilitado, puedeContinuar } from '@/utils/selectorMedioPago'

describe('selectorMedioPago', () => {
  it('el arancel parte apagado', () => {
    expect(arancelHabilitado({ medioMatricula: null, matriculaAutorizada: false })).toBe(false)
  })

  it('pagaré en matrícula enciende el arancel', () => {
    expect(arancelHabilitado({ medioMatricula: 'pagare', matriculaAutorizada: false })).toBe(true)
  })

  it('Webpay en matrícula deja el arancel apagado hasta que vuelva autorizado', () => {
    expect(arancelHabilitado({ medioMatricula: 'webpay', matriculaAutorizada: false })).toBe(false)
    expect(arancelHabilitado({ medioMatricula: 'webpay', matriculaAutorizada: true })).toBe(true)
  })

  it('Continuar solo arma el plan de pagaré', () => {
    expect(
      puedeContinuar({ medioMatricula: 'pagare', medioArancel: 'pagare', matriculaAutorizada: false }),
    ).toBe(true)
    expect(
      puedeContinuar({ medioMatricula: 'pagare', medioArancel: 'webpay', matriculaAutorizada: false }),
    ).toBe(false)
    expect(
      puedeContinuar({ medioMatricula: 'webpay', medioArancel: 'pagare', matriculaAutorizada: true }),
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/selectorMedioPago.test.ts`

Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

```ts
export type Medio = 'pagare' | 'webpay' | null

export function arancelHabilitado(input: {
  medioMatricula: Medio
  matriculaAutorizada: boolean
}): boolean {
  if (input.matriculaAutorizada) return true
  return input.medioMatricula === 'pagare'
}

export function puedeContinuar(input: {
  medioMatricula: Medio
  medioArancel: Medio
  matriculaAutorizada: boolean
}): boolean {
  if (input.medioArancel !== 'pagare') return false
  if (input.matriculaAutorizada) return true
  return input.medioMatricula === 'pagare'
}
```

En `FormaPagoAlumnoView.vue`, el clic de Webpay no asigna el medio y listo. Pone `faseSalida = 'webpay'`, `conceptoSalida` en `'matricula'` o `'arancel'`, y `segundosSalida = 3`. El texto del diálogo es el aviso del diseño. Un `setInterval` de 1 segundo baja el contador. En 0 llama a `iniciarWebpay(conceptoSalida)` y limpia el intervalo. Cancelar, la X del diálogo y `onPagoMatriculaDialogOpenChange(false)` limpian el intervalo, ponen `faseSalida = 'opciones'` y no dejan el medio Webpay marcado.

Los botones de arancel usan `:disabled="!arancelHabilitado(...)"` y, apagados, la clase `opacity-50 cursor-not-allowed`. Los de matrícula quedan apagados cuando `webpayMatriculaEstado === 'autorizada'`, con el texto «Pagada».

Al volver con query `aviso=abortada` o `aviso=rechazada`, mostrar el aviso exacto del diseño encima de las opciones y luego borrar esa query con `router.replace`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/selectorMedioPago.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/selectorMedioPago.ts src/utils/selectorMedioPago.test.ts src/views/matricula-alumno/FormaPagoAlumnoView.vue
git commit -m "feat(rematricula): elegir la matrícula antes del arancel y avisar la salida a Webpay"
```

---

### Task 6: Líneas del contrato por medio

**Files:**
- Create: `src/utils/lineasContratoMedio.ts`
- Create: `src/utils/lineasContratoMedio.test.ts`
- Modify: `src/composables/useContratoMatriculaViewModel.ts`
- Modify: `src/components/rematricula/ContratoPrestacionServiciosPreview.vue`

**Interfaces:**
- Consumes: `DocumentoCuenta` no hace falta. Esta función solo decide qué bloques muestra el contrato.
- Produces:

```ts
export function bloquesContrato(input: {
  medioMatricula: 'pagare' | 'webpay'
  medioArancel: 'pagare' | 'webpay'
  descuentoFormaPagoArancel: number
  montoWebpayMatricula: number
  montoWebpayArancel: number
}): {
  muestraCuotasMatricula: boolean
  muestraCuotasArancel: boolean
  muestraPagadoWebpayMatricula: boolean
  muestraPagadoWebpayArancel: boolean
  muestraMandatoPagare: boolean
  descuentoFormaPagoArancel: number
}
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { bloquesContrato } from '@/utils/lineasContratoMedio'

describe('bloquesContrato', () => {
  it('los dos Webpay no llevan cuotas ni mandato, y el arancel lleva el 5 %', () => {
    const bloques = bloquesContrato({
      medioMatricula: 'webpay',
      medioArancel: 'webpay',
      descuentoFormaPagoArancel: 133_350,
      montoWebpayMatricula: 200_000,
      montoWebpayArancel: 2_533_650,
    })
    expect(bloques.muestraCuotasMatricula).toBe(false)
    expect(bloques.muestraCuotasArancel).toBe(false)
    expect(bloques.muestraPagadoWebpayMatricula).toBe(true)
    expect(bloques.muestraPagadoWebpayArancel).toBe(true)
    expect(bloques.muestraMandatoPagare).toBe(false)
    expect(bloques.descuentoFormaPagoArancel).toBe(133_350)
  })

  it('un pagaré enciende sus cuotas y el mandato', () => {
    const bloques = bloquesContrato({
      medioMatricula: 'pagare',
      medioArancel: 'webpay',
      descuentoFormaPagoArancel: 132_000,
      montoWebpayMatricula: 0,
      montoWebpayArancel: 2_508_000,
    })
    expect(bloques.muestraCuotasMatricula).toBe(true)
    expect(bloques.muestraPagadoWebpayArancel).toBe(true)
    expect(bloques.muestraMandatoPagare).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/lineasContratoMedio.test.ts`

Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

```ts
export function bloquesContrato(input: {
  medioMatricula: 'pagare' | 'webpay'
  medioArancel: 'pagare' | 'webpay'
  descuentoFormaPagoArancel: number
  montoWebpayMatricula: number
  montoWebpayArancel: number
}): {
  muestraCuotasMatricula: boolean
  muestraCuotasArancel: boolean
  muestraPagadoWebpayMatricula: boolean
  muestraPagadoWebpayArancel: boolean
  muestraMandatoPagare: boolean
  descuentoFormaPagoArancel: number
  montoWebpayMatricula: number
  montoWebpayArancel: number
} {
  return {
    muestraCuotasMatricula: input.medioMatricula === 'pagare',
    muestraCuotasArancel: input.medioArancel === 'pagare',
    muestraPagadoWebpayMatricula: input.medioMatricula === 'webpay',
    muestraPagadoWebpayArancel: input.medioArancel === 'webpay',
    muestraMandatoPagare: input.medioMatricula === 'pagare' || input.medioArancel === 'pagare',
    descuentoFormaPagoArancel: input.medioArancel === 'webpay' ? input.descuentoFormaPagoArancel : 0,
    montoWebpayMatricula: input.medioMatricula === 'webpay' ? input.montoWebpayMatricula : 0,
    montoWebpayArancel: input.medioArancel === 'webpay' ? input.montoWebpayArancel : 0,
  }
}
```

En `useContratoMatriculaViewModel`, si no hay `pagoMatricula` pero los dos medios son `webpay` y ambos estados son `autorizada`, igual devolver el view model con `cuotas: []` y los montos brutos. En el preview, una fila «Pagado con Webpay» con el monto, y una fila «Descuento por forma de pago» cuando `descuentoFormaPagoArancel > 0`. Ocultar el bloque del mandato cuando `muestraMandatoPagare` es false.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/lineasContratoMedio.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/lineasContratoMedio.ts src/utils/lineasContratoMedio.test.ts src/composables/useContratoMatriculaViewModel.ts src/components/rematricula/ContratoPrestacionServiciosPreview.vue
git commit -m "feat(rematricula): armar el contrato según pagaré o Webpay"
```

---

### Task 7: Grabar los documentos y el intento

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.ts`
- Modify: `docs/SP a U+/sp_mol_grabar_plan_pagos.sql`
- Modify: el procedimiento desplegado en U+ Test con el mismo cuerpo. No tocar producción.

**Interfaces:**
- Consumes: `armarDocumentosWebpay` y `DocumentoCuenta` de la task 3. Filas `mnp_webpay_transaccion` de la task 1. `log_mol_intento` de la task 2.
- Produces: el SP recibe `@documentos_webpay nvarchar(max)`, un JSON array de `DocumentoCuenta`. Lo parsea con `OPENJSON` dentro de la transacción que ya abre el procedimiento, antes del `COMMIT`.

- [ ] **Step 1: Write the failing test**

En un test nuevo `src/services/grabar-plan-pagos-documentos.test.ts`, probar la función pura que elige el saldo y llama al armador. No ejecutar el SP.

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { documentosDesdeWebpay } from './grabar-plan-pagos-documentos'

describe('documentosDesdeWebpay', () => {
  it('rechaza el crédito sin código de autorización', () => {
    assert.throws(
      () =>
        documentosDesdeWebpay({
          concepto: 'arancel',
          authorizationCode: null,
          paymentTypeCode: 'VN',
          installmentsNumber: 1,
          transactionDate: '2026-10-07T15:00:00.000Z',
          saldoTrasBeneficios: 1000,
        }),
      /código de autorización/,
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/services/grabar-plan-pagos-documentos.test.ts`

Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

`documentosDesdeWebpay` exige `authorizationCode`, `paymentTypeCode` y `transactionDate`. Si falta uno, lanza `Error` con el texto «Falta el código de autorización, la fecha o el tipo de tarjeta». Si están, llama a `armarDocumentosWebpay` con `fecha` igual a los primeros 10 caracteres de `transactionDate` en hora de Santiago no hace falta: usar la fecha calendario `YYYY-MM-DD` de `transaction_date` guardada.

`grabarPlanPagosErp`, antes de `execute`:

- Para cada concepto cuyo medio sea `webpay`, leer la fila `autorizada` de `mnp_webpay_transaccion`.
- Calcular el saldo del concepto como bruto menos beneficios de ese ítem cuyo `codben` no sea 4.
- Si `documentosDesdeWebpay` lanza, insertar `log_mol_intento` con resultado `error` y ese mensaje, y responder 422 sin llamar al SP.
- Pasar el JSON de los documentos en `@documentos_webpay`.

Después de un `execute` exitoso, insertar `log_mol_intento` con resultado `ok` y payload `{ numOperacion, medioMatricula, medioArancel }`. Si ese insert falla, solo `console.error`. El `catch` del `execute` inserta resultado `error` con `err.message` y vuelve a lanzar.

En el SP, parámetro `@documentos_webpay nvarchar(max) = NULL`. Dentro de la transacción existente, después de pedir `@num_operacion` y las dos boletas, recorrer el JSON. Para cada fila con `ctapag` no null:

```sql
DECLARE @folio_json varchar(30), @ctapag_json int, @monto_json decimal(18, 2);
DECLARE @fecha_json date, @fecven_json date, @ctapagnum decimal(20, 0);

IF @folio_json IS NULL
    EXEC dbo.sp_parametro_transaccion_correlativo
        @tipo = 'CORRPAGNUM',
        @salida = @ctapagnum OUTPUT,
        @muestra = 'NO';
ELSE
    SET @ctapagnum = CAST(@folio_json AS decimal(20, 0));

INSERT INTO dbo.MT_CTAPAG (
    CTAPAG, CTAPAGNUM, CODCLI, CODCARR, CODAPOD, MONTO, SALDO, SALDO_AD,
    ESTADO, RECIBIDO, CODBAN, TIPOCARR, ANO, PERIODO, CAJA, CTATRANS,
    FECVEN, FECCANCEL, FECREG, FECHA, USUARIO, NUM_OPERACION, jornada
)
VALUES (
    @ctapag_json, @ctapagnum, @codcli, @codcarr, @codapod_boleta, @monto_json, 0, 0,
    1, 'N', 0, 1, @ano, @periodo, @caja, @ctapagnum,
    @fecven_json, @hoy, @hoy, @fecha_json, @usuario, @num_operacion, @jornada
);
```

El cursor lee `OPENJSON(@documentos_webpay)` con `ctapag`, `ctadoc`, `folio`, `monto`, `fecha`, `fecven`, `cuota`, `numcuot`, `aplicaBoleta` y `concepto`. El tipo 20 llega con `folio` null y por eso pide `CORRPAGNUM`. El 434, el 435 y el 440 llegan con folio y no piden otro número.

Para cada fila con `ctadoc` no null, insertar `MT_CTADOC` con `CTADOC = ctadoc`, `CTADOCNUM` y `CTATRANS` iguales al folio, `CUOTA`, `NUMCUOT`, `MONTO`, `SALDO = 0`, `ESTADO = 1`, `FECHA = fecha`, `FECVEN = fecven`, `CODCLI`, `CODAPOD = @codapod_boleta`, `ANO`, `PERIODO`, `CAJA`, `USUARIO`, `NUM_OPERACION` y `jornada`. `MT_CTADEP` solo si `aplicaBoleta` es true: `CTADOC = 41`, `CTADOCNUM` es `@ctadoc_matricula` cuando `concepto = 'matricula'` y `@ctadoc_arancel` cuando es `'arancel'`. No insertar `MT_POSBEN` para el tipo 20. No insertar tipo 5 ni cuotas 14 para un concepto que vino en este JSON.

Desplegar con `CREATE OR ALTER` en `TEST_UNIACC`. No ejecutar el procedimiento contra producción.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/services/grabar-plan-pagos-documentos.test.ts src/services/documentos-webpay-cuenta.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Un commit en `uniacc-api-docker` y otro en `mol-docker` para el archivo SQL del SP.

```bash
git commit -m "feat(rematricula): grabar la tarjeta y el intento en la misma firma"
```

---

## Self-review

- Diálogo, avisos, contador, Cancelar y X: task 5.
- Regreso autorizado, abortado y rechazado: tasks 4 y 5.
- Cuotas y JSON de Transbank: task 1.
- `log_mol_intento` y trigger: task 2. Lo usa la task 7.
- 5 %, 434, 435, 809, 810, 440, 811, calendario y folio: task 3. Lo inserta la task 7.
- Contrato y mandato: task 6.
- Mock, reescritura de operaciones viejas y cuotas elegidas en MOL: fuera de las tasks, como el spec.
