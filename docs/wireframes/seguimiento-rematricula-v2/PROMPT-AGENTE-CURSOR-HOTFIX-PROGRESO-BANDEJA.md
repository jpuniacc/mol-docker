# Prompt Cursor — HOTFIX progreso bandeja (antes de CORTE 2)

Usa `/usingsuperpowers`: brainstorming breve → writing-plans (plan corto) → implementación en rama **`dev`**. **Solo este hotfix.** No composer, no retención, no WhatsApp.

## Contexto
UNIACC MOL (Vue3 front `mol-docker` + API `uniacc-api-docker` + SQL Supabase). Solo **uniacc-desarrollo / mol-dev**. No tocar prod. Respaldo antes de cambios SQL. Nunca mostrar secretos. Git: `dev` → `qa`/`main` con OK explícito.

Caso repro (mol-dev, 2026-11-06): RUT `21067143-9` / codcli `20221TRIE1DR052` (Catalina).
- Alumna en UI alumno en **forma de pago** (matrícula Webpay autorizada, eligiendo arancel).
- Bandeja Seguimiento mostraba chip **«Sin ingreso»**.
- `mnp_progreso_rematricula.etapa_actual = sin_ingreso`, `actualizado_en` **antes** de la actividad del día.
- Tras `SELECT refresh_mnp_progreso_rematricula(2027,1)` → etapa pasó a **`datos`**, **no** a `forma_pago`.
- Logs: `tyc/acepta`, `contacto_otp/verificar_ok`, `apoderado`, `discapacidad`, `webpay/retorno|volver`. **No** hay `forma_pago/confirmado`.
- Borrador: `medioMatricula=webpay`, `webpayMatriculaEstado=autorizada`, `pasoAlcanzado=2`, `tycAccepted=true`.
- Webpay: `mnp_webpay_transaccion` buy_order `210671432027-1-118`, concepto `matricula`, estado `autorizada`, **`codcli` = RUT sin DV (`21067143`)**, no el codcli académico.

La bandeja CORTE 1 lee progreso vía API (`listar_mnp_progreso_rematricula` + `chipBandejaDesdeSenales`). Sin refresh fresco + sin reconocer Webpay como forma_pago, el embudo miente.

## Objetivo (2 partes)

### A) Progreso fresco al usar la bandeja
Al abrir / Actualizar la vista `BandejaSeguimientoRematriculaView`, disparar el mismo refresh que ya usan KPI/Casos/Seguimiento viejo:
- Front: `refreshProgresoRematricula(anio, semestre)` desde `@/services/progresoRematriculaApi` (RPC `refresh_mnp_progreso_rematricula`), **antes** (o en paralelo controlado) de cargar KPI/bandeja.
- UX: no bloquear eternamente; si el refresh falla, mostrar toast/error y aún así intentar listar (o fallar claro — decidir en plan, preferencia: refresh → luego listar; si refresh timeout, listar con aviso «datos pueden estar desactualizados»).
- Opcional mol-dev: documentar/cron cada N min **solo si** ya hay patrón en el proyecto; no inventar infra pesada. Prioridad = refresh al abrir bandeja.

### B) `forma_pago_ok` debe incluir Webpay matrícula autorizada (y/o borrador)
En `refresh_mnp_progreso_rematricula` (migración nueva en el repo que posee el SQL — hoy vive en `mol-docker/supabase/migrations/…` y está aplicada en Supabase mol-dev), ampliar la señal de forma de pago **sin romper** la existente (`categoria IN ('forma_pago','plan_pago','plan_pagos')`).

Propuesta (validar en plan con tests SQL / casos):
1. **Webpay:** existe fila en `mnp_webpay_transaccion` del periodo con `concepto='matricula'` AND `estado='autorizada'`, matcheada al alumno por:
   - `codcli` académico **o**
   - `codcli` / buy_order que sea el **RUT sin DV** (`rut_norm` sin K check) — porque en prod/dev el campo `codcli` de Webpay a veces guarda el RUT numérico (caso Catalina).
2. **Borrador (refuerzo):** `mol_borrador_rematricula.payload->>'webpayMatriculaEstado' = 'autorizada'` OR `payload->>'medioMatricula' IS NOT NULL` (webpay|pagare) con cuidado de no adelantar etapa solo por abrir el modal vacío — preferir estado autorizado o medio confirmado.
3. Resultado esperado para Catalina tras refresh: `etapa_actual = 'forma_pago'` → chip bandeja **5. Forma de pago** (no contrato_pdte: no hay TuFirma enviada).

**No** cambiar la partición chip 5/6 (`tufirmaEnviadaPendiente`).  
**No** grabar U+ temprano.

## Fuera de alcance
CORTE 2 (composer, outbox, Celmedia), UI v3 (ya hecha), cron en prod, cambiar semántica de KPI históricos más allá de alinear etapa con realidad del flujo alumno.

## Entregables
1. Spec corta + plan (superpowers).  
2. Migración SQL + front bandeja (refresh on load/Actualizar).  
3. Test: Catalina (o fixture) → tras refresh `forma_pago`; alumno solo TyC+datos sin pago → `datos`; sin actividad → `sin_ingreso`.  
4. Smoke mol-dev: buscar RUT `21067143-9` → chip Forma de pago; botón Actualizar refresca.  
5. Lista de archivos tocados. Confirmar que CORTE 2 sigue pendiente.

## Evidencia ya tomada (mol-dev)
- Refresh manual ya corrido una vez → quedó en `datos` (confirma gap B).  
- Tras este hotfix, volver a refresh y verificar `forma_pago`.
