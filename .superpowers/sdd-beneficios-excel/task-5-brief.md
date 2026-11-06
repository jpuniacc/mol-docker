### Task 5: API front + FormaPagoMockView

**Files:**
- Create: `src/services/carteraBeneficiosApi.ts`
- Modify: `src/views/matricula-mock/FormaPagoMockView.vue`

**Interfaces:**
- Consumes: RPC Task 3; `itemsBeneficioDesdeCartera`; `periodoCatalogoLabel` / periodo fijo `2027-01` según spec (si periodo activo MOL aún no es 2027-01, **usar `2027-01` hardcodeado o env** para cartera Excel — documentar constante `PERIODO_CARTERA_BENEFICIOS = '2027-01'`)
- Produces: tarjeta y cálculo sin U+ detalle

- [ ] **Step 1: `consultarCarteraBeneficios({ periodo, codcliExcel, rutNorm })`**

- [ ] **Step 2: En FormaPagoMockView**
  - Al montar / al cambiar alumno: fetch cartera beneficios con `codcli` mostrado (tratar como `codcli_excel` cuando coincide) + `rutNorm`.
  - Reemplazar `beneficios` computed: **no** usar `plan.beneficios_detalle`.
  - Usar `itemsBeneficioDesdeCartera(row)`.
  - UI: descripción, `cod_beneficio` (o badge “sin mapear”), `%`, checkbox solo si `!sinMapear`.
  - Subtítulo periodo: `row.periodo` / `2027-01`.
  - Flags consolidado (texto pequeño CAE/ministerial si aplica).

- [ ] **Step 3: `calcularBecasMock`**
  - Construir items solo con `cod_beneficio` + pct Excel.
  - Si existe `aplicarPrelacionArancel` + catálogo flujo, llamar; si no, toast con lista de códigos/pct aplicados (mínimo: no usar U+).
  - Preferir: mapear a `ItemPrelacionInput` usando `flujo` desde `mnp_mv_beneficio_periodo` (fetch catálogo o join en row) — si v1 es pesado, toast + log de ítems Excel con código basta y dejar prelación plena en task follow-up. **Mínimo spec:** cálculo no mezcla U+; usa Excel+código.

- [ ] **Step 4: Smoke** mock alumno `12946085-7` / `20152PSIC1SR039`: tarjeta 1 fila, código 1756, sin 1791.

---

