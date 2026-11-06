# Hotfix progreso bandeja (antes de CORTE 2)

**Fecha:** 2026-11-06  
**Estado:** diseño aprobado (brainstorming breve)  
**Ámbito:** mol-dev / `dev` only. No prod.  
**Prompt:** `docs/wireframes/seguimiento-rematricula-v2/PROMPT-AGENTE-CURSOR-HOTFIX-PROGRESO-BANDEJA.md`

## Problema

RUT `21067143-9` (Catalina): en alumno está en forma de pago (Webpay matrícula autorizada), pero la bandeja mostraba «Sin ingreso» / tras refresh manual quedó en `datos`. Causas:

1. Bandeja no llama `refresh_mnp_progreso_rematricula` al abrir/Actualizar.  
2. `forma_pago_ok` solo mira logs `forma_pago|plan_pago|plan_pagos`; no mira `mnp_webpay_transaccion` (donde `codcli` a veces es RUT sin DV) ni borrador.

## Decisiones

| Tema | Decisión |
|------|----------|
| Enfoque | **1:** ampliar SQL refresh + refresh en bandeja antes de listar |
| Señales forma_pago | **B:** Webpay matrícula `autorizada` (codcli académico **o** RUT sin DV / buy_order) **+** borrador (`webpayMatriculaEstado=autorizada` **o** `medioMatricula` ∈ webpay\|pagare) |
| Refresh UX | refresh → luego KPI/listar; si refresh falla → toast/aviso y listar igual |
| Chips 5/6 | sin cambio |

## Fuera de alcance

CORTE 2, UI v3, cron prod, grabar U+ temprano.

## Entregables

- Migración `20261106190000_progreso_forma_pago_webpay_borrador.sql`  
- `BandejaSeguimientoRematriculaView`: refresh on load / Actualizar  
- Smoke: Catalina → chip Forma de pago tras refresh  
