# Vista pública Webpay QA (sin login)

Fecha: 2026-10-18  
Proyecto: `mol-docker` + `uniacc-api-docker`  
Estado: aprobado. Plan: [`docs/superpowers/plans/2026-10-18-webpay-qa-publica.md`](../plans/2026-10-18-webpay-qa-publica.md)  
Relacionado: [`2026-10-01-webpay-plus-design.md`](2026-10-01-webpay-plus-design.md), [`docs/webpay/tarjetas-de-prueba.md`](../../webpay/tarjetas-de-prueba.md)

## Problema

Para validar Webpay Plus en el portal de Transbank (ambiente de integración) hace falta crear transacciones, pagarlas con tarjetas de prueba y recuperar el `token` de creación. Hoy el flujo vive bajo `/dashboard/...` y exige login. Al volver de Transbank, MOL manda a `proximamente` o `login` y no hay una pantalla pública que muestre el resultado.

## Objetivo

Una URL pública en MOL, sin sesión, solo para certificación / QA de integración, que:

1. Cree una transacción Webpay Plus.
2. Redirija al formulario de Transbank.
3. Al volver, muestre el token de creación, el `buy_order` y el estado (`autorizada`, `rechazada`, `abortada`).

No entra al flujo de rematrícula del alumno.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Alcance | Solo certificación / QA. No reemplaza el Webpay del alumno. |
| Rutas MOL | Públicas, fuera de `/dashboard`: `/webpay-qa` y `/webpay-qa/retorno`. |
| Login / proximamente | No aplican. El guard del router no exige auth en esas rutas. |
| API | Endpoints nuevos de QA, separados del camino del alumno. |
| Ambiente | Solo si `WEBPAY_PLUS_AMBIENTE=integracion`. En producción responden 404/403. |
| `return_url` | `https://mol.uniacc.cl/api/webpay-qa/volver` (host según despliegue). |
| Retorno UI | `https://mol.uniacc.cl/webpay-qa/retorno?buy_order=...` |
| Persistencia | Reutiliza `mnp_webpay_transaccion`. `codcli` fijo de QA (p. ej. `99999999`) o editable en la pantalla. |
| Token en pantalla | El de creación (`token` al crear). Es el que pide el portal de Transbank. |

## Fuera de alcance

- Saltar el login del flujo real del alumno.
- Grabar en ERP.
- Reembolsos desde esta UI (se pueden hacer después por API / script).
- Timeout automático de 10 minutos en la UI (el operador deja el formulario abierto).
- Habilitar esto en producción.

## Piezas

### Front (MOL)

1. **`WebpayQaView.vue`** (`/webpay-qa`)  
   Formulario mínimo: monto, concepto (`matricula` \| `arancel`), opcional `codcli` (default QA). Botón “Ir a Webpay”. Llama a crear, guarda el token en `sessionStorage` por `buy_order`, y hace el POST `token_ws` a la URL de Transbank.

2. **`WebpayQaRetornoView.vue`** (`/webpay-qa/retorno`)  
   Lee `buy_order` de la query, consulta el estado, muestra token (desde `sessionStorage` o respuesta si el API lo expone solo en QA), estado, `payment_type_code`, cuotas. Botón para copiar el token y enlace “Nueva prueba”.

3. **Router**  
   Registrar ambas rutas al mismo nivel que `/login`. Excluirlas del gate de proximamente y de `needsAuth`.

### API (`uniacc-api`)

1. **`POST /api/webpay-qa/crear`**  
   Body: `{ monto, concepto, codcli?, anio?, periodo? }`.  
   Si ambiente ≠ integración → 404.  
   Usa el mismo `crearTransaccion` que el alumno, con `returnUrl` = `WEBPAY_PLUS_QA_VOLVER_URL`.  
   Defaults: `codcli=99999999`, `anio`/`periodo` del período activo o fijos 2027/1.

2. **`GET|POST /api/webpay-qa/volver`**  
   Igual que el volver del alumno (`clasificarRetorno` + `procesarVolver`), pero redirige 302 a `WEBPAY_PLUS_QA_MOL_RETORNO?buy_order=`.

3. **`GET /api/webpay-qa/transaccion?buy_order=`**  
   Devuelve la fila pública. En integración puede incluir el `token` de creación (solo QA) para no depender solo de `sessionStorage` si el navegador lo limpia.

4. **Env**  
   - `WEBPAY_PLUS_QA_VOLVER_URL`  
   - `WEBPAY_PLUS_QA_MOL_RETORNO`  
   Las credenciales de comercio siguen siendo las de integración ya configuradas.

## Flujo

```
Operador → GET /webpay-qa
         → POST /api/webpay-qa/crear
         → form POST token_ws → webpay3gint
         → Transbank → GET|POST /api/webpay-qa/volver
         → 302 /webpay-qa/retorno?buy_order=
         → GET /api/webpay-qa/transaccion
         → pantalla con token + estado
```

## Casos de prueba Transbank que cubre la UI

| Caso | Cómo |
| --- | --- |
| Crédito aprobado | VISA de prueba, sin cuotas |
| Con cuotas | VISA, elegir 3 cuotas en el formulario TBK |
| Débito aprobado | Redcompra de prueba |
| Crédito / débito rechazado | Tarjetas de rechazo |
| Anulada | “Anular compra y volver” en el formulario |
| Timeout | Abrir Webpay y esperar 10 min sin pagar |
| Reembolsos | Fuera de esta UI (script / API refund tras autorizar) |

## Seguridad

- Endpoints QA muertos fuera de integración.
- No se usa en el menú del dashboard.
- `codcli` de prueba no es un alumno real de la cartera.
- El token solo se muestra en la pantalla de retorno QA.

## Criterio de listo

- Abrir `https://mol.uniacc.cl/webpay-qa` sin login.
- Completar un pago aprobado y ver el token y estado `autorizada`.
- Anular y ver `abortada`.
- Con `WEBPAY_PLUS_AMBIENTE=produccion`, crear responde no encontrado.
