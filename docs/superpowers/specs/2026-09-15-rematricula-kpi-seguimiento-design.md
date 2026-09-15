# KPI Rematrícula + seguimiento por alumno

Fecha: 2026-09-15  
Proyecto: `mol-docker`  
Estado: diseño aprobado (pendiente plan de implementación)

## Problema

El backoffice necesita ver (1) cómo va la rematrícula en agregado y (2) en qué quedó cada alumno (TyC, datos, firma, etc.), con historial tipo log. Hoy existen tablas de auditoría (`log_sesion_usuario`, `log_mol_tyc_respuesta`, `log_mol_contacto_otp`, `log_mol_evento`, `v_log_mol_sesion_timeline`) pero no hay UI ni un modelo de progreso por matrícula.

## Decisión

**Enfoque:** tabla/vista de progreso materializada `mnp_progreso_rematricula`, recalculada por refresh (no escritura en vivo en cada click del portal).

**Dos pantallas:**

1. **Dashboard KPI** — embudo agregado del periodo.
2. **Seguimiento alumnos** (submenú Rematrícula) — fila por matrícula + timeline.

**Llave de seguimiento:** `codcli + anio_periodo + semestre_periodo`.

**Universo:** cartera oficial Rematrícula (`mnp_cartera_oficial`), cruzada con consolidado MOL del periodo para obtener `codcli`. Un RUT con dos carreras produce dos filas.

## Arquitectura

```
mnp_cartera_oficial (rut_norm)
        │ join rut
consolidado periodo (codcli, rut, carrera…)
        │
        ▼
mnp_progreso_rematricula  (PK: codcli, anio_periodo, semestre_periodo)
        │
        ├── KPI (COUNT por etapa_actual + tarjetas laterales)
        ├── Listado seguimiento
        └── Timeline → v_log_mol_sesion_timeline / log_mol_*
```

### Tabla `mnp_progreso_rematricula` (mínimo)

| Campo | Uso |
| --- | --- |
| `codcli`, `anio_periodo`, `semestre_periodo` | Llave |
| `rut`, nombre, carrera/jornada | Identidad desnormalizada |
| `etapa_actual` | Embudo |
| `ultima_actividad_en`, `ultima_actividad_label` | Resumen en listado |
| `es_mock`, `excluido_mol`, `rematriculable` | Flags |
| `sin_match_mol` | En cartera sin `codcli` en consolidado (ver abajo) |
| `actualizado_en` | Timestamp del último refresh |

**Refresh:** `refresh_mnp_progreso_rematricula(anio, semestre)` — botón en UI; opcional cron después. Los logs del portal ya se escriben; el progreso se **deriva**.

**Caso sin `codcli`:** RUT en cartera sin match en consolidado del periodo → fila de seguimiento con `sin_match_mol = true` (y `codcli` nulo o sentinel acordado en implementación). No entra al denominador del embudo MOL.

## Reglas del embudo (`etapa_actual`)

Orden estricto; gana la etapa más avanzada. Periodo = periodo activo de rematrícula.

| Etapa | Criterio v1 |
| --- | --- |
| `sin_ingreso` | En universo y sin sesión/evento MOL para la llave |
| `ingreso` | ≥1 sesión o evento MOL ligado a la llave |
| `tyc` | Última TyC = `acepta` (`log_mol_tyc_respuesta`) |
| `datos` | Hitos de datos ya logueados (OTP contacto OK y/o apoderado + discapacidad según eventos actuales) |
| `forma_pago` | Plan de pago confirmado en flujo MOL (evento/negocio existente) |
| `firma` | Contrato firmado (fuente de negocio “estado firma”, no solo un log suelto) |
| `matriculado` | Matriculado en el periodo (fuente actual de matriculados) |

**Última actividad:** evento más reciente de timeline/logs, con label legible.

**Fuera del embudo de conversión MOL:**

- `excluido_mol` (SUBDERE / exclusión) → visible en listado; **fuera** del denominador del embudo.
- `sin_match_mol` → cola/badge aparte; no rompe KPIs del embudo.

**KPIs v1:** conteos por `etapa_actual` (dónde están) + tarjetas: total cartera, excluidos MOL, sin match.

## Pantallas

### A) `dashboard-rematricula-kpi`

- Periodo activo (solo lectura del mantenedor).
- Tarjetas + embudo simple (sin gráficos fancy).
- Botón **Actualizar progreso**.

### B) `dashboard-rematricula-seguimiento`

- Tabla: RUT, nombre, `codcli`, carrera, `etapa_actual`, última actividad, badges (`excluido`, `sin_match`, `mock`).
- Filtros: búsqueda RUT/nombre/`codcli`, filtro por etapa.
- **Ver timeline** → sheet/dialog sobre `v_log_mol_sesion_timeline` (hora Chile, categoría, acción, detalle).

### Acceso

Mismos grupos que el resto del menú Rematrícula (lectura operativa backoffice; no solo TI).

## Flujo y errores

1. Abrir KPI/Seguimiento → leer progreso del periodo activo.
2. Tras carga de cartera o datos viejos → refresh.
3. Timeline solo lee logs; no recalcula progreso.

| Situación | Comportamiento |
| --- | --- |
| Refresh falla | Toast; se mantienen números anteriores |
| Sin eventos | Timeline vacío: “Sin actividad en MOL” |
| Sin periodo activo | Bloquear con mensaje al mantenedor de periodo |

## Prueba mínima

- Cartera sin ingreso → `sin_ingreso`.
- TyC aceptado → etapa ≥ `tyc`.
- Dos `codcli` mismo RUT → dos filas.
- SUBDERE/excluido → fuera del denominador del embudo.
- Timeline muestra eventos ya registrados.

## Fuera de alcance (v1)

Export CSV masivo, alertas, asignación de ejecutivo, edición manual de etapa, gráficos avanzados, bandeja NEDA SUBDERE, escritura de progreso en cada click del portal.

## Criterio de éxito

Un usuario de Rematrícula ve el embudo del periodo y, al buscar un RUT/codcli, entiende la etapa actual, la última actividad y el historial de eventos sin salir del backoffice.

## Dependencias existentes

- `mnp_cartera_oficial` (hoy PK solo `rut_norm`; el join aporta `codcli`).
- Auditoría: `log_mol_*`, `v_log_mol_sesion_timeline`, `registrar_log_mol_evento`.
- Fuentes de firma/matriculado ya usadas por `EstadoFirmaContratoView` / `MatriculadosView`.
- Spec relacionada: `2026-09-15-subdere-fuera-mol-design.md`.
