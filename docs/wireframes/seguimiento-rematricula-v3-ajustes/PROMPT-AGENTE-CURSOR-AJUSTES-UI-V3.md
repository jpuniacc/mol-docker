# Prompt Cursor — Seguimiento rematrícula · AJUSTES UI (post CORTE 1)

Usa `/usingsuperpowers`: brainstorming breve → writing-plans (plan corto) → implementación en rama **`dev`**. **Solo front UI** sobre lo ya desplegado en mol-dev. No tocar scheduler, composer, Celmedia ni WhatsApp.

## Contexto
UNIACC MOL (Vue3/Vite/Tailwind/shadcn, front `mol-docker`). Trabajo solo en **uniacc-desarrollo / mol-dev**. No tocar prod (`uniacc-mol`). Respaldo antes de cambios. Nunca mostrar secretos. Flujo git: `dev` → `qa` → `main` solo con OK explícito.

CORTE 1 ya está en mol-dev: `BandejaSeguimientoRematriculaView`, API `rematricula-seguimiento`, tablas `mnp_seguimiento_contacto` + `mnp_retencion_outbox` (schema), menú “Seguimiento rematrícula” (`codigo_grupo=1`). Smoke A–E OK.

## Fuente de verdad (este PR)
`/opt/mol-docker/docs/wireframes/seguimiento-rematricula-v3-ajustes/`
- `01-gap-asis-vs-v2.png` — mapa de brechas
- `02-bandeja-ajustada.png` — TO-BE bandeja
- `03-panel-ajustado.png` — TO-BE panel
- `04-checklist-cambios.png` — checklist del PR
- `PLAN.md`

Referencia visual original (no reabrir alcance corte 1):  
`/opt/mol-docker/docs/wireframes/seguimiento-rematricula-v2/` (01–03).

## Objetivo
Alinear la UI AS-IS de `BandejaSeguimientoRematriculaView` al wireframe v3 **sin cambiar reglas de negocio** del embudo/cartera/bitácora.

### Bandeja
1. Chips del embudo **numerados 1–8** (mismo orden CORTE 1). Chip activo naranja `#FF5B00`; inactivos navy suave.
2. KPI auxiliares visibles: **Sin contactar +7d**, **Mail 2h** (pdte/enviado/n/a), **SMS 24h** (pdte/enviado/n/a).
3. Cartera: pill/toggle “Mi cartera” / “Ver todas” (perfil 3 fuerza sesión; otros según `alcanceCartera`). Filtro ejecutivo cuando “Ver todas”.
4. Columna **Etapa** con color por chip (no texto plano gris).
5. Quitar / ocultar texto debug o IDs internos visibles al usuario (si hay).
6. Tabla: Alumno (nombre+RUT) · Carrera · Etapa · Subetapa F.pago · Mat. Webpay · Mail 2h · SMS 24h · Último contacto · Próxima acción · Ejecutivo · Abrir.

### Panel caso
1. Overlay / drawer alineado a `03-panel-ajustado.png` (cabecera alumno + RUT + etapa).
2. Bloque contacto alumno (tel/email si la API ya los trae; si no, placeholder “—” sin inventar endpoints nuevos salvo que falte un campo ya en el payload).
3. Bloque **Retención automática**: si no aplica P=M&&!F → estado **n/a** con texto breve (“No aplica: sin matrícula Webpay o firma ya completa”). Si aplica → pdte/enviado + fecha.
4. Botones Enviar correo / Enviar SMS / WhatsApp siguen **deshabilitados o “próximamente”** (CORTE 2).
5. Agregar nota + timeline bitácora sin cambios de contrato API.

## Restricciones
- **No** modificar migraciones, criterios de chips, `email_ejecutivo` / `alcanceCartera`, ni `mnp_retencion_outbox` salvo lectura UI.
- Chip 6 = solo forma_pago + TuFirma enviado !ready (no `formaPagoOk&&!firmaOk`).
- No copiar a prod. Trabajar en `dev`.
- UI: naranja `#FF5B00`, navy existente del MOL.

## Entregables
1. Plan corto (superpowers) limitado a estos ajustes UI.
2. PR / commits en `dev` (front mol-docker).
3. Lista de archivos tocados.
4. Notas de smoke visual en mol-dev (chips 1–8, +7d, cartera, panel n/a, sin debug).
5. Confirmar explícitamente qué queda para CORTE 2 (composer + envío + unificación retención).

## Fuera de alcance (CORTE 2)
Composer WYSIWYG + firma imagen, envío manual, scheduler outbox vs `mol_retencion_aviso`, WhatsApp real. Ver  
`/opt/mol-docker/docs/wireframes/seguimiento-rematricula-v2/PROMPT-AGENTE-CURSOR-CORTE-2.md`.
