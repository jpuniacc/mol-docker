# Task 2 Report: UI mapper cartera → ítems beneficios

**Status:** DONE

**Commit:** `43a85d0` — feat(beneficios): mapper cartera Excel a ítems UI

**Branch:** dev

---

## What Was Built

### `src/utils/carteraBeneficiosUi.ts`

Mapper puro TypeScript: fila `mnp_cartera_beneficios` → ítems para tarjeta Forma de Pago.

| Export | Propósito |
|--------|-----------|
| `CarteraBeneficioRow` | Tipo fila cartera Excel |
| `BeneficioExcelUiItem` | Ítem UI (slot, descripción, código, %, sinMapear) |
| `itemsBeneficioDesdeCartera(row)` | Omite slots vacíos/Sin beca; `sinMapear = !cod_beneficio` |
| `flagsConsolidado(consolidado)` | Flags CAE / ministerial / SUBDERE desde texto consolidado |

### `src/utils/carteraBeneficiosUi.test.ts`

7 tests Vitest (`vitest.unit.config.ts`), incluyendo caso Vanessa `129460857` / `20152PSIC1SR039`.

---

## TDD Cycle

1. **Red:** tests creados; falló (módulo inexistente).
2. **Green:** implementación según plan; 7/7 PASS.
3. **Commit:** solo `carteraBeneficiosUi.ts` + `.test.ts`.

---

## Self-Review

| Criterio | Resultado |
|----------|-----------|
| Vanessa: solo 1756, sin 1791 | OK |
| Omite Sin beca / vacío | OK |
| sinMapear sin código | OK |
| Dos slots BECA 1/2 | OK |
| flagsConsolidado | OK |
| Reutiliza `esSinBeca` Task 1 | OK |

---

## Verification

```bash
cd /opt/mol-docker
npx vitest run --config vitest.unit.config.ts src/utils/carteraBeneficiosUi.test.ts
```

**Resultado:** 1 file, 7 tests passed.

---

## Concerns / Limitaciones (v1)

1. **flagsConsolidado:** match por substring en mayúsculas; valores compuestos del Excel no validados contra muestra real.
2. **Sin deduplicación:** si beca_1 y beca_2 repiten texto, se muestran dos ítems (coherente con Excel).
3. **Integración UI:** Task 5 consumirá este mapper vía `carteraBeneficiosApi`.

---

## Next Task

Task 3: migración SQL `mnp_cartera_beneficios` + RPC `consultar_cartera_beneficios`.
