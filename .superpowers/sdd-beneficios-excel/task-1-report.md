# Task 1 Report: Match nombre beca → `cod_beneficio`

**Status:** DONE

**Commit:** `3f737f0` — feat(beneficios): util match nombre beca a cod_beneficio

**Branch:** dev (ahead of origin/dev by 36 commits)

---

## What Was Built

### `src/utils/becaNombreMatch.ts`

Utilidad pura TypeScript para normalizar nombres de beca desde Excel y resolver `cod_beneficio` contra el catálogo.

| Función | Propósito |
|---------|-----------|
| `normalizarNombreBeca(nombre)` | NFKC, trim, colapsa espacios múltiples, lowercase |
| `esSinBeca(nombre)` | Detecta vacío, `sin beca`, `-`, `n/a` |
| `matchCodBeneficio(nombreExcel, catalogo)` | Match exacto normalizado → `codigo_beneficio` o `null` |

### `src/utils/becaNombreMatch.test.ts`

4 tests unitarios con vitest (`vitest.unit.config.ts`).

---

## TDD Cycle

1. **Red:** tests creados; ejecución falló (módulo inexistente).
2. **Green:** implementación según brief; 4/4 tests PASS.
3. **Commit:** solo los dos archivos de util/test (sin `.superpowers/` ni docs).

---

## Self-Review

| Criterio | Resultado |
|----------|-----------|
| Normalización espacios dobles | OK |
| `Sin beca` / null → no match | OK |
| Match Apoyo UNIACC → 1756 | OK |
| Nombre desconocido → null | OK |
| Sin dependencias externas | OK |
| Tipos explícitos | OK |

---

## Verification

```bash
cd /opt/mol-docker
npx vitest run --config vitest.unit.config.ts src/utils/becaNombreMatch.test.ts
```

**Resultado:** 1 file, 4 tests passed.

---

## Concerns / Limitaciones (v1)

1. **Match exacto post-normalización:** variaciones de texto no cubiertas (abreviaturas, typos, prefijos distintos) quedarán como `null` — coherente con spec (“sin mapear”).
2. **Sin fuzzy/alias:** tareas posteriores podrían extender con tabla de alias si el Excel diverge del catálogo ERP.
3. **Catálogo en memoria:** el caller (ETL Task 2+) debe pasar filas de `mnp_mv_beneficio_periodo` o CSV 2027-01.

---

## Next Task

Task 2: integrar esta util en el script/ETL de carga `mnp_cartera_beneficios` desde `BASE PARA PRUEBA.xlsx`.
