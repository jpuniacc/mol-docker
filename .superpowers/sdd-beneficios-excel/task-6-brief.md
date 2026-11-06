### Task 6: Verificación

- [ ] **Step 1:** SQL

```sql
SELECT beca_1, cod_beneficio_1, beca_2, cod_beneficio_2
FROM mnp_cartera_beneficios
WHERE periodo = '2027-01' AND codcli_excel = '20152PSIC1SR039';
```

Expected: `cod_beneficio_1='1756'`, `beca_2` null.

- [ ] **Step 2:** Count unmatched

```sql
SELECT count(*) FROM mnp_cartera_beneficios
WHERE periodo='2027-01' AND beca_1 IS NOT NULL AND btrim(beca_1) <> ''
  AND lower(btrim(beca_1)) NOT IN ('sin beca') AND cod_beneficio_1 IS NULL;
```

Report number; if alto, mejorar match (aliases).

- [ ] **Step 3:** Unit tests Tasks 1–2 PASS.

- [ ] **Step 4:** Checklist spec éxito Vanessa + “no 1791”.

---

## Spec coverage

| Spec | Task |
|------|------|
| Tabla + PK + campos | 3 |
| Carga Excel + match código | 1, 4 |
| UI periodo 2027-01 + cod visible | 2, 5 |
| Cálculo sin U+ | 5 |
| Caso 12946085-7 | 2, 4, 6 |
| Grab U+ | fuera v1 ✓ |

**Nota:** Matching imperfecto de nombres → `sin mapear`; no bloquear carga. Alias manual (mapa estático) solo si el count de unmatched lo exige en Task 6.
