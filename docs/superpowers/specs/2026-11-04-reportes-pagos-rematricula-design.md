# Reportes: pagos rematrícula · Matriculados MOL

**Fecha:** 2026-11-04  
**Estado:** aprobado (wireframe completo)  
**Proyecto:** mol-docker (+ RPC Supabase)  
**Rollout:** mol-dev → uniacc-mol tras prueba OK  
**Referencia UI:** wireframes «Pagos rematrícula · Matriculados MOL» (KPI + gráficos + tabla + empty state)

## Problema

Operaciones necesita, dentro de MOL, un tablero tipo Power BI: matriculados MOL del periodo con medio de pago por concepto (matrícula / arancel), montos, pendientes y cortes por carrera/día. Ya existen KPI de embudo, Matriculados y Conciliación Transbank, pero no un tablero unificado alumno × medio.

## Decisiones

| Tema | Decisión |
|------|----------|
| Dónde | Dentro de MOL (no Power BI externo en esta entrega) |
| Universo | Solo **Matriculados MOL** del periodo activo |
| Medios | **Webpay / Pagaré / Pendiente** por concepto (matrícula y arancel) |
| Canal BO | Fuera de este tablero (queda en Matriculados / cartera canal) |
| Acceso | Mismos perfiles que KPI / Matriculados |
| Enfoque técnico | Vista + RPC en vivo (sin cubo batch) |
| UI | Layout fijo según wireframe (no paneles reordenables) |

## Universo de alumnos

- Fuente: `mnp_progreso_rematricula` con `etapa_actual = 'matriculado'` + periodo activo.
- Excluir quienes tienen fila `canal = 'BO'` en `mnp_matricula_cartera_canal` del mismo periodo.
- `fec_mat` = `coalesce(canal_MOL.fec_mat, progreso.etapa_desde)`.

**Fuera de universo:** alumnos que pagaron (p. ej. Webpay autorizado) pero **no** están en etapa matriculado (casos operativos tipo cartola Redcompra). Ese corte no es este reporte.

## Clasificación de medio por concepto

Fuentes: `mol_borrador_rematricula.payload` (`medioMatricula` / `medioArancel`, cuotas) + `mnp_webpay_transaccion` (`estado = 'autorizada'`, `concepto` ∈ matrícula|arancel).

| Resultado | Regla |
|-----------|--------|
| **Pagaré** | Borrador indica `pagare`. Monto = suma de cuotas del ítem (`MATRICULA` / `ARANCEL`). Detalle: N cuotas + `fechaInicio` si existe. |
| **Webpay** | Borrador indica `webpay` **y** existe tx autorizada. Monto y fecha = última autorizada (`actualizado_en` / `creado_en`). |
| **Pendiente** | Sin medio, medio desconocido, o `webpay` sin tx autorizada. |

Varias tx del mismo concepto: se toma la **última** autorizada; no se suman montos.

No se cruza TuFirma, `cuentaWebpayGrabada` (sesión) ni grabado real en U+ (`MT_CTAPAG`). El reporte refleja **borrador + Webpay MOL**, no confirmación ERP.

## Alcance de UI

### Menú y ruta

- Menú staff: **Reportes → Pagos rematrícula**.
- Ruta lazy: `dashboard-reportes-pagos-rematricula` → `ReportesPagosRematriculaView.vue`.
- Visibilidad: mismo criterio que KPI / Matriculados.

### Filtros y export

- Periodo = periodo activo.
- Carrera (select), Medio (Todos / Webpay / Pagaré / Pendiente), búsqueda RUT/nombre (debounce).
- Limpiar filtros.
- Export **CSV** y **Excel** del listado filtrado (cliente).

### KPIs (fila superior)

1. **Matriculados MOL** — total; subtítulo +hoy / +últimos 7 días (por `fec_mat`).
2. **Matrícula** — N de total con medio (webpay+pagaré), %; desglose Webpay / Pagaré / Pendiente (+ montos donde aplique).
3. **Arancel** — idem.
4. **Pendientes** — alerta: sin medio en matrícula / sin medio en arancel; acción «Ver» → chip Matrícula pendiente (o Arancel si matrícula ya está en 0) + scroll a detalle.

### Gráficos

1. Línea: matriculados MOL acumulados por día vs acumulado con medio de matrícula (rango 14 días / todo).
2. Dos donas: medio por concepto (matrícula / arancel); centro = total del universo filtrado por carrera/búsqueda de servidor.
3. Barras horizontales apiladas por carrera (Webpay / Pagaré / Pendiente) con toggle Matrícula ↔ Arancel; clic en carrera aplica filtro.

Colores: Webpay `#059669`, Pagaré `#4D98C5`, Pendiente `#f59e0b`. Tokens UNIACC del shell (navy / celeste / pink CTA / Montserrat). Sin glassmorphism oscuro ni paletas genéricas del skill.

### Tabla «Detalle de alumnos MOL»

- Chips con conteo: Todos · Matrícula Webpay/pagaré/pendiente · Arancel Webpay/pagaré/pendiente (`aria-pressed`).
- Columnas: Alumno (nombre + RUT), Carrera, Matrícula (badge medio · monto · subdetalle fecha o cuotas), Arancel (idem), Matriculado (`fec_mat`).
- Ordenamiento; paginación; empty state con mensaje que cite búsqueda/filtros activos + CTA Limpiar.
- Badges: color + texto (no solo color).

### a11y / UX (ui-ux-pro-max)

- Chips = `<button aria-pressed>`; wrap, no overflow oculto.
- Empty state explícito; focus visible; `prefers-reduced-motion` en spinners/transiciones.
- Tooltips de gráficos; KPI con número + texto (barra no es el único indicador).

## Arquitectura

```text
Periodo activo
  → kpi_reporte_pagos_rematricula(anio, semestre, carrera?)
  → listar_reporte_pagos_rematricula(anio, semestre, carrera?, q?)
Front ReportesPagosRematriculaView
  → KPIs + ECharts + chips + tabla + CSV/Excel
Helpers reportePagosRematricula.ts (serie, donas, carrera, filtros, export)
```

- Migraciones: `20261104180000_reporte_pagos_rematricula.sql` (v1) y `20261104200000_reporte_pagos_rematricula_v2_mol_medios.sql` (v2 vigente).
- Servicio: `reportesPagosRematriculaApi.ts`.
- Tests unitarios de helpers de clasificación / serie / export.

## Bordes aceptados

- Pagaré sin borrador persistido → **pendiente** aunque exista en U+.
- Webpay elegido sin tx autorizada → **pendiente**.
- Medio «caja» u otros ERP → no modelados.
- Desfase vs grabado U+ / TuFirma → aceptado; Gestión de firmas y conciliación Transbank siguen en sus pantallas.

## Fuera de alcance

- Canal BO en este tablero.
- Paneles reordenables por usuario.
- Embed Power BI / Metabase.
- Cruce TuFirma / firmantes / PDF.
- Confirmación de cuotas en U+.
- Universo «pagó y no matriculó».

## Criterios de éxito

- Staff con acceso a KPI ve Reportes → Pagos rematrícula.
- Total Matriculados MOL del tablero coincide con embudo matriculado MOL del periodo (misma regla de exclusión BO).
- Alumno con Webpay matrícula + pagaré arancel muestra ambos medios/montos.
- Chip «Matrícula pendiente» y empty state se comportan como el wireframe.
- CSV/Excel descargan el conjunto filtrado actual.
- UI alineada a wireframes y tokens UNIACC (no tema oscuro genérico).

## Rollout

1. RPC v2 + front + menú en **mol-dev**.
2. Prueba periodo activo 2027-1: muestra con Webpay, pagaré y pendiente; empty state; exports.
3. Deploy **uniacc-mol** + ramas `dev`/`qa`/`main` como el resto de rematrícula.

## Estado de implementación

Al aprobar este spec, el código v2 (RPC + vista + helpers + tests) **ya cubre** el alcance anterior. Trabajo residual: gaps visuales/a11y vs wireframe y verificación en mol-dev — no un greenfield.
