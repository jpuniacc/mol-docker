### Task 4: Script de carga Excel

**Files:**
- Create: `scripts/load_cartera_beneficios.py`

**Interfaces:**
- Consumes: Excel path (env `CARTERA_XLSX`), DSN como `load_cartera_email_ejecutivo.py`, catálogo desde DB `mnp_mv_beneficio_periodo` WHERE `periodo='2027-01'` **o** CSV `docs/becas-beneficios/cod_beneficios_flujos_2027-01.csv` (col0=código, col1=nombre) si DB vacía.
- Produces: UPSERT filas en `mnp_cartera_beneficios`

- [ ] **Step 1: Leer Excel** columnas `CODCLI`, `RUT`, `DIG`, `CODCARPR`, `BECA 1`, `%` (col 35), `BECA 2`, `%` (col 37), `CONSOLIDADO CAE-BECA MINISTERIAL-SUBDERE`

Nota: hay dos columnas `%`; usar índices por posición tras header o nombres únicos si el Excel las distingue. Si ambas se llaman `%`, usar índice numérico: BECA1→col35, BECA2→col37 (verificar en load).

- [ ] **Step 2: Match** — reimplementar normalización en Python (misma regla que Task 1) o llamar lógica equivalente; set `cod_beneficio_1/2`.

- [ ] **Step 3: UPSERT**

```sql
INSERT INTO mnp_cartera_beneficios (...)
VALUES (...)
ON CONFLICT (periodo, codcli_excel) DO UPDATE SET ...
```

Periodo fijo `2027-01` (env `CARTERA_PERIODO` override).

- [ ] **Step 4: Run dry / load**

```bash
cd /opt/mol-docker
# con DSN:
python3 scripts/load_cartera_beneficios.py
# Verificar:
# SELECT * FROM mnp_cartera_beneficios WHERE codcli_excel = '20152PSIC1SR039';
# Esperado: beca_1 Apoyo…, cod_beneficio_1 = 1756, beca_2 null
```

Print: `rows=N matched1=M unmatched1=U`

---

