# KPI Forma de pago: marca espera CAE / Beca Ministerial

Fecha: 2026-10-20  
Proyecto: `mol-docker`  
Estado: diseño aprobado (pendiente plan de implementación)

## Problema

En el embudo del KPI Rematrícula, los alumnos que llegan a **Forma de pago** y quedan bloqueados por procedimiento (CAE y/o Beca Ministerial sin resolución) se cuentan igual que quienes sí pueden avanzar. Operaciones necesita ver el desglose en el embudo y reconocerlos en el listado de esa etapa.

## Decisiones

| Tema | Decisión |
|------|----------|
| Alcance UI | Desglose bajo `forma_pago` en el embudo **y** badges + filtro en el listado de esa etapa |
| Criterio de marcado | Solo bloqueo activo (no flag de cartera/perfil) |
| Total `forma_pago` | Se mantiene; debajo van 4 subconteos que suman ese total |
| Enfoque técnico | Flags denormalizados en `mnp_progreso_rematricula`, calculados en el refresh |
| Etapa nueva | No; no se saca a nadie del conteo de `forma_pago` |

## Datos

### Columnas nuevas en `mnp_progreso_rematricula`

| Campo | Tipo | Default | Significado |
|-------|------|---------|-------------|
| `espera_cae` | `boolean` | `false` | Bloqueo activo por CAE |
| `espera_ministerial` | `boolean` | `false` | Bloqueo activo por Beca Ministerial |

### Fuente (prioridad)

Para cada fila (`codcli` + `anio_periodo` + `semestre_periodo`):

1. **Caso abierto** en `mnp_caso_rematricula` (mismo `codcli` y periodo):
   - `tipo = 'CAE_RESOLUCION'` y `estado IN ('ABIERTO', 'EN_REVISION')` → `espera_cae = true`
   - `tipo = 'ESTATAL_MINEDUC'` y `estado IN ('ABIERTO', 'EN_REVISION')` → `espera_ministerial = true`
2. **Fallback CAE:** si no hay caso CAE abierto pero existe verificación CAE con resultado `pendiente_resolucion` para esa llave → `espera_cae = true`.

Los estados abiertos coinciden con la bandeja de Casos Rematrícula.

### Cuándo se calculan

En `refresh_mnp_progreso_rematricula` (botón «Actualizar progreso» / cron). No hay escritura en vivo en cada click del portal.

Los flags pueden quedar `true` en otras etapas si el caso sigue abierto; el **desglose del embudo** solo se muestra y se agrega para `etapa_actual = 'forma_pago'`.

Filas antiguas o flags nulos en lectura se tratan como `false`.

## KPI (embudo)

Bajo la fila **Forma de pago**, sin alterar su número total, cuatro líneas (solo universo del embudo: `excluido_mol = false` y `sin_match_mol = false`, y `etapa_actual = 'forma_pago'`):

| Línea | Criterio |
|-------|----------|
| En espera CAE | `espera_cae` y no `espera_ministerial` |
| En espera Ministerial | `espera_ministerial` y no `espera_cae` |
| En espera ambos | ambos `true` |
| Resto (pueden avanzar) | ambos `false` |

La suma de las cuatro = conteo de `forma_pago`.

`kpi_mnp_progreso_rematricula` expone estos enteros:

- `forma_pago_espera_cae`
- `forma_pago_espera_ministerial`
- `forma_pago_espera_ambos`
- `forma_pago_resto`

UI: tipografía más chica / indentada bajo Forma de pago. Clic en una línea abre el detalle de Forma de pago con el filtro correspondiente ya aplicado.

## Listado (detalle Forma de pago)

**Badges** (pueden coexistir):

- `CAE` si `espera_cae`
- `Ministerial` si `espera_ministerial`

**Filtro rápido** (además de la búsqueda actual):

- Todos
- En espera CAE (incluye “ambos”)
- En espera Ministerial (incluye “ambos”)
- Solo ambos
- Resto (pueden avanzar)

Si se llega desde el desglose del embudo, el filtro queda preseleccionado.

**Permanencia >24 h:** sin cambio (fila roja / etiqueta de horas). Los badges de espera van aparte.

`listar_mnp_progreso_rematricula` ya devuelve la fila completa; con las columnas nuevas en la tabla, el front las recibe sin cambiar la firma del RPC. En v1 el filtro de espera se aplica en cliente sobre la lista de la etapa.

## Errores

| Situación | Comportamiento |
|-----------|----------------|
| Flag ausente / null | Tratar como `false` |
| Refresh o KPI fallan | Toast actual; se mantienen números anteriores |
| Sin periodo activo | Sin cambio (pantalla bloqueada como hoy) |

## Pruebas mínimas

- Caso `CAE_RESOLUCION` abierto + etapa `forma_pago` → `espera_cae`; entra al subconteo CAE.
- Caso `ESTATAL_MINEDUC` abierto → `espera_ministerial`.
- Ambos abiertos → “ambos”.
- Caso cerrado / aprobado → flags `false` tras refresh.
- Suma de los 4 subconteos = `forma_pago`.
- Filtro del listado y clic desde el desglose coinciden.
- Fallback verificación `pendiente_resolucion` sin caso → `espera_cae`.

## Fuera de alcance

- Resolver casos desde el KPI
- Etapa nueva del embudo
- Marcar por flag de cartera (`alumno_cae` / consolidado) sin bloqueo activo
- Alertas, export, asignación de ejecutivo
- Filtros extra en Seguimiento alumnos (v1: badges opcionales si la fila ya los trae; sin UI de filtro nueva ahí)

## Criterio de éxito

Un usuario de Rematrícula ve, bajo Forma de pago, cuántos están en espera CAE, Ministerial, ambos o pueden avanzar; al abrir la etapa, identifica y filtra esos alumnos sin salir del KPI.

## Dependencias

- Spec base: `2026-09-15-rematricula-kpi-seguimiento-design.md`
- Permanencia: `2026-10-15-kpi-embudo-permanencia-design.md`
- Casos: `mnp_caso_rematricula` (`CAE_RESOLUCION`, `ESTATAL_MINEDUC`)
- Bifurcaciones beneficio: `2026-09-10-bifurcaciones-beneficio-design.md`
- Verificación CAE: resultado `pendiente_resolucion`
