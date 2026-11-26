# KPI progreso: actividad preagregada

Estado: aprobado  
Fecha: 2026-11-26

## Problema

`refresh_mnp_progreso_rematricula(2027,1)` reconstruye ~5.4k filas escaneando logs del periodo (~18k filas) y tarda ~10 s. El front aborta a 8 s y muestra el modal Houston.

## Decisiones

- Entrega: timeout front + optimización Postgres.
- Frescura: unos minutos de atraso son aceptables.
- Enfoque: tabla física `mnp_progreso_actividad_periodo` (no vista materializada) + cron 5 min; el RPC del botón deja de escanear logs.

## Arquitectura

1. `refresh_mnp_progreso_actividad_periodo(anio, semestre)` hace DELETE+INSERT del scan de `log_mol_evento` / `log_mol_tyc_respuesta` / `log_mol_contacto_otp` (misma semántica que `actividad_codcli`, `actividad_rut`, `ultimo_log`, `ultima_tyc`) y marca `forma_pago_ok` desde Webpay/borrador (el join O(n×m) salió del RPC del KPI).
2. Filas `SIN_MATCH:<rut_norm>` llevan solo `tiene_ingreso` para el universo sin match MOL.
3. Cron API cada 5 min (periodo activo): actividad → progreso.
4. Post-matrícula: mismo orden en `refrescarKpi`.
5. `refresh_mnp_progreso_rematricula` lee la tabla; si está vacía o `max(actualizado_en)` > 15 min, refresca actividad una vez (cold path). Conserva TTL 60 s, lock `20261021`, etapas y hitos.
6. Front: timeout 8 s → 30 s.

## Éxito

- Progreso con actividad caliente ≤ 3 s.
- Cold path ≤ 25 s.
- KPI/etapas coherentes con el comportamiento previo.
