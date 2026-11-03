# Diseño: arancel neto $0 sin selector de medio

Fecha: 2026-11-02  
Estado: aprobado (enfoque A)

## Problema

Con beca interna 1744 al 100 %, el arancel neto queda en $0 pero el diálogo
“Forma de pago” sigue pidiendo Webpay/Pagaré para arancel y `puedeContinuar`
exige `medioArancel === 'pagare'`.

## Decisión

1. UI: bloque Arancel informativo (“Cubierto por tus beneficios · $0”), sin botones.
2. Persistencia: `medioArancel = null` (sin cobro de arancel).
3. `puedeContinuar` / `siguientePaso` reciben `arancelPorPagar`; si es ≤ 0 no exigen medio ni `elegir-arancel`.

## Fuera de alcance

- Matrícula en $0 (caso raro).
- Flag/sentinel `cubierto` en el store.
