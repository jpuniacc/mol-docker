# Task 5 — API front + FormaPagoMockView

## Hecho
- `src/services/carteraBeneficiosApi.ts`: `PERIODO_CARTERA_BENEFICIOS = '2027-01'`, RPC `consultar_cartera_beneficios`.
- `FormaPagoMockView.vue`: fetch al cambiar codcli/rut; UI desde Excel (`itemsBeneficioDesdeCartera`, `flagsConsolidado`); sin `plan.beneficios_detalle`; `calcularBecasMock` solo ítems con `cod_beneficio`.

## Smoke esperado
Alumno `12946085-7` / `20152PSIC1SR039`: 1 fila, código **1756**, sin **1791**.

## Pendiente
Prelación arancel completa (`aplicarPrelacionArancel` + catálogo flujo) — follow-up.
