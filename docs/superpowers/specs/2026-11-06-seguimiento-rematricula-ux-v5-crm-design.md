# Seguimiento rematrícula — UX v5 CRM HubSpot-lite

**Fecha:** 2026-11-06  
**Estado:** diseño aprobado (brainstorming)  
**Proyectos:** `mol-docker` (UI) + `uniacc-api-docker` (API lectura) + migraciones Supabase si aplica  
**Rollout:** **mol-dev / uniacc-desarrollo** only. No prod.  
**Wireframes:** `docs/wireframes/seguimiento-rematricula-v5-crm/` (01–05 + `PLAN.md` + `PROMPT-AGENTE-CURSOR-UX-V5-CRM.md`)

## Problema

La bandeja v3 se siente tablero de métricas (chips KPI). El producto pide experiencia **tipo CRM HubSpot**: lista/board + drawer de record, propiedades reales, timeline.

## Decisión de montaje (brainstorming)

| Tema | Decisión |
|------|----------|
| Montaje | **A:** reescribir `BandejaSeguimientoRematriculaView` **in-place** (misma ruta/menú) |
| Board datos | **B:** datos reales por columna |
| Board API | **B:** endpoint nuevo `GET .../board` |
| Alertas + timeline | **B:** alertas **filtrables** (+7d real) + eventos sistema **persistidos** en timeline |
| Entrega | **1:** un PR en capas (commits separables), smoke visual al final |

## Prioridad UX (no negociable)

1. Sensación CRM (densidad HubSpot Contacts/Deals), **no** dashboard KPI.  
2. Pixel fidelity a wireframes 01–05; apartarse solo documentado en el plan.  
3. Jerarquía: primarias claras; sin ruido “· corte 2”.  
4. Empty/skeleton; no hardcodear «—» si la API puede traer dato.  
5. Contraste navy `#1E3A5F` / naranja `#FF5B00`; focus visible.  
6. Matriculado U+: ausencia de Contactar/correo/SMS/WA **intencional** (“Caso cerrado…”).  
7. Smoke visual con **4 capturas**: Lista, Board, drawer en curso, drawer matriculado.

## Fuera de alcance

- Composer / envíos reales / scheduler (Corte 2).  
- Cambiar criterios de chips de negocio.  
- Deploy prod.

## Shell CRM (lista + filtros)

- Layout: sidebar ~220px + main.  
- Header: título · Cartera · buscar · Actualizar · toggle **Lista | Board** (default Lista).  
- Sidebar: Cartera (Mi / Todas según perfil) · Etapa embudo 1–8 · Alertas.  
- Tabla lean: Alumno (nombre+RUT+carrera) · Etapa(+detalle) · Último contacto · Próxima · Ejecutivo.  
- Clic fila → drawer.  
- Cartera: perfil 3 solo mía; supervisor Mi/Todas (+ filtro ejecutivo si Todas).  
- Sin chips KPI enormes arriba.

## Board

- `GET /api/rematricula/seguimiento/board?anio&semestre&emailEjecutivo?&q?&filtroAux?&limitPorColumna`  
- Respuesta: 8 columnas `{ chip, label, total, filas[] }` (mismas reglas de chip CORTE 1).  
- Tarjeta: nombre, detalle etapa, ejecutivo; clic → mismo drawer.  
- Respeta cartera / `q` / `filtroAux`. Preferencia: mostrar las 8 columnas con datos de la cartera (etapa sidebar puede enfatizar o filtrar — detallar en plan de implementación sin contradecir wireframe).

## Drawer (~480px + Teleport overlay)

**Cabecera:** nombre, RUT, codcli, chip etapa, carrera.

| Chip | Contactar ▾ | Agregar nota | Copy |
|------|-------------|--------------|------|
| 1–7 | Sí, **disabled** + tooltip “Próximamente” (sin texto “corte 2”) | Sí | — |
| 8 Matriculado U+ | **Ocultar** (también correo/SMS/WA) | **Sí** (única acción) | “Caso cerrado en embudo · solo consulta” |

**Propiedades (API):** email, teléfono, firmantes, ejecutivo, medios pago.

**Recordatorios automáticos:** visibles solo si **M && !F** (matrícula Webpay autorizada y firma incompleta); si no, “No aplican…”.

**Timeline:** bitácora manual + eventos `origen=sistema` (o tabla dedicada) en orden cronológico inverso.

## API

### Caso enriquecido — `GET .../casos/:codcli`

Además de la fila bandeja:

| Campo | Fuente (lectura) |
|-------|------------------|
| `email_alumno` | borrador / contacto OTP / datos alumno PG |
| `telefono` | idem (`fonoact` / payload) |
| `firmantes_resumen` | TuFirma (`rematricula_contrato_tufirma` / firmantes) |
| `medios_pago_resumen` | Webpay + borrador |

### Board — `GET .../board`

Una respuesta con 8 columnas; `limitPorColumna` default ~20.

### Alertas filtrables

- `filtroAux`: `sin_contactar_7d` \| `mail_2h_pdte` \| `sms_24h_pdte`  
- KPI alineados en `GET .../kpi`  
- `sin_contactar_7d`: sin fila manual en `mnp_seguimiento_contacto` en los últimos 7 días (o nunca), sobre el universo de cartera.

### Timeline sistema persistido

- Insertar eventos sistema en hitos ya existentes: Webpay matrícula autorizada, outbox mail/sms enviado, firma ready, matriculado U+.  
- Lectura unificada en bitácora del caso (manual + sistema).  
- Backfill puntual opcional para smoke (p.ej. Florencia); no cron pesado.

## Capas de implementación (commits)

1. API caso enriquecido + layout CRM lista/sidebar/drawer (sin board completo si hace falta).  
2. `GET /board` + toggle Board.  
3. `filtroAux` + KPI +7d / mail / sms filtrables.  
4. Persistencia eventos sistema + timeline unificado.  
5. Smoke visual (4 capturas) + smoke funcional en mol-dev.

## Smoke obligatorio

**Visual:** Lista · Board · drawer en curso · drawer matriculado.  
**Funcional:** (1) toggle Lista/Board, (2) drawer 1–7 con Contactar disabled + Agregar nota, (3) drawer chip 8 sin CTAs envío y con datos contacto si existen en BD.

## Archivos previstos (orientativo)

| Área | Archivos |
|------|----------|
| Front | `BandejaSeguimientoRematriculaView.vue`, posiblemente componentes `seguimiento/*`, `seguimientoRematriculaApi.ts` |
| API | `seguimiento-bandeja.service.ts`, controller/routes, tests |
| SQL | migración `filtroAux`/KPI +7d; opcional columnas/origen sistema en contacto |

## Relación con otros tracks

- Hotfix progreso Webpay: independiente (ya en mol-dev).  
- Corte 2: habilita Contactar real solo si chip ≠ matriculado.  
- v3 UI ajustes: absorbidos/reemplazados por este CRM.
