# Webpay retorno: telemetría + popup “sitio actualizado”

**Fecha:** 2026-11-03  
**Repos:** mol-docker (front) + uniacc-api-docker (volver Webpay)  
**Estado:** aprobado en diseño; pendiente plan e implementación  
**Mock copy:** canvas `popup-sitio-actualizado.canvas.tsx`

## Contexto

Caso CES RUT `21858393-8` (Renato Meza): ambos Webpay quedaron `autorizada` vía API `volver` (~13:02), pero `cuenta.grabar` recién a las 22:17. No hay eventos de montaje de retorno ni de Continuar en `log_mol_evento`, así que no se puede separar “no volvió de TBK” vs “volvió y se trabó en el front”.

Además, tras rebuild de `mol-dev` el alumno puede quedar con JS viejo en memoria y no sabe hacer hard refresh.

## Objetivos

1. Registrar en timeline MOL el retorno Webpay (API + front) y el Continuar.
2. Avisar con popup cuando hay build nuevo y ofrecer reload duro sin perder avance.

## No objetivos

- Limpiar `sessionStorage` / Pinia / borrador remoto al actualizar.
- Service Worker / skipWaiting.
- Panel o alerta automática de alumnos “atrapados” (solo documentar query operativa).
- Cambiar la lógica de `siguientePaso` / Continuar → firma.

## Decisiones

| Tema | Decisión |
|------|----------|
| Acción del popup | Solo `location.reload()` (sesión y borrador intactos) |
| Detección de versión | `/version.json` generado en build + poll ~60s + `visibilitychange` |
| Telemetría | Front + API `volver` → `registrar_log_mol_evento` (`categoria: webpay`) |
| Copy popup | Título *Se ha actualizado el sitio*; cuerpo *Hay una versión nueva de la rematrícula. Actualiza la página para continuar sin errores. No perderás tu avance.*; CTA *Actualizar* |

## Arquitectura

### A. Version popup (mol-docker)

```
vite build → dist/version.json { "version": "<id>" }
App.vue monta useAppVersionCheck
  → fetch /version.json cache:no-store (60s + foco)
  → mismatch → AlertDialog → Actualizar → location.reload()
```

- **Id de versión:** string estable por build (p. ej. `Date.now()` o hash corto inyectado en build). Mismo valor en el JS bootstrapped y en el archivo servido.
- **Nginx:** location exacta `= /version.json` con `Cache-Control: no-store` (el `location /` ya es no-store; explicitar evita sorpresas si cambia el orden).
- **Dev:** si no existe o falla el fetch, no mostrar popup.
- **UX:** un solo dialog; sin botón cancelar; fallo de red = silencio.

### B. Telemetría Webpay retorno

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
- Identidad alumno: desde fila Webpay / buy_order (rut o codcli numérico); `codcli` académico si está en fila o se puede resolver sin fallar el request
- Fallo del insert → log warn; **siempre** redirigir al MOL

Mock/QA volver: mismo criterio si comparte helper; si no, al menos el path alumno prod.

## Query operativa (fuera de producto)

Alumnos con matrícula + arancel Webpay `autorizada` y sin `cuenta.grabar` en ≤30 min (cruzar por RUT normalizado). Documentar SQL en la spec del plan o en `docs/`; no UI en este ciclo.

## Pruebas

- Unit: comparación de versiones (igual / distinta / fetch fail).
- Unit: payloads / acciones de audit front (si hay helper puro).
- API: `volver` registra evento cuando commit OK; redirect ocurre aunque falle el RPC.
- Manual: rebuild front → tab abierta muestra popup → Actualizar carga assets nuevos; retorno Webpay deja filas en `log_mol_evento`.

## Criterios de éxito

1. Tras deploy, alumno con tab abierta ve el popup y al Actualizar corre el JS nuevo.
2. Un retorno Webpay completo deja al menos `webpay.volver` (API) y `webpay.retorno` (front); Continuar deja `continuar_ok` o `continuar_error`.
3. Casos tipo Renato se diagnostican en timeline sin adivinar.

## Archivos previstos (orientativo)

**mol-docker:** plugin o script Vite → `version.json`; `useAppVersionCheck`; componente dialog (o inline en App); `webpayAuditLog.ts`; cambios en `WebpayRetornoAlumnoView.vue`; `nginx/default.conf.template`.

**uniacc-api-docker:** `rematricula-alumno-webpay.controller.ts` (y helper de log si aplica) + test.
