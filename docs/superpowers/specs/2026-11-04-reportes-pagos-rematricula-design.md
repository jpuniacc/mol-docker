# Reportes: pagos rematrícula (MVP tablero en MOL)

**Fecha:** 2026-11-04  
**Estado:** aprobado en brainstorming  
**Proyecto:** mol-docker (+ RPC Supabase)  
**Rollout:** mol-dev → uniacc-mol tras prueba OK  

## Problema

Operaciones pide un menú de **reportes tipo Power BI** dentro de MOL: ver matriculados del periodo con qué pagaron (matrícula / arancel), cuántos Webpay y montos, etc. Hoy hay KPI, Matriculados y Conciliación Transbank, pero no un tablero unificado alumno × pago.

## Decisiones

| Tema | Decisión |
|------|----------|
| Dónde | **Dentro de MOL** (no Power BI externo en MVP) |
| UX paneles | **A:** paneles fijos + filtros + export; **B** (armar layout) tras revisar el MVP |
| Datos | **B→D:** matriculados del periodo + Webpay matrícula/arancel; otros medios = fase 2 |
| Acceso | Mismos perfiles que **KPI / Matriculados** |
| Enfoque técnico | Vista/RPC en vivo (sin cubo batch nuevo) |
| Canal MOL | Embudo `etapa_actual = matriculado` (manda) |
| Canal BO | `mnp_matricula_cartera_canal` canal BO (batch diario) |

## Alcance MVP

### Menú y ruta

- Ítem de menú staff: **Reportes**.
- Pantalla: **Pagos rematrícula**.
- Ruta lazy: `dashboard-reportes-pagos-rematricula` → `ReportesPagosRematriculaView.vue`.
- Visibilidad: mismo criterio que KPI / Matriculados (si el menú vive en catálogo BD, alta de ítem + `route_name`).

### Filtros

- Periodo = **periodo activo** (como KPI).
- Canal: Todos / MOL / BO.
- Búsqueda por RUT (y opcional nombre/codcli).
- Export CSV del listado filtrado (cliente).

### Paneles fijos (tarjetas)

1. Matriculados: total / MOL / BO.  
2. Webpay matrícula: cantidad de alumnos con al menos una tx autorizada + suma $.  
3. Webpay arancel: idem.  
4. Matriculados MOL **sin** Webpay matrícula autorizada (operativo).

### Tabla

Columnas mínimas: RUT, nombre, carrera, canal (MOL|BO), pagó matrícula (sí/no), monto mat, pagó arancel (sí/no), monto arancel, fechas de última tx autorizada por concepto (si aplica).

## Modelo de datos (lectura)

**Universo matriculados (unión sin duplicar `codcli`):**

- MOL: filas de `mnp_progreso_rematricula` con `etapa_actual = 'matriculado'` del periodo.
- BO: filas de `mnp_matricula_cartera_canal` con `canal = 'BO'` del periodo.
- Si un `codcli` aparece en ambos, **prioriza MOL**.

**Webpay:** `mnp_webpay_transaccion` con `estado = 'autorizada'` y `concepto IN ('matricula','arancel')`, join por `codcli` + `anio_periodo` + `semestre_periodo`.

**Varias tx del mismo concepto:** la **última autorizada** por `actualizado_en` (desempate `creado_en`); no sumar montos en MVP.

## Arquitectura

```text
Periodo activo
    → RPC listar_reporte_pagos_rematricula(periodo, canal?, q?)
    → RPC kpi_reporte_pagos_rematricula(periodo, canal?)
Front ReportesPagosRematriculaView
    → tarjetas + tabla + CSV
```

- Migración Supabase con las dos RPC (`SECURITY DEFINER`, grant a roles de lectura staff que ya use el KPI).
- Servicio front `reportesPagosRematriculaApi.ts`.
- Sin tabla materializada en MVP.
- Tests unitarios de helpers de cruce/última tx; verificación manual en mol-dev con periodo 2027-1.

## Bordes

- Matriculado MOL sin Webpay matrícula: fila visible; mat = no / $0 (pagaré u otro = fase 2).
- BO sin Webpay: esperado.
- Desfase BO vs embudo: aceptado (BO diario); MOL siempre al día vía embudo.
- Conciliación bancaria Transbank **no** se mueve a este menú; sigue en su pantalla.

## Fuera de alcance (fase 2+)

- Paneles reordenables / layout por usuario (opción B del brainstorm).
- Otros medios (pagaré, caja, etc.).
- Cortes por carrera/jornada/día en gráficos avanzados.
- Embed Power BI / Metabase.

## Criterios de éxito

- Staff con acceso a KPI ve **Reportes → Pagos rematrícula**.
- Con filtro Todos, **Por MOL** de las tarjetas coincide con embudo matriculado del periodo.
- Un alumno con Webpay matrícula y arancel autorizados muestra ambos montos.
- CSV descarga el conjunto filtrado actual.
- Tras uso del MVP, se evalúa si conviene fase B (paneles armables).

## Rollout

1. Migración RPC + front + menú en **mol-dev**.  
2. Prueba con periodo activo y muestra de RUTs conocidos (MOL con/sin Webpay, BO).  
3. Deploy **uniacc-mol** + commit/merge `dev`/`qa`/`main` como el resto de rematrícula.
