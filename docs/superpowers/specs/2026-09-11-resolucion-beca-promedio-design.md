# Resolución de beca interna por promedio (Art. 13)

Fecha: 2026-09-11  
Proyecto: `mol-docker`  
Estado: implementado en mock 2027-01 (sin escritura a U+)

## Decisión

MOL resuelve si una beca interna con medición de notas **se mantiene, se baja o se pierde**, según el Decreto de Rectoría N° 3/2026 Art. 13, usando el `%` y monto que el alumno ya tiene en el plan ERP.

- `≥ 5,5` → mantiene `%` y monto.
- `4,0–5,4` → baja: `final = base × (1 − disminución)`.
- `≤ 3,9` → pierde (`%` y monto = 0).
- Sin promedio usable → **bloquea** rematrícula (no paga ni firma).

No aplica a estatales, convenios, `SIN REQUISITO DE NOTAS` ni `BECA DVU` sin notas. Solo `MOL_DVU` cuyo `renovable` contiene promedio 5.5.

## Promedio usado

Flag `tp_periodo_activo.promedios_cerrados` (default `false`):

- Abierto → `prom_ultimo_periodo`, si no hay → `prom_anio`.
- Cerrado → `prom_anio`, si no hay → `prom_ultimo_periodo`.

El consolidado hoy trae columnas 2025. El motor no depende del año del nombre; UMAS debe mandar el promedio vigente.

## Persistencia

Tabla `mnp_resolucion_beca_promedio`. RPCs `guardar_resoluciones_beca_promedio` y `consultar_resoluciones_beca_promedio`. No se escribe U+ en este MVP.

## UI

Forma de pago: badge Mantiene / Baja / Pierde, tachado del monto original si baja o pierde, plan de pago con montos ajustados. Alerta y bloqueo si falta promedio. Mantenedor de periodo activo: marcar promedios abiertos/cerrados.
