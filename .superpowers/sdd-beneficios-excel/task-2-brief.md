### Task 2: UI mapper cartera → ítems beneficios

**Files:**
- Create: `src/utils/carteraBeneficiosUi.ts`
- Create: `src/utils/carteraBeneficiosUi.test.ts`

**Interfaces:**
- Consumes: nada (tipos locales)
- Produces:
  - `export type CarteraBeneficioRow = { periodo: string; rut_norm: string; codcli_excel: string; beca_1: string | null; pct_1: number | null; beca_2: string | null; pct_2: number | null; consolidado: string | null; cod_beneficio_1: string | null; cod_beneficio_2: string | null }`
  - `export type BeneficioExcelUiItem = { slot: 1 | 2; descripcion: string; cod_beneficio: string | null; pct: number | null; sinMapear: boolean }`
  - `export function itemsBeneficioDesdeCartera(row: CarteraBeneficioRow | null): BeneficioExcelUiItem[]`
  - `export function flagsConsolidado(consolidado: string | null): { cae: boolean; ministerial: boolean; subdere: boolean }`

- [ ] **Step 1: Failing test — caso Vanessa**

```ts
it('12946085 solo Apoyo 1756; no inventa 1791', () => {
  const items = itemsBeneficioDesdeCartera({
    periodo: '2027-01',
    rut_norm: '129460857',
    codcli_excel: '20152PSIC1SR039',
    beca_1: 'Beneficio Apoyo UNIACC Renovable',
    pct_1: 10,
    beca_2: null,
    pct_2: null,
    consolidado: null,
    cod_beneficio_1: '1756',
    cod_beneficio_2: null,
  })
  expect(items).toHaveLength(1)
  expect(items[0].cod_beneficio).toBe('1756')
  expect(items.some((i) => i.cod_beneficio === '1791')).toBe(false)
})
```

- [ ] **Step 2: Implement** — omitir slots sin texto de beca; `sinMapear = !cod_beneficio` cuando hay texto.

- [ ] **Step 3: Tests PASS**

---

