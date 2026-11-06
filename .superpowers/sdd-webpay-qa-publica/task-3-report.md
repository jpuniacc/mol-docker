# Task 3 report: Cliente y rutas Vue (MOL) Webpay QA pública

**Status:** DONE

**Commit:** efcefae feat(webpay-qa): pantalla pública de prueba sin login

## Implementado
- `src/services/webpayQaApi.ts`: `crearWebpayQa`, `obtenerWebpayQa` (parseo local `parseFilaQa` duplicando validaciones de `parseFilaPublica` + `token: string | null`), `guardarTokenQa`/`leerTokenQa` (sessionStorage), reexporta `redirigirAWebpay`. Timeout 60s con AbortController. `webpayPlusApi.ts` sin cambios.
- `src/router/index.ts`: rutas públicas `webpay-qa` y `webpay-qa-retorno` junto a `/proximamente`. `needsAuth` (solo `/dashboard`) y lista de proximamente sin cambios.
- `WebpayQaView.vue`: monto (1500), concepto (matricula/arancel), codcli (99999999), validación de entero > 0, error/enviando, guarda token y redirige.
- `WebpayQaRetornoView.vue`: lee `buy_order`/`error`, consulta transacción, muestra estado, buyOrder, token (`fila.token ?? leerTokenQa`), tipo de pago, cuotas, autorización; botones Copiar token y Nueva prueba.
- Commit incluye los 2 docs de docs/superpowers (estaban sin trackear). Nada más staged.

## Verificación
- `npx vue-tsc -p tsconfig.app.json --noEmit`: 66 errores preexistentes en otros archivos; 0 en archivos de esta task.
- No se ejecutó prueba en navegador ni E2E contra la API.

## Notas / concerns
- El `<select>` de concepto es nativo (no hay componente Select simple equivalente usado); estilo alineado a Input.
- El texto de tarjetas de prueba (VISA 4051 8856 0044 6623, RUT 11.111.111-1, clave 123) es el dato estándar de Transbank integración.
- Las vistas usan `bg-uniacc-orange` (clase ya usada en el repo).
