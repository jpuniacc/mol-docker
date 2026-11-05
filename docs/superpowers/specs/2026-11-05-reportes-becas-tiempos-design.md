# Reportes: Becas asignadas + Tiempos por tramo

**Fecha:** 2026-11-05  
**Estado:** aprobado  
**Proyecto:** mol-docker (+ RPC Supabase)  
**Rollout:** mol-dev → uniacc-mol tras pedido explícito  

## Problema

Operaciones necesita, junto al tablero de pagos, ver **becas realmente grabadas** en matriculados MOL (incl. cuántos bajaron % por Art. 13) y **dónde se demora** el embudo (media/mediana por tramo).

## Decisiones

| Tema | Decisión |
|------|----------|
| IA | Tres submenús bajo **Reportes**: Pagos rematrícula · Becas asignadas · Tiempos por tramo |
| Universo | Matriculados MOL del periodo (excluye canal BO), igual que pagos |
| Becas | Grabadas (POS mirror / plan consolidado), no solo cartera Excel |
| Art. 13 | Misma lógica que forma de pago; Talento `1744` ≥100 % omite tope 70 %, **sí** mide promedio |
| Tiempos | Agregados por tramo (media, mediana, n); sin detalle por alumno en MVP |
| Enfoque | RPCs hermanas; no hinchar `listar_reporte_pagos_rematricula` |

## Menú y rutas

```
Reportes
├── Pagos rematrícula          dashboard-reportes-pagos-rematricula
├── Becas asignadas            dashboard-reportes-becas-asignadas
└── Tiempos por tramo          dashboard-reportes-tiempos-tramo
```

Mismo acceso grupo 1 que KPI / Pagos.

## Becas asignadas

### KPIs

- Con ≥1 beca grabada / sin beca  
- Art. 13 (becas que exigen promedio): Mantiene · Baja · Pierde · Sin promedio  
- Monto total beneficios grabados (si hay monto)

### Tabla / export

Alumno, RUT, carrera, promedio anual, becas grabadas (código · descripción · % · monto), resultado Art. 13 del alumno, fecha matrícula.

### Resultado Art. 13 por alumno

Peor estado entre ítems que `exigeMedicionPromedio(renovable)`:

`PIERDE` > `BAJA` > `SIN_PROMEDIO` > `MANTIENE` > `NO_APLICA`.

Promedio usable = anual (`prom_anio`). Sin nota → `SIN_PROMEDIO` si la beca exige promedio.

**Talento Presencial `1744`:** con % efectivo ≥ 100 no aplica tope 70 % de internas; Art. 13 sí.

### Fuentes

- Universo: `mnp_progreso_rematricula` matriculado − BO  
- Becas: `mnp_mv_alumnos_beneficios` (periodo) y/o `beneficios_detalle` del plan consolidado  
- Promedio: plan consolidado / vista `prom_anio`  
- Catálogo renovable: `mnp_mv_beneficio_periodo` / `v_mnp_mv_convenios`  
- % base cartera (opcional): `mnp_cartera_beneficios` para comparar vs % grabado  

### RPC

- `listar_reporte_becas_rematricula(anio, semestre, carrera?, q?)`  
- `kpi_reporte_becas_rematricula(anio, semestre, carrera?)`

## Tiempos por tramo

### Tramos (horas)

1. ingreso → tyc  
2. tyc → datos  
3. datos → forma_pago  
4. forma_pago → firma  
5. firma → matriculado  

Por tramo: **n** (ambos hitos), **media**, **mediana**. Resaltar tramo con mayor mediana (“cuello de botella”).

### Hitos (MIN creado_en)

Alineados al embudo de `refresh_mnp_progreso_rematricula`:

| Hito | Señal en logs |
|------|----------------|
| ingreso | primer evento del periodo (cualquier log) |
| tyc | TyC `acepta` |
| datos | OTP `verificar_ok` o apoderado/discapacidad |
| forma_pago | categoria forma_pago / plan_pago |
| firma | firma + firmado |
| matriculado | matricula + matriculado |

Si falta un extremo del tramo, ese alumno no entra al **n** de ese tramo.

### RPC

- `kpi_reporte_tiempos_tramo_rematricula(anio, semestre, carrera?)`  
  → filas: `tramo`, `n`, `media_horas`, `mediana_horas`

## UI

Patrón visual de Pagos rematrícula (Card, chips, tabla, export, tokens UNIACC). Copy coherente (“Sin definir” donde aplique a estados).

## Fuera de alcance (MVP)

- Detalle de tiempos por alumno  
- p90 / total ingreso→matriculado  
- Validación live U+ `MT_POSBEN`  
- Cambios de alcance al reporte de pagos  

## Criterios de éxito

- Menú muestra las tres entradas; Pagos sigue igual.  
- Becas: alumno con Talento 100 % aparece en Baja/Mantiene/Pierde según promedio, sin confundir con tope 70 %.  
- Tiempos: al menos un tramo con n>0 en 2027-1 en mol-dev; cuello de botella visible.  
- Exports CSV/Excel en Becas.
