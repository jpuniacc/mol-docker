# Task 3 Report: Conectar router, barra y botón Enviar a firmar

## Status

DONE

## Base commit

`9098fb9` — feat(rematricula): recordar en la sesión que el contrato ya se envió a firmar

## Commit

`0adfed1` — fix(rematricula): no dejar volver atrás después de enviar el contrato a firmar

## Test command and output

```bash
npx vitest run --config vitest.unit.config.ts src/utils/pasoAlumnoRematricula.test.ts src/stores/matriculaAlumnoContext.test.ts
```

```
 RUN  v2.1.9 /opt/mol-docker

 ✓ src/utils/pasoAlumnoRematricula.test.ts (6 tests) 9ms
 ✓ src/stores/matriculaAlumnoContext.test.ts (2 tests) 18ms

 Test Files  2 passed (2)
      Tests  8 passed (8)
   Start at  14:50:22
   Duration  1.25s (transform 271ms, setup 0ms, collect 455ms, tests 26ms, environment 1ms, prepare 293ms)
```

**Result:** PASS — 8 tests.

## Files changed

| File | Change |
|------|--------|
| `src/views/matricula-alumno/FirmaAlumnoView.vue` | Eliminado `envioIniciado` local; `anteriorDeshabilitado` usa `alumnoCtx.envioFirmaIniciado`; `enviarAFirmar` llama `marcarEnvioFirmaIniciado()` antes de `enviando.value = true`. |
| `src/router/index.ts` | Import `rutaSiEnvioFirmaBloquea`; guard tras `firmaCompletada` redirige datos/forma-pago → firma con `replace: true`. |
| `src/views/matricula-alumno/MatriculaAlumnoLayout.vue` | Import `pasoBloqueadoTrasEnvio`; `pasoBloqueado` y setter de `stepModel` delegan en esa utilidad; removido `matriculaCerrada` (lógica absorbida por la util). |

## Self-review

- **Orden en router:** El bloque `firmaCompletada → resumen` sigue antes que `rutaSiEnvioFirmaBloquea`, como pide el brief.
- **Sin side effects en navegación:** Router y layout no importan ni invocan `ensureContratoFirma` ni `postGrabarPlanPagos` (verificado con grep).
- **FirmaAlumnoView:** El `ensure` existente dentro de `enviarAFirmar` no se tocó; solo se cambió el origen de la bandera de envío al store Pinia.
- **Stepper:** Clic en pasos bloqueados no navega porque el setter usa `pasoBloqueado(v)`; pasos 1 y 2 quedan bloqueados tras envío; paso 4 sigue accesible cuando `firmaCompletada`.
- **Lint:** Sin errores en los tres archivos editados.

## Concerns

- Ninguna técnica bloqueante. La verificación manual del brief (navegador atrás, URL directa, red sin ensure/grabar en redirect) no se ejecutó en esta sesión; depende de QA manual.

## Manual verification checklist (from brief)

- [ ] Antes de Enviar a firmar: Anterior y paso Forma de pago funcionan.
- [ ] Después de Enviar a firmar: Anterior deshabilitado; pasos 1–2 no navegan; atrás/URL forma-pago → firma sin POST ensure/grabar en esa navegación.
- [ ] Reenvío con documento existente: mismo número de operación.
- [ ] Tras firmas completas: pantalla resumen.

---

## Review fix (post-0adfed1)

### Status

DONE

### Commit

`db83e12` — fix(rematricula): no abrir el retorno de Webpay a sesiones que no son de alumno — restaurado el guard `!alumnoOk && isAlumnoFlowRoute(to.name)` sin excepción adicional para Webpay; añadido test de ruta no textual en `rutaSiEnvioFirmaBloquea`.

### Test command and output

```bash
npx vitest run --config vitest.unit.config.ts src/utils/pasoAlumnoRematricula.test.ts src/stores/matriculaAlumnoContext.test.ts
```

```
 RUN  v2.1.9 /opt/mol-docker

 ✓ src/utils/pasoAlumnoRematricula.test.ts (7 tests) 9ms
 ✓ src/stores/matriculaAlumnoContext.test.ts (2 tests) 18ms

 Test Files  2 passed (2)
      Tests  9 passed (9)
   Start at  14:54:08
   Duration  1.27s (transform 305ms, setup 0ms, collect 468ms, tests 27ms, environment 1ms, prepare 301ms)
```

**Result:** PASS — 9 tests.

### Files changed (review fix)

| File | Change |
|------|--------|
| `src/router/index.ts` | Quitada excepción `matricula-alumno-webpay-retorno` del bloque `!alumnoOk`. |
| `src/utils/pasoAlumnoRematricula.test.ts` | Caso `undefined` como nombre de ruta en `rutaSiEnvioFirmaBloquea`. |
