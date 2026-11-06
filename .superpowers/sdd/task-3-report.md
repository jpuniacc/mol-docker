# Task 3 Report: Front helper destino/motivo Continuar

## Status

DONE

## Starting HEAD

`0179e3d` — docs(webpay): acotar ciclo a telemetría retorno y plan de implementación

Branch: `dev` en `/opt/mol-docker`.

## TDD Evidence

### RED (Step 2)

**Command:**

```bash
cd /opt/mol-docker && npx vitest run src/utils/webpayRetornoContinuar.test.ts
```

**Output (excerpt):**

```
 FAIL  src/utils/webpayRetornoContinuar.test.ts [ src/utils/webpayRetornoContinuar.test.ts ]
Error: Failed to resolve import "./webpayRetornoContinuar" from "src/utils/webpayRetornoContinuar.test.ts". Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

Exit code: 1. Fallo esperado: el módulo de implementación aún no existía.

### GREEN (Step 4)

**Command:**

```bash
cd /opt/mol-docker && npx vitest run src/utils/webpayRetornoContinuar.test.ts
```

**Output:**

```
 ✓ src/utils/webpayRetornoContinuar.test.ts (2 tests) 6ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  08:54:14
   Duration  1.37s
```

Exit code: 0.

## Files Changed

| File | Action |
|------|--------|
| `src/utils/webpayRetornoContinuar.test.ts` | Created — 2 casos vitest según brief |
| `src/utils/webpayRetornoContinuar.ts` | Created — `destinoDesdePaso`, `motivoContinuarError`, tipos `DestinoContinuarWebpay` y `MotivoContinuarWebpay` |

No se tocó ninguna vista Vue (queda para Task 4). No se commiteó `backups/` ni docs sueltos.

## Implementation Summary

- `DestinoContinuarWebpay`: `'webpay' | 'elegir-arancel' | 'plan-pagare' | 'firma' | 'forma-pago'`
- `destinoDesdePaso(paso: PasoWebpay)`: mapea `tipo` 1:1 salvo `flujo-pagare` → `'forma-pago'` (fallthrough)
- `MotivoContinuarWebpay`: `'medio_null' | 'monto_invalido' | 'identidad' | 'crear_webpay'`
- `motivoContinuarError`: identity tipada para forzar literales en call sites

`PasoWebpay` se importa de `@/utils/webpaySiguientePaso`. El helper es puro; no tiene I/O ni side-effects.

## Commit

- **SHA:** `86f8b1de9fb1faae4533a8d6ea9e3676e52ed69a`
- **Subject:** feat(webpay): helper destino/motivo telemetría retorno

Repo: `/opt/mol-docker`, branch `dev` (3 commits ahead of `origin/dev`). No se hizo push.

## Self-Review

- Test e implementación copiados verbatim del brief.
- Los 5 variantes de `PasoWebpay` (`firma`, `webpay`, `elegir-arancel`, `plan-pagare`, `flujo-pagare`) están cubiertos por el test.
- `concepto` no altera el destino: el mapeo es solo por `tipo`, como pide el brief.
- `motivoContinuarError` no valida en runtime; el union de TypeScript es el contrato.
- Diff limitado a los dos archivos del helper (51 líneas). Ninguna vista ni store importan el helper todavía.

## Concerns

Ninguna bloqueante.

- Si `PasoWebpay` gana un `tipo` nuevo, `destinoDesdePaso` cae en `'forma-pago'` por el `return` final. Es el diseño del brief, no un `never` exhaustivo.
- `motivoContinuarError` es identity: no clasifica strings libres, solo estrecha literales en call sites de Task 4.
