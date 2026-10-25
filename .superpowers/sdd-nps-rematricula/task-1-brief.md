### Task 1: Utilidades puras + tests

**Files:**
- Create: `src/utils/npsRematricula.ts`
- Create: `src/utils/npsRematricula.test.ts`

**Interfaces:**
- Produces:
  - `export type CalificacionNps = 1 | 2 | 3 | 4 | 5`
  - `export function esCalificacionNps(n: number): n is CalificacionNps`
  - `export function normalizarComentarioNps(calificacion: CalificacionNps, comentario: string | null | undefined): string | null`
  - `export function promedioNps(calificaciones: CalificacionNps[]): number | null`
  - `export function distribucionNps(calificaciones: CalificacionNps[]): Record<CalificacionNps, number>`
  - `export function tasaRespuestaNps(respuestas: number, finalizados: number): number | null`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  distribucionNps,
  esCalificacionNps,
  normalizarComentarioNps,
  promedioNps,
  tasaRespuestaNps,
} from './npsRematricula'

describe('esCalificacionNps', () => {
  it('acepta 1..5 enteros', () => {
    expect(esCalificacionNps(1)).toBe(true)
    expect(esCalificacionNps(5)).toBe(true)
    expect(esCalificacionNps(0)).toBe(false)
    expect(esCalificacionNps(6)).toBe(false)
    expect(esCalificacionNps(3.5)).toBe(false)
  })
})

describe('normalizarComentarioNps', () => {
  it('4 y 5 siempre null', () => {
    expect(normalizarComentarioNps(4, 'hola')).toBeNull()
    expect(normalizarComentarioNps(5, '  x  ')).toBeNull()
  })

  it('1-3 recorta y limita a 500', () => {
    expect(normalizarComentarioNps(2, '  mal  ')).toBe('mal')
    expect(normalizarComentarioNps(1, '   ')).toBeNull()
    expect(normalizarComentarioNps(3, 'a'.repeat(600))?.length).toBe(500)
  })
})

describe('agregados', () => {
  it('promedio y distribución', () => {
    expect(promedioNps([])).toBeNull()
    expect(promedioNps([5, 3])).toBe(4)
    expect(distribucionNps([1, 5, 5])).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 2 })
  })

  it('tasa null si no hay finalizados', () => {
    expect(tasaRespuestaNps(0, 0)).toBeNull()
    expect(tasaRespuestaNps(2, 10)).toBe(0.2)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm run test:unit -- src/utils/npsRematricula.test.ts`  
Expected: FAIL (módulo no existe)

- [ ] **Step 3: Implement**

```ts
export type CalificacionNps = 1 | 2 | 3 | 4 | 5

export function esCalificacionNps(n: number): n is CalificacionNps {
  return Number.isInteger(n) && n >= 1 && n <= 5
}

export function normalizarComentarioNps(
  calificacion: CalificacionNps,
  comentario: string | null | undefined,
): string | null {
  if (calificacion >= 4) return null
  const t = (comentario ?? '').trim()
  if (!t) return null
  return t.length > 500 ? t.slice(0, 500) : t
}

export function promedioNps(calificaciones: CalificacionNps[]): number | null {
  if (calificaciones.length === 0) return null
  const sum = calificaciones.reduce((a, b) => a + b, 0)
  return sum / calificaciones.length
}

export function distribucionNps(
  calificaciones: CalificacionNps[],
): Record<CalificacionNps, number> {
  const out: Record<CalificacionNps, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const c of calificaciones) out[c] += 1
  return out
}

export function tasaRespuestaNps(respuestas: number, finalizados: number): number | null {
  if (finalizados <= 0) return null
  return respuestas / finalizados
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm run test:unit -- src/utils/npsRematricula.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** (solo si el usuario lo pide)

```bash
git add src/utils/npsRematricula.ts src/utils/npsRematricula.test.ts
git commit -m "feat(nps): utilidades de facilidad 1-5 para rematrícula"
```

---

