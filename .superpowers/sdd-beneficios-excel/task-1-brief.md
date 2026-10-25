### Task 1: Match nombre beca → `cod_beneficio`

**Files:**
- Create: `src/utils/becaNombreMatch.ts`
- Create: `src/utils/becaNombreMatch.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `export function normalizarNombreBeca(nombre: string | null | undefined): string`
  - `export function esSinBeca(nombre: string | null | undefined): boolean`
  - `export function matchCodBeneficio(nombreExcel: string | null | undefined, catalogo: { codigo_beneficio: string; beneficio: string }[]): string | null`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { esSinBeca, matchCodBeneficio, normalizarNombreBeca } from './becaNombreMatch'

const CAT = [
  { codigo_beneficio: '1756', beneficio: 'Beneficio Apoyo UNIACC Renovable' },
  { codigo_beneficio: '1791', beneficio: 'DESCUENTO ANTICIPACION MATRICULA NUEVO' },
]

describe('becaNombreMatch', () => {
  it('normaliza espacios dobles', () => {
    expect(normalizarNombreBeca('Beneficio  Apoyo UNIACC Renovable')).toBe(
      'beneficio apoyo uniacc renovable',
    )
  })

  it('Sin beca → true', () => {
    expect(esSinBeca('Sin beca')).toBe(true)
    expect(esSinBeca(null)).toBe(true)
  })

  it('Apoyo UNIACC → 1756 aunque Excel tenga doble espacio', () => {
    expect(matchCodBeneficio('Beneficio  Apoyo UNIACC Renovable', CAT)).toBe('1756')
  })

  it('nombre desconocido → null', () => {
    expect(matchCodBeneficio('Beca inventada XYZ', CAT)).toBe(null)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /opt/mol-docker && npx vitest run --config vitest.unit.config.ts src/utils/becaNombreMatch.test.ts`

- [ ] **Step 3: Implement**

```ts
export function normalizarNombreBeca(nombre: string | null | undefined): string {
  return (nombre ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function esSinBeca(nombre: string | null | undefined): boolean {
  const n = normalizarNombreBeca(nombre)
  return !n || n === 'sin beca' || n === '-' || n === 'n/a'
}

export function matchCodBeneficio(
  nombreExcel: string | null | undefined,
  catalogo: { codigo_beneficio: string; beneficio: string }[],
): string | null {
  if (esSinBeca(nombreExcel)) return null
  const target = normalizarNombreBeca(nombreExcel)
  const hit = catalogo.find((c) => normalizarNombreBeca(c.beneficio) === target)
  return hit?.codigo_beneficio?.trim() || null
}
```

- [ ] **Step 4: Run — expect PASS**

---

