# Seguimiento rematrícula — UX v5 CRM HubSpot-lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la bandeja v3 por un CRM HubSpot-lite (lista + board + drawer) con datos de contacto reales, alertas filtrables y timeline sistema, solo en mol-dev.

**Architecture:** Reescritura in-place de `BandejaSeguimientoRematriculaView` + componentes `src/components/seguimiento/*`. API: enriquecer caso, nuevo `GET /board`, `filtroAux` (+ KPI +7d), eventos `origen=sistema` en `mnp_seguimiento_contacto`. Misma semántica de chips CORTE 1. Entrega en capas con commits separables.

**Tech Stack:** Vue 3 + TS + Tailwind + shadcn-vue + Lucide · Express/TS uniacc-api · Postgres/Supabase · Vitest / node:test

**Spec:** `docs/superpowers/specs/2026-11-06-seguimiento-rematricula-ux-v5-crm-design.md`  
**Wireframes:** `docs/wireframes/seguimiento-rematricula-v5-crm/` (01–05)

## Global Constraints

- Solo **mol-dev / uniacc-desarrollo**; no prod.
- Sensación **CRM HubSpot**, no dashboard KPI; pixel fidelity a 01–05.
- Naranja `#FF5B00`, navy `#1E3A5F`.
- **No** cambiar predicado chips 5/6/7.
- Contactar disabled tooltip **«Próximamente»** (nunca texto «corte 2»).
- Chip 8: solo Agregar nota + copy «Caso cerrado en embudo · solo consulta».
- No composer / envíos / scheduler (Corte 2).
- Board: **8 columnas siempre** con datos de la cartera filtrada; el filtro etapa del sidebar aplica a **Lista**; en Board solo **enfatiza** la columna (borde/scroll), no oculta las demás (fidelidad frame 02).
- Cartera: perfil 3 = mía; 1/2 = Mi/Todas + select ejecutivo si Todas (`filtroEjecutivo===''` = Ver todas).

## File map

| Archivo | Rol |
|---------|-----|
| `uniacc-api-docker/src/services/seguimiento-caso-enrichment.ts` (+ test) | email/tel/firmantes/medios |
| `uniacc-api-docker/src/services/seguimiento-bandeja.service.ts` | board, filtroAux, KPI +7d, caso enriquecido |
| `uniacc-api-docker/src/controllers/rematricula-seguimiento.controller.ts` | HTTP board + query filtroAux |
| `uniacc-api-docker/src/routes/rematricula-seguimiento.routes.ts` | `GET /board` |
| `mol-docker/supabase/migrations/20261106200000_seguimiento_v5_crm.sql` | origen `sistema`; índices bitácora si faltan |
| `mol-docker/src/services/seguimientoRematriculaApi.ts` | tipos + fetch board/caso enriquecido |
| `mol-docker/src/components/seguimiento/SeguimientoFiltrosSidebar.vue` | sidebar ~220px |
| `mol-docker/src/components/seguimiento/SeguimientoListaTabla.vue` | tabla lean |
| `mol-docker/src/components/seguimiento/SeguimientoBoard.vue` | 8 columnas |
| `mol-docker/src/components/seguimiento/SeguimientoCasoDrawer.vue` | drawer CRM |
| `mol-docker/src/views/dashboard/rematricula/BandejaSeguimientoRematriculaView.vue` | shell: header + toggle + orquesta |
| Hooks Webpay / TuFirma / matricular | insert evento sistema (Task 4) |

---

### Task 1: Enrichment caso (API) — email / tel / firmantes / medios

**Files:**
- Create: `uniacc-api-docker/src/services/seguimiento-caso-enrichment.ts`
- Create: `uniacc-api-docker/src/services/seguimiento-caso-enrichment.test.ts`
- Modify: `seguimiento-bandeja.service.ts` (`obtenerCasoSeguimiento` → objeto caso rico)
- Modify: controller respuesta `/casos/:codcli`

**Interfaces:**
- Produces:
```ts
export type CasoSeguimientoDetalle = FilaBandejaSeguimiento & {
  email_alumno: string | null
  telefono: string | null
  firmantes_resumen: string | null
  medios_pago_resumen: string | null
  firma_completa: boolean
}
export async function enriquecerCasoSeguimiento(
  fila: FilaBandejaSeguimiento,
  anio: number,
  semestre: number,
): Promise<CasoSeguimientoDetalle>
```

**Fuentes (lectura, en orden de preferencia):**
1. `mol_borrador_rematricula.payload` → emails/tel/medios si existen keys usadas por el flujo alumno.
2. Último `log_mol_contacto_otp` / tablas de contacto del periodo con email/tel verificados.
3. TuFirma: firmantes del contrato del periodo → `"Alumna + Apoderado · 1/2 firmados"` / `"2/2 firmados"`.
4. Webpay: matrícula/arancel autorizada → `"Mat. Webpay ✓ · Arancel …"`.
5. `firma_completa` = chip `matriculado` **o** TuFirma `ready` **o** etapa firma completa según señales ya usadas en bandeja.

- [ ] **Step 1:** Tests unitarios con fixtures (mock query results o funciones puras de parse payload/firmantes).
- [ ] **Step 2:** RED → implementar → GREEN (`node --import tsx --test …enrichment.test.ts`).
- [ ] **Step 3:** `obtenerCasoSeguimiento` retorna `CasoSeguimientoDetalle` (null si fuera de cartera).
- [ ] **Step 4:** Commit  
  `feat(seguimiento): enriquecer GET caso con email/tel/firmantes/medios`

---

### Task 2: Shell CRM lista + sidebar + drawer (front, sin board)

**Files:**
- Create: `SeguimientoFiltrosSidebar.vue`, `SeguimientoListaTabla.vue`, `SeguimientoCasoDrawer.vue`
- Modify: `BandejaSeguimientoRematriculaView.vue` (reemplazar layout KPI chips)
- Modify: `seguimientoRematriculaApi.ts` (tipos caso enriquecido)

**UI rules:**
- Sidebar 220px: Cartera · Etapa 1–8 (conteos KPI) · Alertas (conteos; click aún no filtra hasta Task 3 — mostrar números, `cursor-pointer` preparado).
- Header: título «Seguimiento rematrícula» · subtítulo CRM · Cartera · buscar · Actualizar · toggle Lista|Board (Board disabled o placeholder hasta Task 3 si aún no hay API — preferible mostrar toggle; Board toast «Cargando…» solo tras Task 3).
- Tabla lean columnas del wireframe 01.
- Drawer Teleport body z-50/51; chip≠matriculado → Contactar disabled «Próximamente» + Agregar nota; chip matriculado → solo nota + copy cerrado.
- Propiedades: mostrar valor API o «—» **solo** si null real.
- Recordatorios: si `mat_webpay_fecha` && !`firma_completa` mostrar mail/sms estados; else «No aplican…».
- Mantener `refreshProgresoRematricula` antes de cargar (hotfix).

- [ ] **Step 1:** Extraer sidebar/lista/drawer; cablear estado chipActivo / q / filtro ejecutivo.
- [ ] **Step 2:** Drawer usa `fetchSeguimientoCaso` enriquecido + bitácora + dialog nota existente.
- [ ] **Step 3:** Quitar chips KPI grandes y texto «corte 2».
- [ ] **Step 4:** Smoke manual mol-dev (lista + drawer). Commit  
  `feat(seguimiento): shell CRM lista, filtros y drawer v5`

---

### Task 3: `GET /board` + vista Board

**Files:**
- Modify: `seguimiento-bandeja.service.ts` → `listarSeguimientoBoard`
- Modify: controller + routes `GET /board`
- Create: `SeguimientoBoard.vue`
- Modify: API client + vista (toggle)

**Interfaces:**
```ts
export type ColumnaBoard = {
  chip: ChipBandeja
  label: string
  total: number
  filas: FilaBandejaSeguimiento[]
}
export async function listarSeguimientoBoard(opts: {
  anio: number
  semestre: number
  emailEjecutivo: string | null
  q?: string | null
  filtroAux?: FiltroAuxSeguimiento | null
  limitPorColumna?: number // default 20
}): Promise<ColumnaBoard[]>
```

**Implementación:** una pasada `cargarUniverso` (o reutilizar bandeja sin chip) → particionar por `chip` → slice `limitPorColumna` + `total` = count completo por chip. Respeta `q` y `filtroAux` (Task 4 puede llegar junto; si `filtroAux` aún no existe, aceptar param y no-op hasta Task 4).

**Front:** 8 columnas horizontales scroll; tarjeta nombre + detalle + ejecutivo; clic → drawer. Etapa activa en sidebar: `ring` naranja en esa columna + `scrollIntoView`.

- [ ] **Step 1:** Test servicio: 8 columnas; totales coherentes; limit recorta filas.
- [ ] **Step 2:** HTTP + client `fetchSeguimientoBoard`.
- [ ] **Step 3:** `SeguimientoBoard.vue` + toggle Lista|Board.
- [ ] **Step 4:** Commit  
  `feat(seguimiento): GET /board y vista Board CRM v5`

---

### Task 4: Alertas filtrables (`filtroAux` + KPI +7d)

**Files:**
- Modify: `seguimiento-bandeja.service.ts` (filtro + KPI)
- Modify: controller bandeja/kpi/board query `filtroAux`
- Modify: sidebar alertas clickeables
- Tests unitarios filtro

**Interfaces:**
```ts
export type FiltroAuxSeguimiento = 'sin_contactar_7d' | 'mail_2h_pdte' | 'sms_24h_pdte'
```

**Reglas:**
- `sin_contactar_7d`: en universo, `ultimo_contacto` null **o** `ultimo_contacto < now()-7d` (solo origen manual para “contactar”).
- `mail_2h_pdte` / `sms_24h_pdte`: filas con outbox UI `pdte`.
- KPI: añadir `sin_contactar_7d: number` (además de mail/sms ya existentes).
- Sidebar: click alerta setea `filtroAux` (toggle off si mismo); Lista y Board lo respetan.

- [ ] **Step 1:** Tests filtro puro sobre filas sintéticas.
- [ ] **Step 2:** Aplicar en `listarSeguimientoBandeja` / board / kpi.
- [ ] **Step 3:** UI sidebar + pills activas.
- [ ] **Step 4:** Commit  
  `feat(seguimiento): filtroAux alertas +7d mail/sms en bandeja CRM`

---

### Task 5: Timeline sistema persistido

**Files:**
- Create: `mol-docker/supabase/migrations/20261106200000_seguimiento_v5_crm.sql`  
  `ALTER … CHECK (origen IN ('manual','auto','sistema'))` (recrear constraint).
- Create: `uniacc-api-docker/src/services/seguimiento-evento-sistema.ts`  
  `registrarEventoSistema({ codcli, anio, semestre, canal, nota, rut_norm? })` → INSERT `origen='sistema'`, `autor_email='sistema@mol'`.
- Wire calls (mínimo viable):
  1. Tras Webpay matrícula `autorizada` (servicio webpay commit path).
  2. Tras marcar outbox `enviado` (si existe writer; si no, skip + TODO Corte 2).
  3. Tras TuFirma ready / matricular contrato firmado.
- Bitácora GET ya lista todos los orígenes — UI drawer distingue icono Sistema vs nota.
- Opcional: script SQL backfill 1 RUT smoke (Florencia) documentado en plan notes, no obligatorio en CI.

- [ ] **Step 1:** Migración apply mol-dev.
- [ ] **Step 2:** Helper + test insert/idempotencia simple (mismo hito no duplicar el mismo día: unique parcial opcional o check previo).
- [ ] **Step 3:** Hooks en 1–2 puntos reales (Webpay + matricular).
- [ ] **Step 4:** Drawer timeline muestra sistema + manual.
- [ ] **Step 5:** Commit  
  `feat(seguimiento): eventos sistema en bitácora CRM v5`

---

### Task 6: Deploy mol-dev + smoke + capturas

**Files:** none (ops + notas)

- [ ] **Step 1:** Apply SQL migrations en mol-dev; rebuild `uniacc-api` + `mol-dev`.
- [ ] **Step 2:** Smoke funcional:
  1. Toggle Lista/Board
  2. Drawer chip ≠ 8: Contactar disabled + Agregar nota
  3. Drawer matriculado: sin Contactar; datos email/tel si BD tiene
  4. Alerta +7d filtra lista
- [ ] **Step 3:** 4 capturas (Lista, Board, drawer curso, drawer matriculado) → guardar en `docs/wireframes/seguimiento-rematricula-v5-crm/smoke/` o adjuntar al PR.
- [ ] **Step 4:** Lista archivos tocados + confirmar Corte 2 pendiente.
- [ ] **Step 5:** Commit notas smoke si aplica  
  `docs(seguimiento): smoke UX v5 CRM mol-dev`

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| Shell CRM lista/filtros | T2 |
| Drawer reglas 1–7 vs 8 | T2 |
| Caso email/tel/firmantes/medios | T1 |
| GET /board + Board UI | T3 |
| Alertas filtrables +7d | T4 |
| Timeline sistema | T5 |
| Smoke 4 capturas + funcional | T6 |
| No composer / no prod / chips intactos | Global |

## Decisiones clavadas en plan (antes ambiguas)

- Board muestra **siempre 8 columnas**; etapa sidebar solo enfatiza.
- Eventos sistema usan `origen='sistema'` (migración amplía CHECK).
- Alertas usan `filtroAux` compartido lista/board/kpi.
