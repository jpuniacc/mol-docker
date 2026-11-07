# Seguimiento rematrícula v3 — ajustes UI sobre CORTE 1 (PROPUESTA)

Contrasta la UI ya desplegada en **mol-dev** (`BandejaSeguimientoRematriculaView`) con el wireframe v2 y propone cambios **solo de interfaz** (sin scheduler/composer aún).

## Origen
- AS-IS: código en `/opt/mol-docker` (mol-dev), corte 1.
- Referencia: `../seguimiento-rematricula-v2/` (embudo + panel + composer corte 2).

## Entregables
| Archivo | Contenido |
|---|---|
| `01-gap-asis-vs-v2.png` | Mapa de brechas AS-IS vs TO-BE |
| `02-bandeja-ajustada.png` | Bandeja con chips numerados, +7d, cartera pill, etapas coloreadas |
| `03-panel-ajustado.png` | Panel con overlay, contacto alumno, retención n/a explicada |
| `04-checklist-cambios.png` | Checklist PR front |

## Alcance / no alcance
- **Sí:** labels, colores, filtros auxiliares, UX panel/cartera, quitar texto debug.
- **No (corte 2):** WYSIWYG, firma imagen, enqueue 2h/24h, WhatsApp real.

## Nota infra (hoy)
Nginx de `mol-dev` / `supabase-dev` pasó de `uniacc_cl.crt` (solo leaf) a `uniacc_cl.pem` (fullchain). Respaldo: `/opt/mol-docker/backups/nginx-fullchain-20261106-122001`.

Stamp: DATOS FICTICIOS · PROPUESTA DE CAMBIO UI.

## Prompt Cursor
`PROMPT-AGENTE-CURSOR-AJUSTES-UI-V3.md` — pegar en Cursor con `/usingsuperpowers` sobre rama `dev` (solo front).
