# Task 4 – UI KPI (desglose + badges + filtro)

**Estado:** DONE

**Archivo modificado:** `src/views/dashboard/rematricula/RematriculaKpiView.vue`

## Cambios
- Imports de `@/utils/esperaFormaPagoKpi`, constantes `FILTROS_ESPERA`, `ORDEN_BUCKETS_ESPERA`, `KPI_KEY_BUCKET`, estado `filtroEspera`.
- `desgloseFormaPago` (computed): 4 líneas bajo la etapa Forma de pago, clic -> `abrirFormaPagoConFiltro(bucket)`.
- `alumnosFiltrados`: tras búsqueda de texto, si `etapa === 'forma_pago'` aplica `coincideFiltroEspera(bucketEsperaFormaPago(...), filtroEspera)`.
- Chips de filtro (solo en forma_pago) bajo el Input; `seleccionarFiltroEspera` también reinicia `filasVisibles`.
- `toggleEtapa` resetea `filtroEspera` a `'todos'` al abrir una etapa.
- Badges `CAE` / `Ministerial` junto al badge de permanencia (lógica de permanencia intacta).
- Helpers en script; sin ternarios anidados nuevos en el template.

## Verificación
- `npx vitest run --config vitest.unit.config.ts src/utils/esperaFormaPagoKpi.test.ts src/utils/etapaProgresoRematricula.test.ts` -> 23/23 PASS.
- `vue-tsc --noEmit`: sin errores en `RematriculaKpiView.vue`.

## Notas
- Si `abrirFormaPagoConFiltro` se invoca con la etapa ya abierta, solo cambia el filtro (no recarga ni limpia búsqueda).
- Sin test de componente (no requerido por el brief); verificación visual no ejecutada.

## Fix: clic desglose filtra bucket exacto de espera
- Problema: el desglose cuenta buckets exclusivos (cae = espera_cae AND NOT ministerial), pero el clic aplicaba el chip inclusivo `cae` (incluye `ambos`), mostrando más filas que el conteo.
- `RematriculaKpiView.vue`: nuevo `filtroBucketExacto` (`ref<BucketEsperaFormaPago | null>`).
  - `alumnosFiltrados` (forma_pago): si hay bucket exacto, `bucketEsperaFormaPago(...) === exacto`; si no, `coincideFiltroEspera` (inclusivo, sin cambios).
  - `abrirFormaPagoConFiltro(bucket)`: selecciona el chip equivalente (resaltado) y luego fija `filtroBucketExacto = bucket`.
  - `seleccionarFiltroEspera` (chips) limpia `filtroBucketExacto`; `toggleEtapa` también lo reinicia.
- Sin cambios en SQL ni en `esperaFormaPagoKpi.ts` (no se agregan tests nuevos).
- Tests: `npx vitest run --config vitest.unit.config.ts src/utils/esperaFormaPagoKpi.test.ts src/utils/etapaProgresoRematricula.test.ts` → 2 archivos, 23 tests passed.
- `vue-tsc --noEmit`: sin errores en `RematriculaKpiView.vue`.
