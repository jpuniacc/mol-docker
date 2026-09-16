# Gate matrícula por certificado convenio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquear **Pagar matrícula** hasta que todos los convenios vigentes con certificado tengan caso `CONVENIO_CERTIFICADO` en `APROBADO`, y eliminar el botón **Siguiente — forma de pago**.

**Architecture:** Extraer la regla de gate a un util puro (`convenioCertificadoGate.ts`) testeado con Vitest. `FormaPagoMockView` rehidrata casos con `consultarCasosAlumno`, cruza cada convenio vigente con su caso, y combina el gate con deuda. `ConvenioVigenteUpload` muestra badge según estado del caso (no “listo” solo por archivo).

**Tech Stack:** Vue 3 + TypeScript + Pinia + Vitest + Supabase RPC existentes (`consultar_casos_alumno`, `abrir_mnp_caso_rematricula`).

## Global Constraints

- Desbloqueo solo con `APROBADO` (spec 2026-09-16).
- Varios vigentes: **todos** deben estar `APROBADO`.
- Fail closed: vigente sin match de caso → bloqueado.
- Sin auto-aprobar en mock; bandeja consejero sin cambios.
- Copy UI en español (mensajes de la spec).
- Composition API + `<script setup lang="ts">`; sin `any`.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/utils/convenioCertificadoGate.ts` | Match caso↔convenio + evaluación del gate + mensajes |
| `src/utils/convenioCertificadoGate.test.ts` | Tests unitarios del gate |
| `src/views/matricula-mock/FormaPagoMockView.vue` | Rehidratación, `puedeAbrirPagoMatricula`, quitar Siguiente, copy |
| `src/components/rematricula/ConvenioVigenteUpload.vue` | Badge En revisión / Rechazado / Aprobado |

---

### Task 1: Util de gate (TDD)

**Files:**
- Create: `src/utils/convenioCertificadoGate.ts`
- Create: `src/utils/convenioCertificadoGate.test.ts`

**Interfaces:**
- Consumes: `MnpCasoRematriculaRow` / `MnpCasoRematriculaEstado` from `@/types/supabase`; shape mínima de convenio vigente `{ id: string; codigoBeneficio: string | null }`
- Produces:
  - `matchCasoConvenioCertificado(caso, convenio): boolean`
  - `estadoCertificadoConvenio(casos, convenio): MnpCasoRematriculaEstado | null`
  - `evaluarGateMatriculaConvenios(input): { puedePagarPorConvenio: boolean; motivo: 'ok' | 'sin_documento' | 'en_revision' | 'rechazado' | 'sin_caso'; mensaje: string | null; motivoRechazo: string | null }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import type { MnpCasoRematriculaRow } from '@/types/supabase'
import {
  evaluarGateMatriculaConvenios,
  matchCasoConvenioCertificado,
  estadoCertificadoConvenio,
} from './convenioCertificadoGate'

function caso(partial: Partial<MnpCasoRematriculaRow> & Pick<MnpCasoRematriculaRow, 'estado'>): MnpCasoRematriculaRow {
  return {
    id: 'c1',
    periodo: '2027-01',
    tipo: 'CONVENIO_CERTIFICADO',
    rut_alumno: null,
    codcli: 'X',
    nombre_alumno: null,
    carrera: null,
    jornada: null,
    titulo: 't',
    detalle: null,
    ref_tipo: 'convenio_documento',
    ref_id: null,
    payload: {},
    resuelto_por: null,
    resuelto_en: null,
    motivo: null,
    created_at: '',
    updated_at: '',
    ...partial,
  } as MnpCasoRematriculaRow
}

describe('matchCasoConvenioCertificado', () => {
  it('prioriza payload.convenio_id', () => {
    expect(
      matchCasoConvenioCertificado(
        caso({ payload: { convenio_id: 'conv-1' }, ref_id: 'other' }),
        { id: 'conv-1', codigoBeneficio: '1552' },
      ),
    ).toBe(true)
  })

  it('usa codigo_beneficio si no hay convenio_id', () => {
    expect(
      matchCasoConvenioCertificado(
        caso({ payload: { codigo_beneficio: '1552' } }),
        { id: 'conv-1', codigoBeneficio: '1552' },
      ),
    ).toBe(true)
  })

  it('usa ref_id vs storagePath del doc local', () => {
    expect(
      matchCasoConvenioCertificado(
        caso({ ref_id: 'path/a.pdf', payload: {} }),
        { id: 'conv-1', codigoBeneficio: null },
        'path/a.pdf',
      ),
    ).toBe(true)
  })
})

describe('evaluarGateMatriculaConvenios', () => {
  const vigente = { id: 'conv-1', codigoBeneficio: '1552' }

  it('sin vigentes → ok', () => {
    const r = evaluarGateMatriculaConvenios({ vigentes: [], casos: [], docsByConvenioId: {} })
    expect(r.puedePagarPorConvenio).toBe(true)
    expect(r.motivo).toBe('ok')
  })

  it('vigente sin doc → sin_documento', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [vigente],
      casos: [],
      docsByConvenioId: {},
    })
    expect(r.puedePagarPorConvenio).toBe(false)
    expect(r.motivo).toBe('sin_documento')
    expect(r.mensaje).toContain('Sube el documento')
  })

  it('doc sin caso → sin_caso (fail closed)', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [vigente],
      casos: [],
      docsByConvenioId: { 'conv-1': { storagePath: 'p', nombreArchivo: 'a.pdf' } },
    })
    expect(r.puedePagarPorConvenio).toBe(false)
    expect(r.motivo).toBe('sin_caso')
  })

  it('EN_REVISION → bloquea', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [vigente],
      casos: [caso({ estado: 'EN_REVISION', payload: { convenio_id: 'conv-1' } })],
      docsByConvenioId: { 'conv-1': { storagePath: 'p', nombreArchivo: 'a.pdf' } },
    })
    expect(r.puedePagarPorConvenio).toBe(false)
    expect(r.motivo).toBe('en_revision')
    expect(r.mensaje).toContain('en revisión')
  })

  it('RECHAZADO → bloquea con motivo', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [vigente],
      casos: [
        caso({
          estado: 'RECHAZADO',
          motivo: 'PDF ilegible',
          payload: { convenio_id: 'conv-1' },
        }),
      ],
      docsByConvenioId: { 'conv-1': { storagePath: 'p', nombreArchivo: 'a.pdf' } },
    })
    expect(r.puedePagarPorConvenio).toBe(false)
    expect(r.motivo).toBe('rechazado')
    expect(r.motivoRechazo).toBe('PDF ilegible')
    expect(r.mensaje).toContain('Vuelve a subir')
  })

  it('APROBADO → ok', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [vigente],
      casos: [caso({ estado: 'APROBADO', payload: { convenio_id: 'conv-1' } })],
      docsByConvenioId: { 'conv-1': { storagePath: 'p', nombreArchivo: 'a.pdf' } },
    })
    expect(r.puedePagarPorConvenio).toBe(true)
    expect(r.motivo).toBe('ok')
  })

  it('dos vigentes: uno APROBADO y otro EN_REVISION → bloquea', () => {
    const r = evaluarGateMatriculaConvenios({
      vigentes: [
        { id: 'conv-1', codigoBeneficio: '1552' },
        { id: 'conv-2', codigoBeneficio: '89' },
      ],
      casos: [
        caso({ id: 'a', estado: 'APROBADO', payload: { convenio_id: 'conv-1' } }),
        caso({ id: 'b', estado: 'EN_REVISION', payload: { convenio_id: 'conv-2' } }),
      ],
      docsByConvenioId: {
        'conv-1': { storagePath: 'p1', nombreArchivo: 'a.pdf' },
        'conv-2': { storagePath: 'p2', nombreArchivo: 'b.pdf' },
      },
    })
    expect(r.puedePagarPorConvenio).toBe(false)
    expect(r.motivo).toBe('en_revision')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /opt/mol-docker && npx vitest run src/utils/convenioCertificadoGate.test.ts`

Expected: FAIL (module not found / export missing)

- [ ] **Step 3: Implement `convenioCertificadoGate.ts`**

```ts
import type { MnpCasoRematriculaEstado, MnpCasoRematriculaRow } from '@/types/supabase'

export type ConvenioGateRef = {
  id: string
  codigoBeneficio: string | null
}

export type DocLocalRef = {
  storagePath: string
  nombreArchivo: string
}

export type GateMatriculaConvenioResult = {
  puedePagarPorConvenio: boolean
  motivo: 'ok' | 'sin_documento' | 'en_revision' | 'rechazado' | 'sin_caso'
  mensaje: string | null
  motivoRechazo: string | null
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toUpperCase()
}

function payloadStr(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key]
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t || null
}

export function matchCasoConvenioCertificado(
  caso: MnpCasoRematriculaRow,
  convenio: ConvenioGateRef,
  storagePathDoc?: string | null,
): boolean {
  if (caso.tipo !== 'CONVENIO_CERTIFICADO') return false
  const payload = (caso.payload ?? {}) as Record<string, unknown>
  const convId = payloadStr(payload, 'convenio_id')
  if (convId && convId === convenio.id) return true
  const cod = payloadStr(payload, 'codigo_beneficio')
  if (cod && norm(cod) === norm(convenio.codigoBeneficio)) return true
  const ref = (caso.ref_id ?? '').trim()
  const path = (storagePathDoc ?? '').trim()
  if (ref && path && ref === path) return true
  return false
}

export function estadoCertificadoConvenio(
  casos: MnpCasoRematriculaRow[],
  convenio: ConvenioGateRef,
  storagePathDoc?: string | null,
): MnpCasoRematriculaEstado | null {
  const matches = casos.filter((c) =>
    matchCasoConvenioCertificado(c, convenio, storagePathDoc),
  )
  if (matches.length === 0) return null
  // Preferir el más reciente por updated_at
  matches.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  return matches[0]!.estado
}

export function casoCertificadoConvenio(
  casos: MnpCasoRematriculaRow[],
  convenio: ConvenioGateRef,
  storagePathDoc?: string | null,
): MnpCasoRematriculaRow | null {
  const matches = casos.filter((c) =>
    matchCasoConvenioCertificado(c, convenio, storagePathDoc),
  )
  if (matches.length === 0) return null
  matches.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  return matches[0] ?? null
}

export function evaluarGateMatriculaConvenios(input: {
  vigentes: ConvenioGateRef[]
  casos: MnpCasoRematriculaRow[]
  docsByConvenioId: Record<string, DocLocalRef | undefined>
}): GateMatriculaConvenioResult {
  if (input.vigentes.length === 0) {
    return { puedePagarPorConvenio: true, motivo: 'ok', mensaje: null, motivoRechazo: null }
  }

  for (const v of input.vigentes) {
    const doc = input.docsByConvenioId[v.id]
    if (!doc) {
      return {
        puedePagarPorConvenio: false,
        motivo: 'sin_documento',
        mensaje: 'Sube el documento del convenio vigente para poder pagar.',
        motivoRechazo: null,
      }
    }
    const row = casoCertificadoConvenio(input.casos, v, doc.storagePath)
    if (!row) {
      return {
        puedePagarPorConvenio: false,
        motivo: 'sin_caso',
        mensaje: 'Documento en revisión por tu consejero. Podrás pagar cuando lo aprueben.',
        motivoRechazo: null,
      }
    }
    if (row.estado === 'EN_REVISION' || row.estado === 'ABIERTO') {
      return {
        puedePagarPorConvenio: false,
        motivo: 'en_revision',
        mensaje: 'Documento en revisión por tu consejero. Podrás pagar cuando lo aprueben.',
        motivoRechazo: null,
      }
    }
    if (row.estado === 'RECHAZADO') {
      const motivo = (row.motivo ?? '').trim() || null
      return {
        puedePagarPorConvenio: false,
        motivo: 'rechazado',
        mensaje: motivo
          ? `${motivo}. Vuelve a subir el documento.`
          : 'El documento fue rechazado. Vuelve a subir el documento.',
        motivoRechazo: motivo,
      }
    }
    if (row.estado !== 'APROBADO') {
      return {
        puedePagarPorConvenio: false,
        motivo: 'en_revision',
        mensaje: 'Documento en revisión por tu consejero. Podrás pagar cuando lo aprueben.',
        motivoRechazo: null,
      }
    }
  }

  return { puedePagarPorConvenio: true, motivo: 'ok', mensaje: null, motivoRechazo: null }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /opt/mol-docker && npx vitest run src/utils/convenioCertificadoGate.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/convenioCertificadoGate.ts src/utils/convenioCertificadoGate.test.ts
git commit -m "feat(rematricula): util gate matrícula por certificado convenio"
```

---

### Task 2: Wire gate + rehidratación en FormaPagoMockView

**Files:**
- Modify: `src/views/matricula-mock/FormaPagoMockView.vue`

**Interfaces:**
- Consumes: `evaluarGateMatriculaConvenios`, `casoCertificadoConvenio` from Task 1; `consultarCasosAlumno` from `@/services/casoRematriculaApi`; `periodoCatalogoLabel`
- Produces: `puedeAbrirPagoMatricula` incluye `gateConvenio.puedePagarPorConvenio`; ref `casosConvenioCertificado`; sin botón Siguiente

- [ ] **Step 1: Add imports and state**

Near other imports / refs:

```ts
import { consultarCasosAlumno } from '@/services/casoRematriculaApi'
import type { MnpCasoRematriculaRow } from '@/types/supabase'
import {
  casoCertificadoConvenio,
  evaluarGateMatriculaConvenios,
} from '@/utils/convenioCertificadoGate'
```

```ts
const casosConvenio = ref<MnpCasoRematriculaRow[]>([])
```

- [ ] **Step 2: Replace `conveniosVigentesPendientes` with gate computed**

```ts
const gateConvenioMatricula = computed(() =>
  evaluarGateMatriculaConvenios({
    vigentes: conveniosVigentes.value.map((m) => ({
      id: m.convenio.id,
      codigoBeneficio: m.convenio.codigo_beneficio,
    })),
    casos: casosConvenio.value,
    docsByConvenioId: mockCtx.conveniosDocumentos,
  }),
)

function estadoUiConvenio(convenioId: string): MnpCasoRematriculaRow['estado'] | null {
  const match = conveniosVigentes.value.find((m) => m.convenio.id === convenioId)
  if (!match) return null
  const doc = mockCtx.conveniosDocumentos[convenioId]
  return casoCertificadoConvenio(
    casosConvenio.value,
    { id: match.convenio.id, codigoBeneficio: match.convenio.codigo_beneficio },
    doc?.storagePath,
  )?.estado ?? null
}
```

- [ ] **Step 3: Extend `puedeAbrirPagoMatricula`**

```ts
const puedeAbrirPagoMatricula = computed(() => {
  const monto = montoNetoMatricula()
  const rut = rutMostrado.value
  const tieneRut = !!rut && rut !== '—'
  return (
    monto > 0 &&
    tieneRut &&
    !cargandoDeuda.value &&
    !tieneDeuda.value &&
    !abriendoPagoMatricula.value &&
    gateConvenioMatricula.value.puedePagarPorConvenio
  )
})
```

- [ ] **Step 4: Rehydrate casos on enter / after upload**

```ts
async function refrescarCasosConvenio(): Promise<void> {
  const ctx = contextoConvenio.value
  const anio = ctx.anioPeriodo
  const sem = ctx.semestrePeriodo
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  if (!codcli || anio == null || sem == null) {
    casosConvenio.value = []
    return
  }
  const { data, error } = await consultarCasosAlumno(
    codcli,
    periodoCatalogoLabel(anio, sem),
  )
  if (error) {
    console.warn('[forma-pago] consultar_casos_alumno', error)
    return
  }
  casosConvenio.value = (data ?? []).filter((c) => c.tipo === 'CONVENIO_CERTIFICADO')
  // Rehidratar docs desde payload/ref si el store no los tiene
  for (const c of casosConvenio.value) {
    const payload = (c.payload ?? {}) as Record<string, unknown>
    const convenioId =
      typeof payload.convenio_id === 'string' ? payload.convenio_id.trim() : ''
    const path =
      (typeof payload.storage_path === 'string' && payload.storage_path.trim()) ||
      (c.ref_id ?? '').trim()
    if (!convenioId || !path) continue
    if (mockCtx.conveniosDocumentos[convenioId]) continue
    const nombre =
      path.split('/').pop() || 'documento-convenio.pdf'
    mockCtx.setConvenioDocumento(convenioId, {
      storagePath: path,
      nombreArchivo: nombre,
    })
  }
}
```

Call `void refrescarCasosConvenio()` from the existing `onMounted` / watch that loads forma de pago (same place that loads convenios / cartera). After `onConvenioSubido` succeeds (`abrirCasoRematricula`), also `await refrescarCasosConvenio()`.

- [ ] **Step 5: UI — mensaje bajo Pagar + quitar Siguiente**

Under the Pagar matrícula button (near deuda message):

```vue
<p
  v-else-if="!gateConvenioMatricula.puedePagarPorConvenio && gateConvenioMatricula.mensaje"
  class="text-xs text-amber-800"
>
  {{ gateConvenioMatricula.mensaje }}
</p>
```

Delete the template block that contains:
- `v-if="conveniosVigentesPendientes.length > 0"` alert about uploading before forma de pago
- the Button labeled `Siguiente — forma de pago`

Also remove dead code that only served that button (e.g. handler `continuarAFormaPago` / `precargarDeuda` exclusivo de ese CTA) **only if** nothing else calls it. Keep `precargarDeudaSiHayRut` if still used by pagar matrícula.

Pass estado to upload card:

```vue
<ConvenioVigenteUpload
  ...
  :estado-caso="estadoUiConvenio(m.convenio.id)"
  :motivo-rechazo="casoCertificadoConvenio(casosConvenio, { id: m.convenio.id, codigoBeneficio: m.convenio.codigo_beneficio }, mockCtx.conveniosDocumentos[m.convenio.id]?.storagePath)?.motivo ?? null"
/>
```

(Prefer a small computed map `estadoPorConvenioId` / `motivoPorConvenioId` in the view to keep the template clean.)

- [ ] **Step 6: Manual smoke (dev)**

1. Alumno con Caja Los Andes vigente, sin PDF → Pagar disabled + mensaje subir.  
2. Subir PDF → sigue disabled + mensaje revisión.  
3. En bandeja aprobar caso → refresh / reentrar → Pagar enabled (sin deuda).  
4. Confirmar que **Siguiente — forma de pago** no aparece.

- [ ] **Step 7: Commit**

```bash
git add src/views/matricula-mock/FormaPagoMockView.vue
git commit -m "feat(rematricula): bloquear pagar matrícula hasta APROBADO de convenio"
```

---

### Task 3: Badges en ConvenioVigenteUpload

**Files:**
- Modify: `src/components/rematricula/ConvenioVigenteUpload.vue`

**Interfaces:**
- Consumes: props opcionales `estadoCaso: MnpCasoRematriculaEstado | null`, `motivoRechazo: string | null`
- Produces: UI badge según estado; no implica “listo para pagar” solo por archivo

- [ ] **Step 1: Extend props**

```ts
import type { MnpCasoRematriculaEstado } from '@/types/supabase'

const props = defineProps<{
  match: ConvenioAlumnoMatch
  documento: MockConvenioDocumento | null
  contexto: ContextoMolAuditoriaOpciones
  estadoCaso?: MnpCasoRematriculaEstado | null
  motivoRechazo?: string | null
}>()
```

- [ ] **Step 2: Update template when `documento` exists**

Replace the green “Documento cargado: …” as the sole status with:

```vue
<div v-if="documento" class="mt-3 space-y-2">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <Badge
        v-if="estadoCaso === 'APROBADO'"
        class="bg-green-700"
      >Aprobado</Badge>
      <Badge
        v-else-if="estadoCaso === 'RECHAZADO'"
        variant="destructive"
      >Rechazado</Badge>
      <Badge
        v-else
        class="bg-amber-600"
      >En revisión</Badge>
      <span class="text-zinc-700">{{ documento.nombreArchivo }}</span>
    </div>
    <Button
      v-if="estadoCaso !== 'APROBADO'"
      type="button"
      variant="outline"
      size="sm"
      class="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
      :disabled="eliminando"
      @click="eliminar"
    >
      ...
    </Button>
  </div>
  <p v-if="estadoCaso === 'RECHAZADO'" class="text-sm text-red-700">
    {{ motivoRechazo?.trim() || 'Documento rechazado.' }}
    Vuelve a subir el documento.
  </p>
  <p v-else-if="estadoCaso === 'EN_REVISION' || !estadoCaso" class="text-sm text-amber-800">
    Documento enviado. En revisión por tu consejero.
  </p>
</div>
```

If `RECHAZADO`, show upload controls again (or after Eliminar). Simplest: when `estadoCaso === 'RECHAZADO'`, also show the file input block below the message so re-upload works without forcing delete. After successful re-upload, parent opens new `EN_REVISION` and refreshes casos.

- [ ] **Step 3: Commit**

```bash
git add src/components/rematricula/ConvenioVigenteUpload.vue src/views/matricula-mock/FormaPagoMockView.vue
git commit -m "feat(rematricula): badges de estado en certificado convenio"
```

---

### Task 4: Checklist de aceptación

**Files:** none (manual + unit already in Task 1)

- [ ] **Step 1: Run unit tests**

Run: `cd /opt/mol-docker && npx vitest run src/utils/convenioCertificadoGate.test.ts`

Expected: all PASS

- [ ] **Step 2: Walk acceptance from spec**

- [ ] Vigente sin PDF → Pagar off + mensaje subir  
- [ ] Sube PDF → EN_REVISION → Pagar off + badge  
- [ ] Aprueba en bandeja → Pagar on  
- [ ] Rechaza → Pagar off + re-subir  
- [ ] Dos vigentes → ambos APROBADO  
- [ ] Sin convenio vigente → solo deuda  
- [ ] No hay botón Siguiente — forma de pago  

- [ ] **Step 3: Final commit if any polish**

```bash
git status
# only if needed:
git add -u
git commit -m "chore(rematricula): polish gate certificado convenio"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Gate por APROBADO | 1, 2 |
| Varios vigentes | 1 |
| Fail closed sin match | 1 |
| Quitar Siguiente | 2 |
| Mensajes copy | 1, 2 |
| Badges | 3 |
| Rehidratación `consultar_casos_alumno` | 2 |
| Match convenio_id / ref / código | 1 |
| Aceptación | 4 |
| Fuera de alcance bandeja / auto-approve | no tasks (intentional) |
