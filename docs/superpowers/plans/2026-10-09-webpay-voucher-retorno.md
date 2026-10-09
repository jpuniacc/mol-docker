# Voucher al volver de Webpay — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al volver de Transbank, un modal muestra el voucher de esa autorización y solo Continuar sigue al próximo pago o al contrato. Si fue aprobada, se puede descargar el mismo voucher en PDF.

**Architecture:** `armarVoucherWebpay` convierte la fila pública que el retorno ya consulta en título, líneas, nombre de archivo y si se puede descargar. El PDF dibuja esas líneas en una hoja A4 con jsPDF. La pantalla de retorno deja de avanzar sola y muestra un diálogo sin X que no se cierra al tocar afuera.

**Tech Stack:** Vue 3, TypeScript, Vitest (`vitest.unit.config.ts`), jsPDF 4 y radix-vue en `/opt/mol-docker`. No hay cambio de API.

**Spec de origen:** `docs/superpowers/specs/2026-10-09-webpay-voucher-retorno-design.md`

## Global Constraints

- Un modal por autorización. Si matrícula y arancel son Webpay, el de matrícula aparece primero. Continuar abre el pago del arancel. El segundo Continuar sigue el avance que ya existe.
- El modal no se cierra con la X ni al tocar afuera ni con Escape. Solo avanza uno de sus botones.
- Aprobada: título «Tu transacción fue aprobada», botones Descargar voucher y Continuar.
- Rechazada: título «Tu transacción fue rechazada». Anulada: «Tu transacción fue anulada». Ninguna de las dos se descarga. El botón es «Volver a forma de pago».
- Si el resultado no se lee, o el estado es `creada`, no hay modal. Queda la pantalla actual.
- Refrescar el retorno vuelve a mostrar el voucher de esa orden. Continuar no cobra de nuevo.
- Si Continuar no abre el siguiente pago, el modal permanece, se muestra el aviso que ya existe y aparece «Volver a forma de pago».
- Líneas, en orden: Concepto, Fecha y hora, Código de autorización, Monto, Tipo de tarjeta, Tarjeta, Cuotas.
- Fecha en `America/Santiago`, `dd-mm-aaaa hh:mm`. Monto con separador de miles y sin decimales. Dato ausente: «—».
- `VD` y `VP` son Débito y no llevan línea de cuotas. `VN`, `VC`, `SI`, `S2` y `NC` son Crédito. Cuotas vacías o menores que 2: «1 cuota». 2 o más: «6 cuotas». Otro código: tipo y cuotas en «—», y la línea de cuotas sí aparece.
- Tarjeta: `•••• 7763`. El PDF es A4, igual en teléfono y escritorio, y solo existe si `descargable` es true. Nombre: `voucher-matricula-1415.pdf` o `voucher-arancel-1819.pdf`. Sin código, se usa la orden de compra.
- Descargar no navega. Si el PDF falla, toast y el modal sigue abierto.
- El modal cabe en 375, 768 y 1024 px: ancho casi completo en el teléfono, `max-w-lg` centrado desde ahí, sin scroll horizontal. En una ventana baja, título y botones fijos y líneas con scroll interno. En 375 px los botones van en columna, Descargar arriba. Desde 768 px, en fila, Continuar a la derecha.
- No se cambia el selector de forma de pago, el resumen de felicitaciones ni la cuenta en U+. No hay endpoint nuevo. No se muestra la marca de la tarjeta.

---

### Task 1: Armar el voucher

**Files:**
- Create: `src/utils/voucherWebpay.ts`
- Test: `src/utils/voucherWebpay.test.ts`

**Interfaces:**
- Consumes: `FilaPublica` de `src/services/webpayPlusApi.ts` (`estado`, `concepto`, `monto`, `authorizationCode`, `paymentTypeCode`, `installmentsNumber`, `cardLast4`, `transactionDate`, `buyOrder`).
- Produces:

```ts
export type LineaVoucher = { etiqueta: string; valor: string }

export type VoucherWebpay = {
  titulo: string
  descargable: boolean
  nombreArchivo: string
  lineas: LineaVoucher[]
}

export function armarVoucherWebpay(fila: FilaPublica): VoucherWebpay | null
```

`null` solo cuando `estado` es `creada`.

- [ ] **Step 1: Write the failing test**

Crear `src/utils/voucherWebpay.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { FilaPublica } from '@/services/webpayPlusApi'
import { armarVoucherWebpay } from '@/utils/voucherWebpay'

function fila(parcial: Partial<FilaPublica>): FilaPublica {
  return {
    buyOrder: '197407692027-1-15',
    sessionId: 's',
    concepto: 'matricula',
    codcli: '19740769',
    anioPeriodo: 2027,
    semestrePeriodo: 1,
    correlativo: 15,
    monto: 250000,
    estado: 'autorizada',
    authorizationCode: '1415',
    responseCode: 0,
    paymentTypeCode: 'VD',
    installmentsNumber: 0,
    cardLast4: '7763',
    transactionDate: '2026-10-08T20:40:00.000Z',
    ambiente: 'integracion',
    ...parcial,
  }
}

function valor(lineas: { etiqueta: string; valor: string }[], etiqueta: string): string | undefined {
  return lineas.find((l) => l.etiqueta === etiqueta)?.valor
}

describe('armarVoucherWebpay', () => {
  it('arma el débito aprobado de matrícula', () => {
    const voucher = armarVoucherWebpay(fila({}))
    expect(voucher).toMatchObject({
      titulo: 'Tu transacción fue aprobada',
      descargable: true,
      nombreArchivo: 'voucher-matricula-1415.pdf',
    })
    expect(voucher?.lineas.map((l) => l.etiqueta)).toEqual([
      'Concepto',
      'Fecha y hora',
      'Código de autorización',
      'Monto',
      'Tipo de tarjeta',
      'Tarjeta',
    ])
    expect(valor(voucher!.lineas, 'Concepto')).toBe('Matrícula')
    expect(valor(voucher!.lineas, 'Fecha y hora')).toBe('08-10-2026 17:40')
    expect(valor(voucher!.lineas, 'Código de autorización')).toBe('1415')
    expect(valor(voucher!.lineas, 'Monto')).toBe('250.000')
    expect(valor(voucher!.lineas, 'Tipo de tarjeta')).toBe('Débito')
    expect(valor(voucher!.lineas, 'Tarjeta')).toBe('•••• 7763')
  })

  it('trata el prepago como débito y sin cuotas', () => {
    const voucher = armarVoucherWebpay(fila({ paymentTypeCode: 'VP' }))
    expect(valor(voucher!.lineas, 'Tipo de tarjeta')).toBe('Débito')
    expect(voucher!.lineas.some((l) => l.etiqueta === 'Cuotas')).toBe(false)
  })

  it('el crédito de una cuota dice 1 cuota', () => {
    const voucher = armarVoucherWebpay(
      fila({ paymentTypeCode: 'VN', installmentsNumber: 0, concepto: 'arancel', monto: 3933000, authorizationCode: '1819' }),
    )
    expect(voucher?.nombreArchivo).toBe('voucher-arancel-1819.pdf')
    expect(valor(voucher!.lineas, 'Concepto')).toBe('Arancel')
    expect(valor(voucher!.lineas, 'Monto')).toBe('3.933.000')
    expect(valor(voucher!.lineas, 'Tipo de tarjeta')).toBe('Crédito')
    expect(valor(voucher!.lineas, 'Cuotas')).toBe('1 cuota')
  })

  it('el crédito de varias cuotas dice el número', () => {
    const voucher = armarVoucherWebpay(fila({ paymentTypeCode: 'VC', installmentsNumber: 6 }))
    expect(valor(voucher!.lineas, 'Cuotas')).toBe('6 cuotas')
  })

  it('el rechazo no se descarga y usa raya donde falta el dato', () => {
    const voucher = armarVoucherWebpay(
      fila({
        estado: 'rechazada',
        authorizationCode: '  ',
        transactionDate: null,
        cardLast4: null,
        paymentTypeCode: null,
      }),
    )
    expect(voucher).toMatchObject({
      titulo: 'Tu transacción fue rechazada',
      descargable: false,
      nombreArchivo: 'voucher-matricula-197407692027-1-15.pdf',
    })
    expect(valor(voucher!.lineas, 'Código de autorización')).toBe('—')
    expect(valor(voucher!.lineas, 'Fecha y hora')).toBe('—')
    expect(valor(voucher!.lineas, 'Tarjeta')).toBe('—')
    expect(valor(voucher!.lineas, 'Tipo de tarjeta')).toBe('—')
    expect(valor(voucher!.lineas, 'Cuotas')).toBe('—')
    expect(valor(voucher!.lineas, 'Monto')).toBe('250.000')
    expect(valor(voucher!.lineas, 'Concepto')).toBe('Matrícula')
  })

  it('la anulación tiene su título', () => {
    const voucher = armarVoucherWebpay(fila({ estado: 'abortada', paymentTypeCode: 'VD' }))
    expect(voucher?.titulo).toBe('Tu transacción fue anulada')
    expect(voucher?.descargable).toBe(false)
    expect(voucher?.lineas.some((l) => l.etiqueta === 'Cuotas')).toBe(false)
  })

  it('un tipo desconocido deja tipo y cuotas en raya', () => {
    const voucher = armarVoucherWebpay(fila({ paymentTypeCode: 'XX' }))
    expect(valor(voucher!.lineas, 'Tipo de tarjeta')).toBe('—')
    expect(valor(voucher!.lineas, 'Cuotas')).toBe('—')
  })

  it('una transacción creada no arma voucher', () => {
    expect(armarVoucherWebpay(fila({ estado: 'creada' }))).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/voucherWebpay.test.ts`

Expected: FAIL. No encuentra `@/utils/voucherWebpay`.

- [ ] **Step 3: Write minimal implementation**

Crear `src/utils/voucherWebpay.ts`:

```ts
import type { FilaPublica } from '@/services/webpayPlusApi'

export type LineaVoucher = { etiqueta: string; valor: string }

export type VoucherWebpay = {
  titulo: string
  descargable: boolean
  nombreArchivo: string
  lineas: LineaVoucher[]
}

const RAYA = '—'
const DEBITO = new Set(['VD', 'VP'])
const CREDITO = new Set(['VN', 'VC', 'SI', 'S2', 'NC'])

function texto(valor: string | null): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function fechaHoraChile(iso: string | null): string {
  const crudo = texto(iso)
  if (!crudo) return RAYA
  const fecha = new Date(crudo)
  if (Number.isNaN(fecha.getTime())) return RAYA
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha)
  const leer = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((p) => p.type === tipo)?.value ?? ''
  return `${leer('day')}-${leer('month')}-${leer('year')} ${leer('hour')}:${leer('minute')}`
}

function montoCl(monto: number): string {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(monto)
}

function ultimos4(cardLast4: string | null): string {
  const digitos = texto(cardLast4).replace(/\D/g, '')
  if (digitos.length < 4) return RAYA
  return `•••• ${digitos.slice(-4)}`
}

function tituloDe(estado: FilaPublica['estado']): string {
  if (estado === 'rechazada') return 'Tu transacción fue rechazada'
  if (estado === 'abortada') return 'Tu transacción fue anulada'
  return 'Tu transacción fue aprobada'
}

export function armarVoucherWebpay(fila: FilaPublica): VoucherWebpay | null {
  if (fila.estado === 'creada') return null
  const tipo = texto(fila.paymentTypeCode).toUpperCase()
  const debito = DEBITO.has(tipo)
  const credito = CREDITO.has(tipo)
  const autorizacion = texto(fila.authorizationCode)
  const lineas: LineaVoucher[] = [
    { etiqueta: 'Concepto', valor: fila.concepto === 'matricula' ? 'Matrícula' : 'Arancel' },
    { etiqueta: 'Fecha y hora', valor: fechaHoraChile(fila.transactionDate) },
    { etiqueta: 'Código de autorización', valor: autorizacion || RAYA },
    { etiqueta: 'Monto', valor: montoCl(fila.monto) },
    { etiqueta: 'Tipo de tarjeta', valor: debito ? 'Débito' : credito ? 'Crédito' : RAYA },
    { etiqueta: 'Tarjeta', valor: ultimos4(fila.cardLast4) },
  ]
  if (!debito) {
    const cuotas =
      !credito
        ? RAYA
        : fila.installmentsNumber == null || fila.installmentsNumber < 2
          ? '1 cuota'
          : `${Math.trunc(fila.installmentsNumber)} cuotas`
    lineas.push({ etiqueta: 'Cuotas', valor: cuotas })
  }
  const nombre = autorizacion || fila.buyOrder.trim()
  return {
    titulo: tituloDe(fila.estado),
    descargable: fila.estado === 'autorizada',
    nombreArchivo: `voucher-${fila.concepto}-${nombre}.pdf`,
    lineas,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/voucherWebpay.test.ts`

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/voucherWebpay.ts src/utils/voucherWebpay.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): armar el voucher de una autorización Webpay

EOF
)"
```

---

### Task 2: PDF del voucher

**Files:**
- Create: `src/utils/voucherWebpayPdf.ts`
- Test: `src/utils/voucherWebpayPdf.test.ts`
- Modify: ninguno. Reutiliza `downloadBlob` de `src/utils/planPagoPdf.ts`.

**Interfaces:**
- Consumes: `VoucherWebpay` de `src/utils/voucherWebpay.ts`.
- Produces:

```ts
export function bytesVoucherWebpay(voucher: VoucherWebpay): Uint8Array
export function descargarVoucherWebpay(voucher: VoucherWebpay): void
```

`descargarVoucherWebpay` no hace nada si `descargable` es false. Si no, llama `downloadBlob(bytes, voucher.nombreArchivo)`.

- [ ] **Step 1: Write the failing test**

Crear `src/utils/voucherWebpayPdf.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { VoucherWebpay } from '@/utils/voucherWebpay'
import { bytesVoucherWebpay } from '@/utils/voucherWebpayPdf'

const voucher: VoucherWebpay = {
  titulo: 'Tu transacción fue aprobada',
  descargable: true,
  nombreArchivo: 'voucher-matricula-1415.pdf',
  lineas: [
    { etiqueta: 'Concepto', valor: 'Matrícula' },
    { etiqueta: 'Monto', valor: '250.000' },
  ],
}

describe('bytesVoucherWebpay', () => {
  it('devuelve un PDF A4', () => {
    const bytes = bytesVoucherWebpay(voucher)
    expect(bytes[0]).toBe(0x25)
    expect(bytes[1]).toBe(0x50)
    expect(bytes[2]).toBe(0x44)
    expect(bytes[3]).toBe(0x46)
    expect(bytes.byteLength).toBeGreaterThan(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/voucherWebpayPdf.test.ts`

Expected: FAIL. No encuentra `@/utils/voucherWebpayPdf`.

- [ ] **Step 3: Write minimal implementation**

Crear `src/utils/voucherWebpayPdf.ts`:

```ts
import { jsPDF } from 'jspdf'

import { downloadBlob } from '@/utils/planPagoPdf'
import type { VoucherWebpay } from '@/utils/voucherWebpay'

export function bytesVoucherWebpay(voucher: VoucherWebpay): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margen = 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(voucher.titulo, margen, 28)
  doc.setFontSize(11)
  let y = 42
  for (const linea of voucher.lineas) {
    doc.setFont('helvetica', 'normal')
    doc.text(linea.etiqueta, margen, y)
    doc.setFont('helvetica', 'bold')
    const valor = doc.splitTextToSize(linea.valor, 110) as string[]
    doc.text(valor, 200 - margen, y, { align: 'right' })
    y += 8 + (valor.length - 1) * 5
  }
  return new Uint8Array(doc.output('arraybuffer'))
}

export function descargarVoucherWebpay(voucher: VoucherWebpay): void {
  if (!voucher.descargable) return
  downloadBlob(bytesVoucherWebpay(voucher), voucher.nombreArchivo)
}
```

jsPDF trae Helvetica. No hace falta una fuente con acentos para que el archivo sea un PDF. Los títulos y las etiquetas con tilde se escriben igual: Helvetica estándar las dibuja. No agregar una fuente nueva.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/voucherWebpayPdf.test.ts src/utils/voucherWebpay.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/voucherWebpayPdf.ts src/utils/voucherWebpayPdf.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): descargar el voucher Webpay en PDF

EOF
)"
```

---

### Task 3: Modal en el retorno

**Files:**
- Create: `src/components/matricula/VoucherWebpayDialog.vue`
- Modify: `src/views/matricula-alumno/WebpayRetornoAlumnoView.vue`

**Interfaces:**
- Consumes: `armarVoucherWebpay` y `VoucherWebpay` de `src/utils/voucherWebpay.ts`. `descargarVoucherWebpay` de `src/utils/voucherWebpayPdf.ts`. `avanzarSiAutorizada` e `irAFormaPago`, que ya están en la vista.
- Produces: el diálogo emite `continuar`, `volver` y `descargar`. No navega.

El componente de diálogo del diseño (`src/components/ui/dialog/DialogContent.vue`) siempre pinta una X. Este diálogo no lo usa. Usa `Dialog` de `@/components/ui/dialog` y `DialogPortal`, `DialogOverlay` y `DialogContent` de `radix-vue`.

- [ ] **Step 1: Write the dialog**

Crear `src/components/matricula/VoucherWebpayDialog.vue`:

```vue
<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal } from 'radix-vue'

import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { VoucherWebpay } from '@/utils/voucherWebpay'

defineProps<{
  voucher: VoucherWebpay
  mostrarVolver: boolean
}>()

const emit = defineEmits<{
  continuar: []
  volver: []
  descargar: []
}>()

function frenar(evento: { preventDefault: () => void }): void {
  evento.preventDefault()
}
</script>

<template>
  <Dialog :open="true">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/80" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden border bg-background p-4 shadow-lg sm:p-6"
        @pointer-down-outside="frenar"
        @interact-outside="frenar"
        @escape-key-down="frenar"
      >
        <h2 class="shrink-0 pr-2 text-xl font-semibold text-zinc-900">
          {{ voucher.titulo }}
        </h2>
        <dl class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div
            v-for="linea in voucher.lineas"
            :key="linea.etiqueta"
            class="flex flex-col gap-0.5 border-b border-zinc-200 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
          >
            <dt class="text-sm text-zinc-700">{{ linea.etiqueta }}</dt>
            <dd class="break-words text-sm font-medium text-zinc-900 sm:text-right">
              {{ linea.valor }}
            </dd>
          </div>
        </dl>
        <div class="flex shrink-0 flex-col gap-2 md:flex-row md:justify-end">
          <Button
            v-if="voucher.descargable"
            type="button"
            variant="outline"
            class="w-full cursor-pointer md:w-auto"
            @click="emit('descargar')"
          >
            Descargar voucher
          </Button>
          <Button
            v-if="voucher.descargable"
            type="button"
            class="w-full cursor-pointer rounded-full bg-uniacc-orange hover:bg-uniacc-orange/90 md:w-auto"
            @click="emit('continuar')"
          >
            Continuar
          </Button>
          <Button
            v-if="!voucher.descargable || mostrarVolver"
            type="button"
            class="w-full cursor-pointer rounded-full bg-uniacc-orange hover:bg-uniacc-orange/90 md:w-auto"
            @click="emit('volver')"
          >
            Volver a forma de pago
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>
```

- [ ] **Step 2: Stop the automatic advance**

En `src/views/matricula-alumno/WebpayRetornoAlumnoView.vue`, agregar los imports:

```ts
import VoucherWebpayDialog from '@/components/matricula/VoucherWebpayDialog.vue'
import { armarVoucherWebpay, type VoucherWebpay } from '@/utils/voucherWebpay'
import { descargarVoucherWebpay } from '@/utils/voucherWebpayPdf'
```

Agregar el estado, junto a `redirigiendo`:

```ts
const voucher = ref<VoucherWebpay | null>(null)
const filaVoucher = ref<FilaPublica | null>(null)
const continuarFallido = ref(false)
```

Reemplazar el tramo de `onMounted` que hoy, después de `guardarEstadoConcepto(fila)`, manda al rechazo a forma de pago y a la aprobada a `avanzarSiAutorizada`. Queda así:

```ts
  guardarEstadoConcepto(fila)

  const armado = armarVoucherWebpay(fila)
  if (!armado) {
    mensaje.value = 'No pudimos leer el resultado del pago.'
    mostrarReintentar.value = true
    cargando.value = false
    return
  }

  filaVoucher.value = fila
  voucher.value = armado
  cargando.value = false
```

El caso `error === 'retorno-invalido'`, el caso sin `buyOrder` y el caso sin fila no cambian. No abren el modal.

Agregar estas funciones en el script:

```ts
function alDescargar(): void {
  if (!voucher.value) return
  try {
    descargarVoucherWebpay(voucher.value)
  } catch {
    toast.error('No se pudo descargar el voucher.')
  }
}

async function alContinuar(): Promise<void> {
  if (!filaVoucher.value) return
  await avanzarSiAutorizada(filaVoucher.value)
  if (mostrarReintentar.value) continuarFallido.value = true
}

function alVolver(): void {
  const estado = filaVoucher.value?.estado
  const aviso = estado === 'rechazada' || estado === 'abortada' ? estado : undefined
  irAFormaPago(undefined, aviso)
}
```

En el template, después del `Card`, agregar:

```vue
<VoucherWebpayDialog
  v-if="voucher"
  :voucher="voucher"
  :mostrar-volver="continuarFallido"
  @descargar="alDescargar"
  @continuar="alContinuar"
  @volver="alVolver"
/>
```

No borrar `avanzarSiAutorizada` ni `irAFormaPago`. Continuar y Volver los llaman.

- [ ] **Step 3: Run the unit tests**

Run: `npx vitest run --config vitest.unit.config.ts src/utils/voucherWebpay.test.ts src/utils/voucherWebpayPdf.test.ts`

Expected: PASS. Esta tarea no agrega una prueba de Vue. El comportamiento de no avanzar solo está en la vista, y la función ya devuelve `null` para `creada`.

- [ ] **Step 4: Check the modal in the browser**

Con la app de rematrícula abierta, revisar el diálogo en 375, 768 y 1024 px de ancho, y en una ventana baja:

- No hay X. Tocar afuera y pulsar Escape no lo cierran.
- No aparece scroll horizontal.
- En 375 px los botones van uno bajo el otro. Descargar queda arriba de Continuar.
- Desde 768 px, Continuar queda a la derecha.
- En una ventana baja, el título y los botones siguen visibles y las líneas se desplazan por dentro.
- Un valor largo parte en otra línea y no se sale del cuadro.

No hace falta un cobro real para este paso si no hay una sesión de prueba. Si la hay, un débito aprobado debe mostrar el voucher y quedarse ahí hasta Continuar.

- [ ] **Step 5: Commit**

```bash
git add src/components/matricula/VoucherWebpayDialog.vue src/views/matricula-alumno/WebpayRetornoAlumnoView.vue
git commit -m "$(cat <<'EOF'
feat(rematricula): mostrar el voucher antes de seguir después de Webpay

EOF
)"
```
