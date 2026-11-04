# Correo al reservar descuento de matrícula (CAE / ministerial)

**Fecha:** 2026-11-04  
**Proyectos:** `mol-docker` (migración RPC), `uniacc-api-docker` (outbox + template)

## Decisión

- Solo al **primer** INSERT en `mnp_reserva_descuento_matricula`.
- Un correo: Para = correo validado; CC = ejecutivo + `mol@uniacc.cl`.
- Sin correo validado: To = ejecutivo o `mol@` (no omitir).
- Tipo outbox: `RESERVA_DESCUENTO_MATRICULA`.
