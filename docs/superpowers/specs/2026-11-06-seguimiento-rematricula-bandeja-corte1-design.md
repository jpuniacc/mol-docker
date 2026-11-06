# Seguimiento rematrícula — bandeja unificada (CORTE 1)

**Fecha:** 2026-11-06  
**Estado:** diseño aprobado (brainstorming)  
**Proyectos:** `mol-docker` (UI) + `uniacc-api-docker` (API) + Supabase/Postgres (migraciones)  
**Rollout:** solo **mol-dev / uniacc-desarrollo**. No prod (`uniacc-mol`) sin OK explícito.  
**Wireframes:** `docs/wireframes/seguimiento-rematricula-v2/` (`01`–`03` + `PLAN.md` + `PROMPT-AGENTE-CURSOR-CORTE-1.md`)

## Objetivo

Bandeja staff de **toda la cartera del embudo** (no solo Pagos+Firmas): KPI clicables, filtro por ejecutivo, tabla operativa, panel de caso, bitácora de contacto (notas) e indicadores de retención Mail 2h / SMS 24h en **lectura**.

## Fuera de alcance (CORTE 2+)

- Composer correo/SMS (plantillas, WYSIWYG, firma imagen).
- Envío real (Email From ejecutivo / Celmedia).
- Scheduler que encola/despacha outbox 2h/24h.
- WhatsApp (botón deshabilitado «próximamente» en CORTE 1).
- Grabar pago temprano en U+.

## Decisiones

| Tema | Decisión |
|------|----------|
| Enfoque | API nueva de bandeja + vista nueva (no mashup front-only ni extender Gestión Pagos) |
| Menú | **Nueva entrada** «Seguimiento rematrícula»; **coexiste** con Gestión Pagos y Gestión Firmas |
| Vista logs | **No** reutilizar `RematriculaSeguimientoView` |
| Embudo datos | Mantener **7** etapas en `mnp_progreso_rematricula`; **mapear** 8 chips en UI |
| Chip «Firmado · pdte U+» | Etapa actual `firma` (`firmaOk` && !matriculado) |
| Chip «Contrato / firma pendiente» | Señal real de “pendiente de firmar” ya usada en firmas/KPI (sin inventar estado BD) |
| Cartera | Mismo criterio que firmas/avisos: `email_ejecutivo` |
| Permisos | `alcanceCartera`: perfil **3** = solo su cartera; perfiles **1/2** = completa + «Ver todas» + filtro ejecutivo |
| Retención P | M = matrícula Webpay autorizada && !F (firma incompleta) |
| Outbox | **Crear esquema** `mnp_retencion_outbox` en este corte; **sin** scheduler |
| Envío UI | Botones correo/SMS/WhatsApp deshabilitados o «próximamente»; **Agregar nota** sí |
| From automáticos | Diferido a CORTE 2 (DVU institucional propuesto vs ejecutivo) |

## Datos

### Fuente embudo

Reutilizar `mnp_progreso_rematricula` y criterios de KPI / CAE / ministerial / resto ya existentes (`etapaProgresoRematricula`, `RematriculaKpiView`, RPC/KPI asociados). No inventar estados.

### Mapeo UI 8 chips ← 7 etapas

| # | Chip wireframe | Señal |
|---|----------------|--------|
| 1 | Sin ingreso | `sin_ingreso` |
| 2 | Ingresó (sin TyC) | `ingreso` |
| 3 | TyC OK · datos faltantes | `tyc` |
| 4 | Datos OK · sin forma de pago | `datos` |
| 5 | Forma de pago | `etapa_actual = forma_pago` **y** aún no está “listo para firmar” (medios/arancel incompletos; subchips CAE · min. · Ambos · Resto) |
| 6 | Contrato / firma pendiente | Misma etapa BD `forma_pago` (o hitos equivalentes) **pero** ya listo para firmar / contrato en curso y `!firmaOk` — partición **exclusiva** vs chip 5; predicado anclado a criterios reales de forma de pago + Gestión Firmas en el plan |
| 7 | Firmado · pdte U+ | `etapa_actual = firma` (hoy etiqueta “Contrato firmado”: `firmaOk` && !matriculado) |
| 8 | Matriculado U+ | `matriculado` |

Los 8 chips son una **partición** de la cartera (sin doble conteo). No se agrega valor de enum en BD; el split 5/6 es solo de presentación/consulta.

Auxiliares: Sin contactar +7d · Mail 2h pdte/enviado · SMS 24h pdte/enviado.

### `mnp_seguimiento_contacto` (nueva, append-only)

No usar `mnp_caso_rematricula`.

Campos orientativos:

- `id`, `codcli`, `rut_norm`, `anio_periodo`, `semestre_periodo`
- `autor_email`, `canal` (`llamada|whatsapp|correo|sms|presencial|sistema|nota`)
- `origen` (`manual|auto`)
- `resultado`, `nota`, `respuesta_alumno`
- `proxima_accion`, `proxima_accion_en`
- `created_at`

RLS / acceso solo staff. Sin UPDATE/DELETE de negocio (append-only).

### `mnp_retencion_outbox` (nueva; esquema CORTE 1)

- Unique `(rut_norm, anio_periodo, semestre_periodo, tipo)` con `tipo` ∈ `mail_2h|sms_24h`
- `due_at`, `estado` ∈ `pendiente|enviado|cancelado|error`, `sent_at`, `provider_id`, `error`
- Lectura en bandeja/panel: `enviado`+fecha / `pendiente` / `n/a` si !P
- Scheduler de envío = CORTE 2

### Derivados de fila

- Último contacto / próxima acción ← bitácora (última nota o evento con esos campos).
- Mat. Webpay sí/fecha ← tx Webpay matrícula autorizada (misma noción que reportes/gestión pagos).

## API (`uniacc-api-docker`)

Prefijo: `/api/rematricula/seguimiento`  
Auth: mismo gate staff que reportes rematrícula (`requiresAdminAdmision` / equivalente API).

### Cartera (servidor, obligatorio)

- Perfil 3: fuerza filtro `email_ejecutivo` = email de sesión (403 si pide otra).
- Perfil 1/2: cartera completa; query opcional `emailEjecutivo` (o “sin asignar”).
- El front no es la única barrera.

### Endpoints CORTE 1

1. `GET /kpi?anio&semestre[&emailEjecutivo]` — conteos embudo + subchips + auxiliares.
2. `GET /bandeja?anio&semestre&etapa?&subetapa?&q?&filtroAux?&emailEjecutivo?&limit&offset` — filas tabla.
3. `GET /casos/:codcli?anio&semestre` — resumen panel (contacto, medios, firmantes, ejecutivo, retención auto, bitácora reciente, outbox).
4. `POST /casos/:codcli/notas` — insert append-only (`canal=nota`, `origen=manual`).
5. `GET /casos/:codcli/bitacora` — timeline paginado.

No en CORTE 1: POST correo/SMS/WhatsApp, despacho outbox.

## UI (`mol-docker`)

- Vista: `BandejaSeguimientoRematriculaView.vue` (nombre fijable en plan).
- Ruta nueva (no colisionar con logs de `RematriculaSeguimientoView`).
- Menú: **Seguimiento rematrícula** junto a Gestión Pagos y Gestión Firmas.
- Layout alineado a wireframes `01`–`03`: chips, subchips, auxiliares, cartera, búsqueda, tabla, panel sheet/drawer, bitácora.
- Tokens: `#FF5B00`, navy; shadcn-vue + Tailwind; Composition API + TypeScript.
- Periodo: periodo activo (mismo patrón que Gestión Pagos / KPI), salvo que el plan justifique selector.

## Tests

### Automatizados

- API: cartera ejecutivo vs supervisor (403 cruzado); KPI/listado por etapa/subetapa; POST nota + GET bitácora; outbox → enviado/pdte/n/a según P.
- Front: mapeo 7→8 chips; `alcanceCartera`; parse estados mail/sms de fila.

### Smoke mol-dev

1. Ejecutivo (perfil 3): solo su cartera.
2. Supervisor (1/2): Ver todas + filtro ejecutivo.
3. Filtrar Forma de pago → CAE → Abrir → Agregar nota → visible en bitácora.
4. Caso P: bloque retención con outbox o stub; botones envío deshabilitados.
5. Menú: nueva entrada + Pagos + Firmas.
6. Sin envíos reales ni tocado a prod.

## Arquitectura (unidades)

| Unidad | Responsabilidad |
|--------|-----------------|
| Migraciones contacto + outbox | Esquema + RLS/permisos staff |
| Servicio seguimiento API | KPI, bandeja, caso, notas, bitácora + enforcement cartera |
| Cliente `seguimientoRematriculaApi.ts` | Tipado + fetch |
| `BandejaSeguimientoRematriculaView` | Embudo, filtros, tabla, panel |
| Helpers mapeo etapa UI | 7→8 + subchips + badges mail/sms |
| Tests unitarios API/front | Reglas anteriores |

## Riesgos / notas

- Split chip 5/6: hoy `formaPagoOk && !firmaOk` sigue en `forma_pago` en el resolver; el plan debe definir el predicado “listo para firmar” con hitos existentes (sin inventar) y tests de exclusión mutua 5∩6=∅, 6∩7=∅.
- Volumen cartera completa: paginación server-side en bandeja desde el día 1.
- Outbox vacío al inicio → indicadores en `n/a` o `pdte` stub sin inventar envíos.

## Entregables de implementación (post–writing-plans)

1. Plan superpowers limitado a CORTE 1.
2. Migración(es) + endpoints + vista + menú + tests.
3. Notas de smoke en mol-dev.
4. Lista de archivos tocados.
5. Lista explícita CORTE 2.
