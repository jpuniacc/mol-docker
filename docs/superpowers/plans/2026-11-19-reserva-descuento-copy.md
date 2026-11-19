# Reserva descuento copy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar la reserva de matrícula anticipada como Descuento / Monto / Reservado hasta (no como “matrícula = $50.000”) en todas las pantallas que usan ese aviso.

**Architecture:** Helper puro arma `{ nombre, montoFmt, hasta } | null`. `FormaPagoAlumnoView` lo pasa a CAE y estatal; esos steps renderizan un `<dl>` de 3 filas en la caja emerald.

**Tech Stack:** Vue 3 + TypeScript + Vitest; `fmtMontoDescuento` / `fmtFechaCalendario` existentes.

**Spec:** `docs/superpowers/specs/2026-11-19-reserva-descuento-copy-design.md`

## Global Constraints

- Labels exactos: `Descuento:`, `Monto:`, `Reservado hasta:`
- Monto con formato moneda CLP (`fmtMontoDescuento` → p. ej. `$50.000`)
- Fecha con `fmtFechaCalendario` (mismo criterio que hoy)
- Sin reserva o `hasta === '—'` → `null` (no renderizar caja)
- Sin cambios API/SQL; mock sin este prop → no tocar
- Repo: `/opt/mol-docker`

## File map

| Archivo | Rol |
|---------|-----|
| `src/utils/reservaDescuentoUi.ts` | Helper + tipo |
| `src/utils/reservaDescuentoUi.test.ts` | Unit TDD |
| `src/views/matricula-alumno/FormaPagoAlumnoView.vue` | Computed + props |
| `src/views/matricula-alumno/MatriculaAlumnoVerificacionCaeStep.vue` | Prop + UI |
| `src/views/matricula-alumno/MatriculaAlumnoVerificacionEstatalStep.vue` | Prop + UI |

---

### Task 1: Helper `armarReservaDescuentoUi` (TDD)

**Files:**
- Create: `/opt/mol-docker/src/utils/reservaDescuentoUi.ts`
- Create: `/opt/mol-docker/src/utils/reservaDescuentoUi.test.ts`

**Interfaces:**
- Consumes: `fmtFechaCalendario`, `fmtMontoDescuento` from `@/services/descuentoMatriculaAnticipada`
- Produces:
  - `export type ReservaDescuentoUi = { nombre: string; montoFmt: string; hasta: string }`
  - `export function armarReservaDescuentoUi(input: { nombre: string; monto: number; reservaHasta: string | null | undefined }): ReservaDescuentoUi | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { armarReservaDescuentoUi } from '@/utils/reservaDescuentoUi'

describe('armarReservaDescuentoUi', () => {
  it('arma las tres líneas con monto como descuento', () => {
    const r = armarReservaDescuentoUi({
      nombre: 'Matricula Anticipada Noviembre',
      monto: 50000,
      reservaHasta: '2027-01-31',
    })
    expect(r).not.toBeNull()
    expect(r?.nombre).toBe('Matricula Anticipada Noviembre')
    expect(r?.montoFmt).toMatch(/50\.?000/)
    expect(r?.hasta).not.toBe('—')
    expect(r?.hasta.length).toBeGreaterThan(0)
  })

  it('retorna null si falta nombre o monto inválido', () => {
    expect(
      armarReservaDescuentoUi({ nombre: '', monto: 50000, reservaHasta: '2027-01-31' }),
    ).toBeNull()
    expect(
      armarReservaDescuentoUi({
        nombre: 'X',
        monto: Number.NaN,
        reservaHasta: '2027-01-31',
      }),
    ).toBeNull()
  })

  it('retorna null si reserva_hasta no es usable', () => {
    expect(
      armarReservaDescuentoUi({
        nombre: 'Matricula Anticipada Noviembre',
        monto: 50000,
        reservaHasta: null,
      }),
    ).toBeNull()
    expect(
      armarReservaDescuentoUi({
        nombre: 'Matricula Anticipada Noviembre',
        monto: 50000,
        reservaHasta: '',
      }),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/mol-docker && npm run test:unit -- --run src/utils/reservaDescuentoUi.test.ts`  
Expected: FAIL (módulo / función ausente)

- [ ] **Step 3: Write minimal implementation**

```ts
import {
  fmtFechaCalendario,
  fmtMontoDescuento,
} from '@/services/descuentoMatriculaAnticipada'

export type ReservaDescuentoUi = {
  nombre: string
  montoFmt: string
  hasta: string
}

export function armarReservaDescuentoUi(input: {
  nombre: string
  monto: number
  reservaHasta: string | null | undefined
}): ReservaDescuentoUi | null {
  const nombre = input.nombre.trim()
  if (!nombre) return null
  if (!Number.isFinite(input.monto)) return null
  const hasta = fmtFechaCalendario(input.reservaHasta)
  if (hasta === '—') return null
  const montoFmt = fmtMontoDescuento(input.monto)
  if (montoFmt === '—') return null
  return { nombre, montoFmt, hasta }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/mol-docker && npm run test:unit -- --run src/utils/reservaDescuentoUi.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /opt/mol-docker
git add src/utils/reservaDescuentoUi.ts src/utils/reservaDescuentoUi.test.ts
git commit -m "$(cat <<'EOF'
feat(rematricula): helper UI reserva descuento etiquetada

Arma nombre/montoFmt/hasta para dejar claro que el valor es descuento.
EOF
)"
```

---

### Task 2: Cablear FormaPago + CAE + estatal

**Files:**
- Modify: `/opt/mol-docker/src/views/matricula-alumno/FormaPagoAlumnoView.vue` (`textoReservaMatricula` ~731–738 y props `:reserva-texto` ~2027, ~2051)
- Modify: `/opt/mol-docker/src/views/matricula-alumno/MatriculaAlumnoVerificacionCaeStep.vue`
- Modify: `/opt/mol-docker/src/views/matricula-alumno/MatriculaAlumnoVerificacionEstatalStep.vue`

**Interfaces:**
- Consumes: `armarReservaDescuentoUi`, `ReservaDescuentoUi` from `@/utils/reservaDescuentoUi`
- Produces: prop `reservaDescuento?: ReservaDescuentoUi | null` en ambos steps

- [ ] **Step 1: Update CAE step prop + template**

En `MatriculaAlumnoVerificacionCaeStep.vue`:

- Quitar `reservaTexto?: string | null`
- Agregar `reservaDescuento?: ReservaDescuentoUi | null` (import type)
- Reemplazar el `<p v-if="reservaTexto">…</p>` por:

```vue
          <div
            v-if="reservaDescuento"
            class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            <dl class="space-y-1">
              <div class="flex flex-wrap gap-x-2">
                <dt class="font-medium">Descuento:</dt>
                <dd>{{ reservaDescuento.nombre }}</dd>
              </div>
              <div class="flex flex-wrap gap-x-2">
                <dt class="font-medium">Monto:</dt>
                <dd>{{ reservaDescuento.montoFmt }}</dd>
              </div>
              <div class="flex flex-wrap gap-x-2">
                <dt class="font-medium">Reservado hasta:</dt>
                <dd>{{ reservaDescuento.hasta }}</dd>
              </div>
            </dl>
          </div>
```

Same change in `MatriculaAlumnoVerificacionEstatalStep.vue`.

- [ ] **Step 2: Update FormaPagoAlumnoView**

Import `armarReservaDescuentoUi`. Replace computed:

```ts
const reservaDescuentoMatricula = computed(() => {
  const descuento = descuentoMatriculaMes.value
  const reserva = reservaMatricula.value
  if (!descuento || !reserva) return null
  const fila = descuentosMatriculaCatalogo.value.find((item) => item.id === reserva.descuentoId)
  return armarReservaDescuentoUi({
    nombre: descuento.nombre,
    monto: descuento.monto,
    reservaHasta: fila?.reserva_hasta,
  })
})
```

Replace bindings:

```vue
:reserva-descuento="reservaDescuentoMatricula"
```

Remove `textoReservaMatricula` and any unused `fmt` only-if-sole-use for that string (keep `fmt` if still used elsewhere in the file).

- [ ] **Step 3: Type-check / unit tests**

Run:

```bash
cd /opt/mol-docker && npm run test:unit -- --run src/utils/reservaDescuentoUi.test.ts
cd /opt/mol-docker && npm run type-check
```

Expected: tests PASS; type-check PASS (or only pre-existing unrelated errors — if new errors on these files, fix).

- [ ] **Step 4: Commit**

```bash
cd /opt/mol-docker
git add \
  src/views/matricula-alumno/FormaPagoAlumnoView.vue \
  src/views/matricula-alumno/MatriculaAlumnoVerificacionCaeStep.vue \
  src/views/matricula-alumno/MatriculaAlumnoVerificacionEstatalStep.vue
git commit -m "$(cat <<'EOF'
fix(rematricula): caja verde reserva como Descuento/Monto/Hasta

Evita que el alumno confunda el monto del descuento con el valor de matrícula.
EOF
)"
```

---

### Task 3: Merge push + deploy uniacc-mol

**Files:** none (ops)

- [ ] **Step 1: Merge qa/main and push**

```bash
cd /opt/mol-docker
git checkout qa && git merge --ff-only dev
git checkout main && git merge --ff-only qa
git checkout dev
git push origin dev qa main
```

- [ ] **Step 2: Rebuild / copy front to uniacc-mol**

Usar el flujo habitual del proyecto (docker compose build del servicio `mol` / `mol-dev` y rsync o rebuild en `uniacc-mol` bajo `/opt/mol-docker`). Confirmar que el contenedor front reinicia.

Si el deploy habitual es:

```bash
cd /opt/mol-docker && docker compose build && docker compose up -d
# y en prod:
rsync -avz --exclude node_modules --exclude .git /opt/mol-docker/ uniacc-mol:/opt/mol-docker/
ssh uniacc-mol 'cd /opt/mol-docker && docker compose build && docker compose up -d'
```

ajustar a lo que ya use el equipo (no inventar compose service names; inspeccionar `docker compose ps` / `docker-compose.yml` antes).

- [ ] **Step 3: Smoke**

Con un caso en espera CAE/estatal con reserva: la caja verde muestra las 3 líneas. Sin reserva: caja ausente.

- [ ] **Step 4: Report**

Anotar en el mensaje final: commits, URLs de ramas, confirmación deploy.

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| 3 líneas Descuento/Monto/Reservado hasta | 1–2 |
| Alcance CAE + estatal | 2 |
| null sin reserva/hasta | 1 |
| Tests helper | 1 |
| Rollout front | 3 |
| Sin API/SQL/mock | Global |
