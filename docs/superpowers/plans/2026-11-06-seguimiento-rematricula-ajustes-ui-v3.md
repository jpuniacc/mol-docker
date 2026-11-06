# Seguimiento rematrícula — ajustes UI v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinear la bandeja CORTE 1 al wireframe v3 (chips numerados, auxiliares display, cartera select, panel overlay) solo en front mol-dev.

**Architecture:** Extender utils de chip/subetapa/color; retocar `BandejaSeguimientoRematriculaView.vue`. Sin API, sin migraciones, sin `filtroAux` nuevo.

**Tech Stack:** Vue 3 + TypeScript + Tailwind + shadcn-vue (Select, Button, Dialog) · Vitest/node test utils existentes.

**Spec:** `docs/superpowers/specs/2026-11-06-seguimiento-rematricula-ajustes-ui-v3-design.md` (aprobado + 3 matices).

## Global Constraints

- Solo front `mol-docker`; rama `dev`; deploy smoke en **mol-dev** (no prod).
- No tocar criterios de chips, `alcanceCartera`, migraciones, controllers API.
- +7d, Mail 2h, SMS 24h: **pills visibles sin filtrar**.
- Select ejecutivo: hint *«Ejecutivos en la carga actual»*.
- Overlay: cerrar con click fondo **y Escape**.
- Naranja `#FF5B00`, navy `#1E3A5F`.

---

### Task 1: Utils — número chip, color etapa, subetapa humanizada

**Files:**
- Modify: `src/utils/seguimientoBandejaChip.ts`
- Modify: `src/utils/seguimientoBandejaChip.test.ts`
- Create (opcional si cabe en el mismo archivo): helpers exportados abajo

**Interfaces:**
- Produces:
  - `numeroChipBandeja(chip: ChipBandeja): number` → 1..8 según `ORDEN_CHIPS_BANDEJA`
  - `colorEtapaChip(chip: ChipBandeja): { bg: string; text: string; border: string }`
  - `etiquetaSubetapaFormaPago(v: 'cae' | 'ministerial' | 'ambos' | 'resto' | null | undefined): string`
  - `ETIQUETA_CHIP_BANDEJA_CORTA` (opcional; si labels actuales ya son cortos, reutilizar `ETIQUETA_CHIP_BANDEJA`)

- [ ] **Step 1: Test fallido** — en `seguimientoBandejaChip.test.ts` agregar:

```ts
import {
  numeroChipBandeja,
  colorEtapaChip,
  etiquetaSubetapaFormaPago,
  ORDEN_CHIPS_BANDEJA,
} from './seguimientoBandejaChip'

it('numera chips 1–8 en orden wireframe', () => {
  ORDEN_CHIPS_BANDEJA.forEach((chip, i) => {
    expect(numeroChipBandeja(chip)).toBe(i + 1)
  })
})

it('humaniza subetapa forma de pago', () => {
  expect(etiquetaSubetapaFormaPago('cae')).toBe('CAE')
  expect(etiquetaSubetapaFormaPago('ministerial')).toBe('Beneficio min.')
  expect(etiquetaSubetapaFormaPago('ambos')).toBe('Ambos')
  expect(etiquetaSubetapaFormaPago('resto')).toBe('Resto')
  expect(etiquetaSubetapaFormaPago(null)).toBe('—')
})

it('colorEtapaChip distingue forma_pago de ingreso', () => {
  expect(colorEtapaChip('forma_pago').bg).not.toBe(colorEtapaChip('ingreso').bg)
})
```

- [ ] **Step 2: Correr test y ver fallo**

```bash
cd /opt/mol-docker && yarn vitest run src/utils/seguimientoBandejaChip.test.ts
```

Expected: FAIL (exports missing).

- [ ] **Step 3: Implementar helpers** en `seguimientoBandejaChip.ts`:

```ts
export function numeroChipBandeja(chip: ChipBandeja): number {
  const i = ORDEN_CHIPS_BANDEJA.indexOf(chip)
  return i >= 0 ? i + 1 : 0
}

const COLOR_ETAPA: Record<ChipBandeja, { bg: string; text: string; border: string }> = {
  sin_ingreso: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  ingreso: { bg: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-200' },
  tyc: { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
  datos: { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' },
  forma_pago: { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200' },
  contrato_pdte: { bg: 'bg-orange-50', text: 'text-[#FF5B00]', border: 'border-orange-200' },
  firmado_pdte_u: { bg: 'bg-lime-50', text: 'text-lime-800', border: 'border-lime-200' },
  matriculado: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
}

export function colorEtapaChip(chip: ChipBandeja) {
  return COLOR_ETAPA[chip]
}

export function etiquetaSubetapaFormaPago(
  v: 'cae' | 'ministerial' | 'ambos' | 'resto' | null | undefined,
): string {
  if (v === 'cae') return 'CAE'
  if (v === 'ministerial') return 'Beneficio min.'
  if (v === 'ambos') return 'Ambos'
  if (v === 'resto') return 'Resto'
  return '—'
}
```

- [ ] **Step 4: Tests pasan**

```bash
cd /opt/mol-docker && yarn vitest run src/utils/seguimientoBandejaChip.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/seguimientoBandejaChip.ts src/utils/seguimientoBandejaChip.test.ts
git commit -m "feat(seguimiento): utils chip número, color etapa y subetapa UI v3"
```

---

### Task 2: Bandeja — chips, auxiliares, cartera, tabla

**Files:**
- Modify: `src/views/dashboard/rematricula/BandejaSeguimientoRematriculaView.vue`
- Consumes: `numeroChipBandeja`, `colorEtapaChip`, `etiquetaSubetapaFormaPago`, `ETIQUETA_CHIP_BANDEJA`, `alcanceCartera`

- [ ] **Step 1: Chips numerados** — en el `v-for` de chips, mostrar `{{ numeroChipBandeja(chip) }}. {{ ETIQUETA_CHIP_BANDEJA[chip] }}`; activo `border-[#FF5B00] ring-2 ring-[#FF5B00]/30`; inactivo `border-[#1E3A5F]/20`.

- [ ] **Step 2: Auxiliares display-only** — reemplazar bloque KPI mail/sms + quitar debug outbox:

```vue
<div v-if="kpi" class="flex flex-wrap gap-2 text-sm">
  <span class="rounded-full border border-orange-200 bg-orange-50 px-3 py-1">
    Sin contactar +7d —
  </span>
  <span class="rounded-full border border-zinc-200 bg-white px-3 py-1">
    Mail 2h pdte {{ kpi.mail_2h_pdte }}
  </span>
  <span class="rounded-full border border-zinc-200 bg-white px-3 py-1">
    Mail 2h enviado {{ kpi.mail_2h_enviado }}
  </span>
  <span class="rounded-full border border-zinc-200 bg-white px-3 py-1">
    SMS 24h pdte {{ kpi.sms_24h_pdte }}
  </span>
  <span class="rounded-full border border-zinc-200 bg-white px-3 py-1">
    SMS 24h enviado {{ kpi.sms_24h_enviado }}
  </span>
</div>
```

No `@click` que filtre. No añadir query `filtroAux`.

- [ ] **Step 3: Cartera** — quitar `Input` libre del header. Añadir:

```ts
const ejecutivosEnCarga = computed(() => {
  const set = new Set<string>()
  for (const f of filas.value) {
    const e = f.email_ejecutivo?.trim().toLowerCase()
    if (e) set.add(e)
  }
  return [...set].sort()
})
```

UI supervisor (perfil 1/2):

- Pill navy: `Cartera: mía ({{ auth.email }})` cuando `!filtroEjecutivo` y modo “mía” opcional, o siempre mostrar pill de contexto + botones «Ver todas».
- `Select` v-model `filtroEjecutivo` con `SelectItem` por cada `ejecutivosEnCarga` + valor vacío «Todas».
- Texto hint: `Ejecutivos en la carga actual`.
- Perfil 3: solo pill navy `Cartera: mía (email)`; sin select.

Al cambiar select → `page = 0; cargar()`.

- [ ] **Step 4: Columna Etapa + Subetapa**

```vue
<td class="px-3 py-2">
  <span
    class="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold"
    :class="[colorEtapaChip(fila.chip).bg, colorEtapaChip(fila.chip).text, colorEtapaChip(fila.chip).border]"
  >
    {{ ETIQUETA_CHIP_BANDEJA[fila.chip] }}
  </span>
</td>
<td class="px-3 py-2">{{ etiquetaSubetapaFormaPago(fila.subetapa_forma_pago) }}</td>
```

- [ ] **Step 5: Smoke manual rápido en código** (sin deploy aún): `yarn vitest run src/utils/seguimientoBandejaChip.test.ts` sigue PASS.

- [ ] **Step 6: Commit**

```bash
git add src/views/dashboard/rematricula/BandejaSeguimientoRematriculaView.vue
git commit -m "feat(seguimiento): bandeja UI v3 chips, auxiliares y cartera select"
```

---

### Task 3: Panel caso — overlay Escape, copy n/a, CTAs corte 2, iconos bitácora

**Files:**
- Modify: `src/views/dashboard/rematricula/BandejaSeguimientoRematriculaView.vue`

- [ ] **Step 1: Overlay + Escape**

```vue
<div
  v-if="casoAbierto"
  class="fixed inset-0 z-30 bg-black/40"
  aria-hidden="true"
  @click="cerrarCaso()"
/>
<aside v-if="casoAbierto" class="fixed inset-y-0 right-0 z-40 ...">
  ...
</aside>
```

```ts
function cerrarCaso(): void {
  casoAbierto.value = null
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && casoAbierto.value) cerrarCaso()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
```

Importar `onMounted` / `onUnmounted` desde `vue`.

- [ ] **Step 2: Cabecera + contacto placeholder**

- Badges etapa/subetapa con `colorEtapaChip` / `etiquetaSubetapaFormaPago`.
- Bloque: Email `—` · Teléfono `—` · Firmantes `—` (sin leer campos inexistentes).
- Ejecutivo: `casoAbierto.email_ejecutivo ?? '—'`.
- Mat. Webpay: fecha existente o `—`.

- [ ] **Step 3: Retención + CTAs**

```vue
<div class="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
  <p class="font-semibold text-[#FF5B00]">Retención automática</p>
  <p>Correo 2h: {{ etiquetaOutboxUi(casoAbierto.mail_2h, casoAbierto.mail_2h_sent_at) }}</p>
  <p>SMS 24h: {{ etiquetaOutboxUi(casoAbierto.sms_24h, casoAbierto.sms_24h_sent_at) }}</p>
  <p
    v-if="casoAbierto.mail_2h === 'n/a' && casoAbierto.sms_24h === 'n/a'"
    class="mt-2 text-xs text-zinc-600"
  >
    No aplica: sin matrícula Webpay o firma ya completa
  </p>
</div>

<Button disabled class="rounded-full bg-[#FF5B00]/40">Enviar correo · corte 2</Button>
<Button disabled variant="outline" class="rounded-full">Enviar SMS · corte 2</Button>
<Button disabled variant="outline" class="rounded-full">WhatsApp · próximamente</Button>
```

- [ ] **Step 4: Icono bitácora por canal** — helper local:

```ts
function iconoCanal(canal: string): string {
  const c = canal.trim().toLowerCase()
  if (c === 'llamada' || c === 'telefono' || c === 'teléfono') return '📞'
  // Preferir Lucide si ya está en el proyecto: Phone, MessageSquare, MessageCircle, Pencil
  return c
}
```

Preferir **Lucide Vue Next** (`Phone`, `MessageSquare`, `MessageCircle`, `Pencil`) frente a emoji si el archivo ya importa Lucide; si no, importar esos 4 iconos y mapear `llamada|sms|whatsapp|nota`.

- [ ] **Step 5: Commit**

```bash
git add src/views/dashboard/rematricula/BandejaSeguimientoRematriculaView.vue
git commit -m "feat(seguimiento): panel caso overlay Escape y copy retención UI v3"
```

---

### Task 4: Deploy mol-dev + smoke + notas

**Files:** ninguno de lógica (solo rebuild).

- [ ] **Step 1: Rebuild mol-dev**

```bash
cd /opt/mol-docker && docker compose up -d --build mol-dev
```

Expected: container Up; bundle nuevo.

- [ ] **Step 2: Smoke checklist** (anotar en commit docs o comentario PR)

1. Chips 1–8 numerados; activo naranja.  
2. +7d / Mail / SMS visibles; **no** filtran al click.  
3. Sin texto debug outbox.  
4. Perfil 3: pill mía. Supervisor: select + hint «Ejecutivos en la carga actual».  
5. Etapa coloreada; subetapa humanizada.  
6. Panel: overlay; Escape cierra; n/a copy; CTAs «corte 2» disabled.

- [ ] **Step 3: Commit notas smoke** (opcional corto) o dejar lista en el mensaje del PR.

```bash
# si se agrega nota:
# docs/superpowers/plans/… o comentario en PR
git status
```

- [ ] **Step 4: Confirmar CORTE 2 pendiente** (no implementar): composer, envío, scheduler outbox ↔ `mol_retencion_aviso`, WhatsApp, +7d real, email/tel/firmantes en payload.

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| Chips 1–8 + ring naranja | T2 |
| +7d display-only | T2 |
| Mail/SMS display-only (sin filtroAux) | T2 |
| Quitar debug outbox | T2 |
| Cartera pill + select + hint carga actual | T2 |
| Etapa color + subetapa humanizada | T1+T2 |
| Overlay + Escape | T3 |
| Contacto «—» | T3 |
| Copy retención n/a | T3 |
| CTAs corte 2 | T3 |
| Bitácora iconos | T3 |
| Smoke mol-dev / no prod | T4 |
| Fuera CORTE 2 | T4 step 4 |

## Archivos tocados (esperado)

- `src/utils/seguimientoBandejaChip.ts`
- `src/utils/seguimientoBandejaChip.test.ts`
- `src/views/dashboard/rematricula/BandejaSeguimientoRematriculaView.vue`
- (spec matizado) `docs/superpowers/specs/2026-11-06-seguimiento-rematricula-ajustes-ui-v3-design.md`
- este plan
