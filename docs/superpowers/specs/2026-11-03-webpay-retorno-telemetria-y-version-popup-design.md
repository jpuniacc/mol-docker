# Webpay retorno: telemetría (+ popup versión diferido)

**Fecha:** 2026-11-03  
**Repos:** mol-docker (front) + uniacc-api-docker (volver Webpay)  
**Estado:** telemetría aprobada para implementar; **popup de versión diferido**  
**Mock copy (diferido):** canvas `popup-sitio-actualizado.canvas.tsx`

## Contexto

Caso CES RUT `21858393-8` (Renato Meza): ambos Webpay quedaron `autorizada` vía API `volver` (~13:02), pero `cuenta.grabar` recién a las 22:17. No hay eventos de montaje de retorno ni de Continuar en `log_mol_evento`, así que no se puede separar “no volvió de TBK” vs “volvió y se trabó en el front”.

## Objetivos (este ciclo)

1. Registrar en timeline MOL el retorno Webpay (API + front) y el Continuar.

## Diferido (próximo ciclo)

- Popup “Se ha actualizado el sitio” (`version.json` + poll + foco + reload duro).
- Copy ya acordado: *Hay una versión nueva de la rematrícula. Actualiza la página para continuar sin errores. No perderás tu avance.* / CTA *Actualizar*.

## No objetivos

- Limpiar `sessionStorage` / Pinia / borrador remoto.
- Service Worker / skipWaiting.
- Panel o alerta automática de alumnos “atrapados” (solo documentar query operativa).
- Cambiar la lógica de `siguientePaso` / Continuar → firma.

## Decisiones (telemetría)

| Tema | Decisión |
|------|----------|
| Telemetría | Front + API `volver` → `registrar_log_mol_evento` (`categoria: webpay`) |

## Arquitectura — Telemetría Webpay retorno

**Front** — nuevo `webpayAuditLog.ts` (mismo patrón que `formaPagoAuditLog.ts`):

| Acción | Momento | Payload mínimo |
|--------|---------|----------------|
| `retorno` | `onMounted` de `WebpayRetornoAlumnoView` | `buy_order`, `estado` (si hay fila), `error` query, `autenticado` |
| `continuar_ok` | tras `avanzarSiAutorizada` sin marcar reintentar | `buy_order`, `destino` (`webpay` \| `elegir-arancel` \| `plan-pagare` \| `firma` \| `forma-pago`) |
| `continuar_error` | error / `medioMatricula == null` / monto inválido | `buy_order`, `motivo` |

RPC fallido → `console.warn`; no bloquea UI.

**API** — en `volverWebpayHttp` (alumno), después de `procesarVolver` y antes del `redirect`:

- `categoria: webpay`, `accion: volver`
- Payload: `clasificacion`, `buy_order`, `estado`, y si la fila existe: `concepto`, `codcli`, montos/periodos útiles
- Identidad: `rut_alumno` / `codcli` desde fila (`codcli` Webpay = RUT sin DV habitualmente); no bloquear redirect si falta académico
- Fallo del insert → log warn; **siempre** redirigir al MOL

Path QA (`volverWebpayQaHttp`): mismo helper si el costo es bajo; si no, solo alumno prod en este ciclo.

## Query operativa (fuera de producto)

Alumnos con matrícula + arancel Webpay `autorizada` y sin `cuenta.grabar` en ≤30 min (cruzar por RUT normalizado). Documentar SQL en el plan; no UI.

## Pruebas

- API: helper de payload + `volver` registra evento; redirect ocurre aunque falle el RPC.
- Front: servicio audit (tipos/acciones); wiring en vista (manual o test del helper de destino/motivo).
- Manual: retorno Webpay deja `webpay.volver` + `webpay.retorno`; Continuar deja `continuar_ok` o `continuar_error`.

## Criterios de éxito

1. Un retorno Webpay completo deja al menos `webpay.volver` (API) y `webpay.retorno` (front); Continuar deja `continuar_ok` o `continuar_error`.
2. Casos tipo Renato se diagnostican en timeline sin adivinar.

## Archivos previstos (orientativo)

**mol-docker:** `webpayAuditLog.ts`; `WebpayRetornoAlumnoView.vue` (+ helper puro si hace falta test).

**uniacc-api-docker:** helper log volver + `rematricula-alumno-webpay.controller.ts` + test.
