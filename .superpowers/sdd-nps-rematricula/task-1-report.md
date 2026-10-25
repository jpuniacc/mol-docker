# Task 1 Report: Utilidades puras + tests (NPS rematrícula)

**Status:** DONE_WITH_CONCERNS

**Commit:** `9d7e599` — feat(nps): utilidades de facilidad 1-5 para rematrícula

**Branch:** `dev`

---

## What Was Built

### `src/utils/npsRematricula.ts`

Utilidades puras TypeScript (sin Vue, sin DB) para calificación NPS de facilidad 1–5 en rematrícula.

| Export | Propósito |
|--------|-----------|
| `CalificacionNps` | Tipo `1 \| 2 \| 3 \| 4 \| 5` |
| `esCalificacionNps(n)` | Guard: entero en rango 1..5 |
| `normalizarComentarioNps(calificacion, comentario)` | 4–5 → siempre `null`; 1–3 → trim, vacío → `null`, máx. 500 chars |
| `promedioNps(calificaciones)` | Media aritmética o `null` si vacío |
| `distribucionNps(calificaciones)` | Conteos `{1..5}` (ceros incluidos) |
| `tasaRespuestaNps(respuestas, finalizados)` | Ratio o `null` si `finalizados <= 0` |

### `src/utils/npsRematricula.test.ts`

5 tests Vitest según brief (verbatim).

---

## TDD Evidence

### RED (módulo inexistente)

**Command:**
```bash
npx vitest run --config vitest.unit.config.ts src/utils/npsRematricula.test.ts
```

**Output:**
```
 RUN  v2.1.9 /opt/mol-docker

 ❯ src/utils/npsRematricula.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/utils/npsRematricula.test.ts [ src/utils/npsRematricula.test.ts ]
Error: Failed to load url ./npsRematricula (resolved id: ./npsRematricula) in /opt/mol-docker/src/utils/npsRematricula.test.ts. Does the file exist?
 ❯ loadAndTransform node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:51969:17

 Test Files  1 failed (1)
      Tests  no tests
   Start at  17:21:32
   Duration  886ms (transform 77ms, setup 0ms, collect 0ms, tests 0ms, environment 0ms, prepare 138ms)
```

**Nota:** El comando del brief `npm run test:unit -- src/utils/npsRematricula.test.ts` falla al cargar config (`Cannot merge config in form of callback` en `vitest.config.ts` + `vite.config` callback). Workaround establecido en SDD previos: `vitest.unit.config.ts`.

### GREEN (implementación)

**Command:**
```bash
npx vitest run --config vitest.unit.config.ts src/utils/npsRematricula.test.ts
```

**Output:**
```
 RUN  v2.1.9 /opt/mol-docker

 ✓ src/utils/npsRematricula.test.ts (5 tests) 8ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  17:21:43
   Duration  893ms (transform 82ms, setup 0ms, collect 69ms, tests 8ms, environment 0ms, prepare 117ms)
```

---

## Files Changed

| Archivo | Acción |
|---------|--------|
| `src/utils/npsRematricula.ts` | creado |
| `src/utils/npsRematricula.test.ts` | creado |

Solo estos dos archivos en el commit (sin WIP ajeno).

---

## Self-Review

| Criterio | Resultado |
|----------|-----------|
| Código verbatim del brief | OK |
| Tests verbatim del brief | OK |
| TDD: RED visto antes de implementar | OK (módulo no existe) |
| TDD: GREEN 5/5 | OK |
| `esCalificacionNps` rechaza 0, 6, 3.5 | OK |
| Comentario 4–5 siempre null | OK |
| Trim + límite 500 en 1–3 | OK |
| `promedioNps([])` → null; `[5,3]` → 4 | OK |
| `distribucionNps` ceros explícitos | OK |
| `tasaRespuestaNps(0,0)` → null; `(2,10)` → 0.2 | OK |
| Sin Vue / sin DB | OK |
| Tipos explícitos, sin `any` | OK |

---

## Concerns / Limitaciones

1. **`npm run test:unit` roto preexistente:** `vitest.config.ts` hace `mergeConfig(viteConfig, …)` y `vite.config.ts` exporta callback → `Cannot merge config in form of callback`. No se tocó (fuera de scope). Tests corren con `npx vitest run --config vitest.unit.config.ts …`.
2. **Sin tests de NaN/`Infinity` en `esCalificacionNps`:** coherente con brief; `Number.isInteger` ya los rechaza.

---

## Next Task

Task 2+ dependerá de estos exports: `CalificacionNps`, `esCalificacionNps`, `normalizarComentarioNps`, `promedioNps`, `distribucionNps`, `tasaRespuestaNps`.
