# Task 6 Report — Verificación beneficios desde Excel

**Status:** ✅ DONE  
**Commit:** `0d10ec4` — fix(beneficios): set search_path on consultar_cartera_beneficios RPC

---

## Checklist

| # | Verificación | Resultado |
|---|--------------|-----------|
| 1 | SQL Vanessa `20152PSIC1SR039` | ✅ `beca_1=Beneficio Apoyo UNIACC Renovable`, `cod_beneficio_1=1756`, `beca_2`/`cod_beneficio_2` null |
| 2 | Count unmatched beca_1 (2027-01) | ✅ **1** — `Beca Colaboradores Hijos y Conyuges` (no en catálogo); no requiere alias v1 |
| 3 | Unit tests Tasks 1–2 | ✅ 11/11 PASS (`becaNombreMatch` 4, `carteraBeneficiosUi` 7) |
| 4 | Spec éxito Vanessa / no 1791 | ✅ UI test: solo Apoyo 1756; sin 1791; periodo 2027-01 |

---

## SQL ejecutado (supabase@uniacc-desarrollo)

```sql
SELECT beca_1, cod_beneficio_1, beca_2, cod_beneficio_2
FROM mnp_cartera_beneficios
WHERE periodo = '2027-01' AND codcli_excel = '20152PSIC1SR039';
-- → Beneficio Apoyo UNIACC Renovable | 1756 | null | null

SELECT count(*) FROM mnp_cartera_beneficios
WHERE periodo='2027-01' AND beca_1 IS NOT NULL AND btrim(beca_1) <> ''
  AND lower(btrim(beca_1)) NOT IN ('sin beca') AND cod_beneficio_1 IS NULL;
-- → 1
```

---

## Tests

```bash
cd /opt/mol-docker
npx vitest run --config vitest.unit.config.ts \
  src/utils/becaNombreMatch.test.ts src/utils/carteraBeneficiosUi.test.ts
```

**Resultado:** 2 files, 11 tests passed.

---

## Fix opcional

- Migración `20260916130000_consultar_cartera_beneficios_search_path.sql`: `SET search_path = public` en RPC `consultar_cartera_beneficios`.

---

## Spec coverage (SDD)

| Spec | Tasks | Estado |
|------|-------|--------|
| Tabla + PK + campos | 3 | ✅ |
| Carga Excel + match código | 1, 4 | ✅ (4687 filas, 1 unmatched) |
| UI periodo 2027-01 + cod visible | 2, 5 | ✅ |
| Cálculo sin U+ | 5 | ✅ |
| Caso 12946085-7 / 20152PSIC1SR039 | 2, 4, 6 | ✅ |
| Grab U+ | — | fuera v1 ✓ |

---

## Pendiente (follow-up, no bloquea v1)

- Prelación arancel completa (`aplicarPrelacionArancel` + catálogo flujo) — Task 5 report.
- Alias manual solo si unmatched crece; con count=1 no aplica.
