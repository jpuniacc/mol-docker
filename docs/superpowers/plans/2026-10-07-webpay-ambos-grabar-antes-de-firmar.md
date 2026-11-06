# Webpay en los dos conceptos: grabar la cuenta antes de firmar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando matrícula y arancel ya están autorizados en Webpay, MOL graba la cuenta en U+ Test, pone ese número de operación en el contrato y recién entonces lo envía a firmar. El PDF incluye el mandato. La ficha de matrícula firmada se cierra después de las dos firmas.

**Architecture:** El armado de documentos de tarjeta no se reescribe: `documentosDesdeWebpay` ya produce el 5 %, el 434 o 435, el 809 o 810 de una cuota, y el calendario 440/811 cuando el crédito trae dos o más cuotas. Lo que falta es un payload que no exige plan de pagaré, una llamada al SP antes de TuFirma, y guardar el `num_operacion` que el SP devuelve para que el PDF no salga con «—». La segunda llamada, ya con las dos firmas, encuentra los folios de la tarjeta y solo cierra la ficha.

**Tech Stack:** Vue 3 + Vitest (`vitest.unit.config.ts`) en `/opt/mol-docker`. Express + `node:test` en `/opt/uniacc-api-docker`. El SP `dbo.sp_mol_grabar_plan_pagos` ya está en TEST_UNIACC y no se vuelve a desplegar.

**Spec de origen:** `docs/superpowers/specs/2026-10-07-webpay-forma-pago-cuenta-design.md` y el canvas `webpay-ambos-tablas.canvas.tsx`. Este plan cambia dos frases de ese spec: la cuenta de los dos Webpay se graba antes del PDF, y el décimo quinto entra aunque no haya pagaré.

## Global Constraints

- Rematrícula del alumno. No se toca el mock (`FormaPagoMockView.vue`, `FirmaMockView.vue`).
- El ambiente activo tiene que ser test. No se ejecuta el SP a mano. No se escribe en UNIACC de producción. No se hace `DROP` de `dbo.mol_plan_beneficio`.
- El SP actual ya omite el tipo 5 y las cuotas 14 de un concepto que viene en `@documentos_webpay`. El único cambio al procedimiento es el cargo por conciliar: `MT_CTADOC` 809, 810 y 811 se insertan con `SALDO = MONTO` y `ESTADO = 2`. La boleta 41 sigue en saldo 0 y estado 1. Se despliega con `CREATE OR ALTER` solo en `TEST_UNIACC`, después de confirmar `DB_NAME()`. No se ejecuta el procedimiento. No se escribe en producción.
- Boleta 41 por el bruto. El monto que viaja como `montoMatricula` y `montoArancel` es el saldo después de beneficios y antes del 5 %. El API vuelve a sumar los beneficios para el bruto y calcula el 5 % solo sobre el arancel.
- CAE (`CODBEN` 4) entra en `@beneficios` si su monto es mayor que cero. No baja el saldo de la tarjeta ni la base del 5 %.
- Crédito en una cuota: 434 + 809. Débito `VD` o prepago `VP`: 435 + 810. Crédito con `installments_number` de 2 o más: un 434 por el total de la tarjeta, sin 809, y un par 440/811 por cuota. El 440 no se aplica a la boleta. Misma operación. Eso ya lo arma `armarDocumentosWebpay`.
- El 809, el 810 y el 811 nacen con `SALDO = MONTO` y `ESTADO = 2`. Quedan pendientes para que tesorería los concilie. No nacen en cero ni en estado 1.
- Folio de tarjeta: autorización más la cuota en dos dígitos. Cada concepto tiene su propia transacción.
- `CODAPOD` de la boleta lo resuelve el SP desde `MT_CLIENT`. El payload sigue enviando el RUT del alumno en `codapod`.
- El pagaré de un solo concepto no cambia de orden: se sigue grabando cuando las dos firmas están listas, con `cerrarFicha` en true.
- No se reescriben operaciones ya grabadas. La segunda llamada devuelve `already: true`.
- Caja MOL 997 si el preflight no trae caja. Contrato: el preview `CORRCONTRATO` del preflight, nunca el texto `webpay`.
- Sin número de tarjeta ni llave de Transbank en el log.

---

### Task 1: Dejar el mandato en el contrato aunque los dos sean Webpay

**Files:**
- Modify: `/opt/mol-docker/src/utils/lineasContratoMedio.ts`
- Test: `/opt/mol-docker/src/utils/lineasContratoMedio.test.ts`

**Interfaces:**
- Consumes: `bloquesContrato` ya existente.
- Produces: `bloquesContrato(...).muestraMandatoPagare` es `true` para cualquier par de medios. Las cuotas siguen apagadas cuando el medio es `webpay`.

- [ ] **Step 1: Cambiar el test que hoy exige ocultar el mandato**

En `lineasContratoMedio.test.ts`, el primer test pasa a llamarse `los dos Webpay no llevan cuotas, llevan el mandato y el arancel lleva el 5 %`, y la expectativa del mandato queda así:

```ts
expect(bloques.muestraMandatoPagare).toBe(true)
```

El segundo test no cambia: un pagaré también deja el mandato en true.

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/lineasContratoMedio.test.ts`

Expected: FAIL en `muestraMandatoPagare`. El valor recibido es `false`.

- [ ] **Step 3: Encender el mandato siempre**

En `bloquesContrato`, reemplazar la línea del mandato por:

```ts
muestraMandatoPagare: true,
```

No cambiar `muestraCuotasMatricula` ni `muestraCuotasArancel`.

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/lineasContratoMedio.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/lineasContratoMedio.ts src/utils/lineasContratoMedio.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): dejar el mandato en el contrato Webpay

El décimo quinto autoriza a llenar un pagaré si queda saldo. No es un movimiento de la cuenta, así que el PDF lo incluye aunque los dos conceptos se hayan pagado con tarjeta.
EOF
)"
```

---

### Task 2: Armar el payload de la cuenta sin plan de pagaré

**Files:**
- Create: `/opt/mol-docker/src/utils/grabarCuentaWebpay.ts`
- Create: `/opt/mol-docker/src/utils/grabarCuentaWebpay.test.ts`
- Modify: `/opt/mol-docker/src/services/grabarPlanPagosApi.ts`

**Interfaces:**
- Consumes: `DocumentoDescuentoAsignado` de `src/utils/documentosDescuentoContrato.ts`. `rutSinDv` de `src/services/alumnoDeudaNetApi.ts`.
- Produces: `armarGrabarCuentaWebpay(input: GrabarCuentaWebpayInput): { ok: true; payload: GrabarPlanPagosPayload } | { ok: false; error: string }`.
- Produces on `GrabarPlanPagosPayload` (campos nuevos, opcionales para no romper el pagaré): `medioMatricula?: 'pagare' | 'webpay'`, `medioArancel?: 'pagare' | 'webpay'`, `cerrarFicha?: boolean`.

`GrabarCuentaWebpayInput`:

```ts
export type GrabarCuentaWebpayInput = {
  rut: string
  codcliAcademico: string
  codigoCarrera: string
  ano: number | null
  periodo: number | null
  caja: number | null
  contrato: string
  fechaInicio: string
  montoMatricula: number
  montoArancel: number
  descuentos: DocumentoDescuentoAsignado[]
  cerrarFicha: boolean
}
```

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from 'vitest'
import { armarGrabarCuentaWebpay } from '@/utils/grabarCuentaWebpay'

const base = {
  rut: '19.740.769-7',
  codcliAcademico: '20241PSIC1DR033',
  codigoCarrera: 'PSIC1DR',
  ano: 2027,
  periodo: 1 as const,
  caja: 997,
  contrato: '20271PSIC1DR0001',
  fechaInicio: '2026-10-07',
  montoMatricula: 250_000,
  montoArancel: 4_140_000,
  descuentos: [],
  cerrarFicha: false,
}

describe('armarGrabarCuentaWebpay', () => {
  it('manda el saldo antes del 5 % y no inventa folios de pagaré', () => {
    const armado = armarGrabarCuentaWebpay(base)
    expect(armado.ok).toBe(true)
    if (!armado.ok) return
    expect(armado.payload.codcli).toBe('19740769')
    expect(armado.payload.montoMatricula).toBe(250_000)
    expect(armado.payload.montoArancel).toBe(4_140_000)
    expect(armado.payload.cuotas).toBe(1)
    expect(armado.payload.corrpagMatricula).toBe('0')
    expect(armado.payload.corrpagArancel).toBe('0')
    expect(armado.payload.medioMatricula).toBe('webpay')
    expect(armado.payload.medioArancel).toBe('webpay')
    expect(armado.payload.cerrarFicha).toBe(false)
    expect(armado.payload.beneficios).toEqual([])
  })

  it('incluye la beca con su folio y deja fuera un monto en cero', () => {
    const armado = armarGrabarCuentaWebpay({
      ...base,
      descuentos: [
        {
          concepto: 'arancel',
          documento: '90121376727',
          tipoDocumento: 'BECAS INTERNAS ASIGNADAS',
          descripcion: 'Beca',
          detalle: 'BECAS INTERNAS ASIGNADAS',
          monto: 125_000,
          vencimiento: '29/12/2027',
          codben: '2039',
          porc: 50,
          montoSolicitado: 125_000,
        },
        {
          concepto: 'arancel',
          documento: '90121376728',
          tipoDocumento: 'PAGARÉ CAE',
          descripcion: 'CAE',
          detalle: 'PAGARÉ CAE',
          monto: 0,
          vencimiento: '29/12/2027',
          codben: '4',
          porc: 0,
          montoSolicitado: 0,
        },
      ],
    })
    expect(armado.ok).toBe(true)
    if (!armado.ok) return
    expect(armado.payload.beneficios).toEqual([
      {
        codben: 2039,
        porcSol: 50,
        porcApr: 50,
        montoSol: 125_000,
        montoApr: 125_000,
        monto: 125_000,
        aplicable: 1,
        concepto: 'A',
        corrpag: '90121376727',
      },
    ])
  })

  it('rechaza un beneficio con monto si no trae CODBEN o folio', () => {
    const sinCodigo = armarGrabarCuentaWebpay({
      ...base,
      descuentos: [
        {
          concepto: 'matricula',
          documento: '90121376727',
          tipoDocumento: 'DESCUENTO MATRÍCULA',
          descripcion: 'Mes',
          detalle: 'DESCUENTO MATRÍCULA',
          monto: 50_000,
          vencimiento: '29/12/2027',
          codben: null,
        },
      ],
    })
    expect(sinCodigo).toEqual({ ok: false, error: 'Falta el CODBEN de un beneficio' })
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/grabarCuentaWebpay.test.ts`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar el armado y ampliar el tipo del payload**

En `grabarPlanPagosApi.ts`, agregar al tipo `GrabarPlanPagosPayload` estos tres campos opcionales, sin cambiar `armarGrabarPlanPagos`:

```ts
medioMatricula?: 'pagare' | 'webpay'
medioArancel?: 'pagare' | 'webpay'
cerrarFicha?: boolean
```

`grabarCuentaWebpay.ts` valida RUT, código académico, carrera, contrato, fecha `YYYY-MM-DD`, año y período 1 o 2, igual que las guardas de `armarGrabarPlanPagos`. Caja ausente o no positiva queda en 997. `codapod` es el RUT sin DV. `cuotas` es 1. Los dos `corrpag` son `'0'`. Los medios son `'webpay'`.

`montoMatricula` y `montoArancel` se copian tal cual si son enteros mayores que cero. Si no, el error es `Falta el saldo de matrícula o de arancel`. No se resta el 5 % aquí.

Cada descuento con `monto > 0` exige `codben` de dígitos y `documento` de dígitos. Si falta el código: `Falta el CODBEN de un beneficio`. Si falta el folio: `Falta el folio de un beneficio`. Un monto que no es mayor que cero se omite, incluido un CAE en cero. `concepto: 'matricula'` se traduce a `'M'`; el resto, a `'A'`. `porc` ausente queda en 0. `montoSolicitado` ausente queda en `monto`. `aplicable` es 1.

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/grabarCuentaWebpay.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/grabarCuentaWebpay.ts src/utils/grabarCuentaWebpay.test.ts src/services/grabarPlanPagosApi.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): armar la cuenta cuando los dos pagos son Webpay

El payload lleva el saldo antes del 5 % y marca los dos medios como tarjeta, sin exigir cuotas ni folios de pagaré.
EOF
)"
```

---

### Task 3: Cerrar la ficha solo cuando la firma ya está lista

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.ts`
- Modify: `/opt/uniacc-api-docker/src/services/grabar-plan-pagos-erp.service.test.ts`
- Modify: `/opt/uniacc-api-docker/src/controllers/rematricula-alumno-grabar-plan-pagos.controller.ts`

**Interfaces:**
- Consumes: `GrabarPlanPagosInput`.
- Produces: `GrabarPlanPagosInput.cerrarFicha?: boolean`. Ausente o `true` mantiene el comportamiento del pagaré: después del SP se llama `actualizarMatriculaFirmada`, `registrarMatriculaActualizada` y `encolarAvisoMatriculado`. `false` graba la cuenta y el intento, y no cierra la ficha. Si la cuenta ya existía y `cerrarFicha` es `false`, responde `{ ok: true, already: true, numOperacion }` sin tocar la ficha.

- [ ] **Step 1: Escribir el test de validación**

En `grabar-plan-pagos-erp.service.test.ts`, agregar:

```ts
it('acepta corrpag 0 cuando la cuenta es de tarjeta y la ficha se cierra después', () => {
  assert.doesNotThrow(() =>
    validarGrabarPlanPagos({
      ...input(),
      cuotas: 1,
      corrpagMatricula: '0',
      corrpagArancel: '0',
      medioMatricula: 'webpay',
      medioArancel: 'webpay',
      cerrarFicha: false,
    }),
  )
})
```

Ese test solo fija que la validación no rechaza el folio `0`. El salto de la ficha y el salto de la búsqueda de tipo 5 se implementan en el servicio; no hay forma de ejecutar el SP en este test.

- [ ] **Step 2: Correr el test**

Run: `npx tsx --test src/services/grabar-plan-pagos-erp.service.test.ts`

Expected: PASS del caso nuevo en cuanto el tipo acepte los campos. Si TypeScript rechaza `cerrarFicha` o `medioMatricula` en el objeto, el fallo es el que hay que corregir en el paso 3.

- [ ] **Step 3: Implementar el flag y el folio cero**

En `GrabarPlanPagosInput` agregar `cerrarFicha?: boolean`.

En `grabarPlanPagosErp`, antes de la consulta `CTAPAG = 5`:

```ts
const corrpagMatriculaEsPagare = input.corrpagMatricula !== '0'
```

Si es `false`, no correr esa consulta. Un folio `0` no es un pagaré ya grabado.

Después de un grabado nuevo, y dentro de `completarPlanYaGrabado`, si `input.cerrarFicha === false`, no llamar a `actualizarMatriculaFirmada`, `registrarMatriculaActualizada` ni `encolarAvisoMatriculado`. El intento `ok` sí se inserta en el grabado nuevo. La respuesta sigue siendo `{ ok: true, numOperacion, already, ambiente: 'test' }`.

En el controller, leer el flag y pasarlo:

```ts
body('cerrarFicha').optional().isBoolean(),
```

```ts
cerrarFicha: body.cerrarFicha === false ? false : true,
```

`express-validator` con `isBoolean()` acepta el booleano JSON. No usar `toBoolean()`, porque convierte el string `"false"` en `true`.

- [ ] **Step 4: Correr el test**

Run: `npx tsx --test src/services/grabar-plan-pagos-erp.service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit en `/opt/uniacc-api-docker`**

```bash
cd /opt/uniacc-api-docker
git add src/services/grabar-plan-pagos-erp.service.ts src/services/grabar-plan-pagos-erp.service.test.ts src/controllers/rematricula-alumno-grabar-plan-pagos.controller.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): separar el grabado de la tarjeta del cierre de la ficha

La cuenta puede quedar escrita antes de la firma. La ficha y el aviso se cierran en la llamada posterior, cuando las dos firmas ya están.
EOF
)"
```

---

### Task 4: Guardar el número de operación para el PDF

**Files:**
- Modify: `/opt/mol-docker/src/stores/matriculaAlumnoContext.ts`
- Create: `/opt/mol-docker/src/utils/numeroOperacionContrato.ts`
- Create: `/opt/mol-docker/src/utils/numeroOperacionContrato.test.ts`
- Modify: `/opt/mol-docker/src/composables/useContratoMatriculaViewModel.ts` (la línea de `numOperacion`)

**Interfaces:**
- Consumes: nada de las tasks anteriores, salvo que el número lo va a escribir la task 6.
- Produces: `numeroOperacionContrato(pago: string | null | undefined, cuenta: string | null | undefined): string`. Devuelve el primer valor que sea solo dígitos. Si ninguno lo es, devuelve `'—'`.
- Produces: `numOperacionCuenta: string | null` en el store del alumno, persistido en sessionStorage, con `setNumOperacionCuenta(valor: string | null)`.

- [ ] **Step 1: Escribir el test**

```ts
import { describe, expect, it } from 'vitest'
import { numeroOperacionContrato } from '@/utils/numeroOperacionContrato'

describe('numeroOperacionContrato', () => {
  it('prefiere el número de la cuenta grabada sobre el guion del pagaré', () => {
    expect(numeroOperacionContrato('—', '940682')).toBe('940682')
    expect(numeroOperacionContrato(undefined, null)).toBe('—')
    expect(numeroOperacionContrato('918341', '940682')).toBe('918341')
  })
})
```

El pagaré ya trae su preview en `pago.numOperacion`. Ese camino no se pisa: si el pago trae dígitos, se usan. La cuenta grabada cubre el caso en que el pago no existe.

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/numeroOperacionContrato.test.ts`

Expected: FAIL, módulo ausente.

- [ ] **Step 3: Implementar el helper y el campo del store**

```ts
export function numeroOperacionContrato(
  pago: string | null | undefined,
  cuenta: string | null | undefined,
): string {
  const delPago = (pago ?? '').trim()
  if (/^\d+$/.test(delPago)) return delPago
  const deLaCuenta = (cuenta ?? '').trim()
  if (/^\d+$/.test(deLaCuenta)) return deLaCuenta
  return '—'
}
```

En el store, seguir el patrón de `webpayMontoMatricula`: estado inicial `null`, lectura al hidratar, escritura en `persistToSessionStorage`, y limpieza en el reset. `setNumOperacionCuenta` persiste.

En el view model del alumno, reemplazar `numOperacion: String(pago?.numOperacion ?? '—')` por `numeroOperacionContrato(pago?.numOperacion, ctx.numOperacionCuenta)`. El mock no tiene ese campo: pasar `undefined`.

El contrato del view model deja de usar el literal `webpay`:

```ts
const previewContrato = (preflight.steps?.contrato.preview ?? '').trim()
const contrato = (pago?.contrato ?? '').trim() || previewContrato || '—'
```

Ese `contrato` reemplaza `String(pago?.contrato ?? 'webpay')`.

- [ ] **Step 4: Correr el test**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/numeroOperacionContrato.test.ts`

Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/utils/numeroOperacionContrato.ts src/utils/numeroOperacionContrato.test.ts src/stores/matriculaAlumnoContext.ts src/composables/useContratoMatriculaViewModel.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): mostrar en el contrato el número de la cuenta grabada

Sin plan de pagaré el PDF ya no depende del guion. Usa la operación que devolvió U+ y el preview del contrato del preflight.
EOF
)"
```

---

### Task 5: Conservar los beneficios con CODBEN hasta el grabado

**Files:**
- Create: `/opt/mol-docker/src/utils/lineasBeneficioGrabar.ts`
- Create: `/opt/mol-docker/src/utils/lineasBeneficioGrabar.test.ts`
- Modify: `/opt/mol-docker/src/stores/matriculaAlumnoContext.ts`
- Modify: `/opt/mol-docker/src/views/matricula-alumno/FormaPagoAlumnoView.vue` (`persistirMediosYMontosWebpay` y la lista que hoy arma `descuentosParaContrato`)

**Interfaces:**
- Consumes: `LineaParaDocumentoDescuento` de `src/utils/documentosDescuentoContrato.ts`. La lista interna de `descuentosParaContrato`, antes de `asignarDocumentosDescuento`.
- Produces: `lineasBeneficioGrabar: LineaParaDocumentoDescuento[]` y `setLineasBeneficioGrabar(lineas)`. La task 6 les pone folio con `asignarDocumentosDescuento({ reservadosPagare: 0 })`.

- [ ] **Step 1: Extraer la lista sin folio y cubrirla con un test pequeño**

Crear `/opt/mol-docker/src/utils/lineasBeneficioGrabar.ts` con la función pura que ya está implícita en `descuentosParaContrato`. No hace falta el peek.

```ts
export function lineasBeneficioGrabar(input: {
  lineasArancel: LineaParaDocumentoDescuento[]
  descuentoMatricula: LineaParaDocumentoDescuento | null
  cae: LineaParaDocumentoDescuento | null
}): LineaParaDocumentoDescuento[] {
  const lineas = input.lineasArancel.filter((linea) => linea.flujo !== 'CAE' && linea.monto > 0)
  if (input.cae && input.cae.monto > 0) lineas.push(input.cae)
  if (input.descuentoMatricula && input.descuentoMatricula.monto > 0) {
    lineas.push(input.descuentoMatricula)
  }
  return lineas
}
```

Test en `lineasBeneficioGrabar.test.ts`: un arancel con codben `2039`, un CAE de monto 0 que no entra, y un descuento de matrícula que sí entra con su codben.

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/lineasBeneficioGrabar.test.ts`

Expected: FAIL, módulo ausente.

- [ ] **Step 3: Persistir esa lista al salir a Webpay**

Implementar la función del paso 1. En el store, el mismo patrón de persistencia que `descuentosContrato`.

En `persistirMediosYMontosWebpay`, además de `setDatosContratoWebpay`, llamar `setLineasBeneficioGrabar` con el resultado de `lineasBeneficioGrabar`. Las líneas de arancel salen de `lineasDescuento` (`codigo` → `codben`, `porcCatalogo`, `monto`, `flujo`, `descripcion`). El descuento de matrícula del mes y el CAE salen de los mismos objetos que ya usa `descuentosParaContrato`. El CAE se pasa aunque el PDF lo omita; la función lo descarta si el monto no es mayor que cero.

`descuentosParaContrato` puede pasar a construir sus `lineas` con esta función y después llamar a `asignarDocumentosDescuento`, para no dejar dos listas distintas. El pagaré sigue usando `reservadosPagare` por defecto (2).

- [ ] **Step 4: Correr el test**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/lineasBeneficioGrabar.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/lineasBeneficioGrabar.ts src/utils/lineasBeneficioGrabar.test.ts src/stores/matriculaAlumnoContext.ts src/views/matricula-alumno/FormaPagoAlumnoView.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): conservar el CODBEN de los beneficios hasta grabar la tarjeta

El contrato sigue mostrando el descuento sin folio. La cuenta necesita el código y, más adelante, un CORRPAGNUM propio.
EOF
)"
```

---

### Task 6: Grabar antes de TuFirma y cerrar la ficha al terminar

**Files:**
- Create: `/opt/mol-docker/src/utils/ordenGrabadoWebpay.ts`
- Create: `/opt/mol-docker/src/utils/ordenGrabadoWebpay.test.ts`
- Modify: `/opt/mol-docker/src/views/matricula-alumno/FirmaAlumnoView.vue`

`postGrabarPlanPagos` ya hace `JSON.stringify` del payload, así que `medioMatricula`, `medioArancel` y `cerrarFicha` viajan sin otro cambio en ese servicio.

**Interfaces:**
- Consumes: `armarGrabarCuentaWebpay`, `postGrabarPlanPagos`, `setNumOperacionCuenta`, `numeroOperacionContrato`, `lineasBeneficioGrabar` del store, `asignarDocumentosDescuento`, `contratoPreview` y `corrpagnumPreview` del preflight.
- Produces: al pulsar enviar, si los dos Webpay están autorizados y todavía no hay número de operación numérico, se graba con `cerrarFicha: false`. El PDF y TuFirma usan ese número. Cuando `estado.ready`, la segunda llamada usa `cerrarFicha: true`. El camino pagaré de `grabarPlanFirmado` queda igual.

- [ ] **Step 1: Describir el orden en un helper puro y testearlo**

Crear `/opt/mol-docker/src/utils/ordenGrabadoWebpay.ts`:

```ts
export type OrdenGrabadoWebpay =
  | { tipo: 'grabar'; cerrarFicha: boolean }
  | { tipo: 'firmar' }
  | { tipo: 'cerrar-ficha' }
  | { tipo: 'esperar' }

export function ordenGrabadoWebpay(input: {
  ambosWebpay: boolean
  numOperacion: string | null
  firmasListas: boolean
}): OrdenGrabadoWebpay {
  if (!input.ambosWebpay) return { tipo: 'esperar' }
  const tieneNumero = /^\d+$/.test((input.numOperacion ?? '').trim())
  if (!tieneNumero) return { tipo: 'grabar', cerrarFicha: false }
  if (!input.firmasListas) return { tipo: 'firmar' }
  return { tipo: 'cerrar-ficha' }
}
```

Tests:

```ts
expect(ordenGrabadoWebpay({ ambosWebpay: true, numOperacion: null, firmasListas: false }))
  .toEqual({ tipo: 'grabar', cerrarFicha: false })
expect(ordenGrabadoWebpay({ ambosWebpay: true, numOperacion: '940682', firmasListas: false }))
  .toEqual({ tipo: 'firmar' })
expect(ordenGrabadoWebpay({ ambosWebpay: true, numOperacion: '940682', firmasListas: true }))
  .toEqual({ tipo: 'cerrar-ficha' })
expect(ordenGrabadoWebpay({ ambosWebpay: false, numOperacion: null, firmasListas: true }))
  .toEqual({ tipo: 'esperar' })
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/ordenGrabadoWebpay.test.ts`

Expected: FAIL, módulo ausente.

- [ ] **Step 3: Implementar el helper y cablearlo en la vista de firma**

Implementar el helper del paso 1.

En `FirmaAlumnoView.vue`, una función `grabarCuentaWebpay(cerrarFicha: boolean)`:

- Arma los descuentos con `asignarDocumentosDescuento({ peek, lineas: alumnoCtx.lineasBeneficioGrabar, vencimiento, reservadosPagare: 0 })`. El peek es `corrpagnumPreview` del preflight. Si hay líneas con monto mayor que cero y el peek no es solo dígitos, el error es `Faltan los folios de los beneficios` y no se llama al API.
- `contrato` es `contratoPreview` del preflight. Si viene vacío, el error es `Falta el número de contrato`.
- `fechaInicio` es la fecha de hoy en `YYYY-MM-DD`.
- `montoMatricula` es `alumnoCtx.webpayMontoMatricula`. `montoArancel` es `alumnoCtx.webpayMontoArancel`. Esos montos son el saldo antes del 5 %.
- Llama a `armarGrabarCuentaWebpay` y, si `ok`, a `postGrabarPlanPagos`.
- Si la respuesta trae `numOperacion` numérico, `setNumOperacionCuenta` con ese valor.

`ambosWebpay` es `medioMatricula === 'webpay' && webpayMatriculaEstado === 'autorizada' && medioArancel === 'webpay' && webpayArancelEstado === 'autorizada'`.

En `enviarAFirmar`, antes de `ensureContratoFirma`:

```ts
const orden = ordenGrabadoWebpay({
  ambosWebpay,
  numOperacion: numeroOperacionContrato(null, alumnoCtx.numOperacionCuenta),
  firmasListas: false,
})
if (orden.tipo === 'grabar') {
  const grabado = await grabarCuentaWebpay(false)
  if (!grabado) {
    cerrarProgresoError()
    return
  }
}
const vmFirmado = viewModel.value
const res = await ensureContratoFirma({
  ...vmFirmado,
  numOperacion: numeroOperacionContrato(vmFirmado?.numOperacion, alumnoCtx.numOperacionCuenta),
  incluirApoderado,
  emailApoderado,
  codcli,
})
```

Si `numeroOperacionContrato` sigue en `'—'`, no llamar a TuFirma. El error visible es el de la grabación, no el 409 del guion.

En `grabarPlanFirmado`, si `ambosWebpay` y el orden es `cerrar-ficha`, llamar `grabarCuentaWebpay(true)` en vez de `armarGrabarPlanPagos`. Un `already: true` cuenta como éxito y sigue a `completarYNavegar`. Si `ambosWebpay` es false, el cuerpo actual del pagaré no se modifica.

- [ ] **Step 4: Correr los tests de esta tarea y los de las anteriores**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/ordenGrabadoWebpay.test.ts src/utils/grabarCuentaWebpay.test.ts src/utils/numeroOperacionContrato.test.ts src/utils/lineasContratoMedio.test.ts src/utils/lineasBeneficioGrabar.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/ordenGrabadoWebpay.ts src/utils/ordenGrabadoWebpay.test.ts src/views/matricula-alumno/FirmaAlumnoView.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): grabar la tarjeta antes de enviar el contrato a firmar

El PDF sale con el número de operación de U+. Cuando las dos firmas terminan, la segunda llamada solo cierra la ficha.
EOF
)"
```

---

### Task 7: Dejar el cargo por conciliar pendiente, saldo igual al monto y estado 2

**Files:**
- Modify: `/opt/mol-docker/docs/SP a U+/sp_mol_grabar_plan_pagos.sql` (el `INSERT` de `MT_CTADOC` dentro de `cur_web`, cerca de la línea 489)

**Interfaces:**
- Consumes: el cursor `cur_web` ya inserta 809, 810 y 811. No hay otro `CTADOC` de tarjeta en ese `INSERT`.
- Produces: `SALDO` de esas filas igual a `@monto_json` y `ESTADO` en 2. `SALDO_AD` sigue en 0. La boleta 41, en el `INSERT` anterior, no se toca: saldo 0 y estado 1.

- [ ] **Step 1: Cambiar el saldo y el estado del cargo**

En el `VALUES` del `INSERT INTO dbo.MT_CTADOC` del cursor web, hoy `SALDO` es `0` y `ESTADO` es `1`. El cargo queda pendiente de conciliar, así que el saldo es el monto y el estado es 2:

```sql
@ctadoc_json, @ctapagnum, @cuota_json, @numcuot_json, @codcli, @codapod_boleta, @codcarr,
@monto_json, @monto_json, 0, 2, 'S', @contrato, @caja,
```

Actualizar el comentario de cabecera del archivo con una línea: el 809, el 810 y el 811 se insertan con saldo igual al monto y estado 2, porque tesorería los concilia después.

- [ ] **Step 2: Desplegar solo en TEST_UNIACC**

Confirmar `DB_NAME()` = `TEST_UNIACC` en la conexión U+ Test (`g5x_N-odpBHprPK66Iq8p`). Correr el `CREATE OR ALTER` de ese archivo. No ejecutar `dbo.sp_mol_grabar_plan_pagos`. No usar la conexión de producción.

- [ ] **Step 3: Commit en mol-docker**

```bash
git add "docs/SP a U+/sp_mol_grabar_plan_pagos.sql"
git commit -m "$(cat <<'EOF'
fix(rematricula): dejar el cargo por conciliar pendiente en estado 2

El 809, el 810 y el 811 nacen con saldo igual al monto. Tesorería los concilia después. La boleta sigue saldada, en estado 1.
EOF
)"
```

---

## Self-review

- Mandato en el PDF con los dos Webpay: task 1.
- Payload sin pagaré, saldo antes del 5 %, medios `webpay`: task 2.
- Calendario 440/811 y cargos 809/810: los arma `documentosDesdeWebpay`. El saldo igual al monto y el estado 2 de esos cargos son la task 7.
- El SP se toca solo en esa task. No se ejecuta.
- Cuenta antes del PDF y ficha después: tasks 3 y 6.
- Número real en el contrato: tasks 4 y 6.
- Beneficios en `MT_POSBEN` con folio propio, sin reservar dos correlativos de pagaré: task 5, con `reservadosPagare: 0` en la task 6.
- El pagaré existente no cambia de momento ni de payload: `armarGrabarPlanPagos` intacto, `cerrarFicha` por defecto true.
- Sin placeholders. El SP no se redeploya.
