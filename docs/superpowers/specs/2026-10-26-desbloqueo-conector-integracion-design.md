# Desbloqueo de toma de ramos hacia ConectorIntegracion

## Objetivo

Cada alumno que pasa por el mantenedor de desbloqueo de toma de ramos de MOL debe quedar también en `ConectorIntegracion.dbo.MOL_ALUMNOS_DESBL`, en U+ PROD. Hoy el mantenedor solo guarda en Supabase (`public.mnp_desbloqueo_toma_ramos`) y nada llega a U+.

## Tabla destino

`ConectorIntegracion.dbo.MOL_ALUMNOS_DESBL`, servidor PUACSCLSQLU (U+ PROD). Ya existe y está vacía.

| Columna | Tipo | Valor que escribe MOL |
|---|---|---|
| `RUT` | `VARCHAR(12)` | Cuerpo, guion y DV, sin puntos: `18056961-8` |
| `ANO` | `INT` | `anio_periodo` de `tp_periodo_activo` con `estado = true` |
| `PERIODO` | `INT` (1 o 2) | `semestre_periodo` del mismo período activo |
| `FECHA` | `DATETIME` | `GETDATE()` en cada upsert |
| `USUARIO` | `VARCHAR(100)` | `actualizadoPor` del mantenedor, recortado a 100. Si viene vacío, `MOL` |
| `DESBLOQUEADO` | `CHAR(1)` | `S` si el RUT tiene al menos un CODCLI con `desbloqueado = true` en Supabase después del cambio; si no, `N` |

La clave es `(RUT, ANO, PERIODO)`. Supabase guarda una fila por RUT y CODCLI, así que varias carreras del mismo RUT se resumen en una sola fila de U+.

## Ambiente

Siempre se escribe en `ConectorIntegracion` de U+ PROD, también desde mol-dev, aunque el ambiente activo de los SP sea Test. No se usa `QAConectorIntegracion`.

Consecuencia aceptada: lo que se cargue en el mantenedor de mol-dev, incluidas las pruebas, queda en la tabla de producción.

## Conexión

Se reutiliza el pool `getConnectionErpSp('prod')` (`DB_SERVER` / `DB_USER`, login `nimbi`). `nimbi` tiene `db_datareader`, `db_datawriter` y `db_ddladmin` en `ConectorIntegracion`. La consulta usa el nombre de tres partes `ConectorIntegracion.dbo.MOL_ALUMNOS_DESBL`. No se agregan credenciales.

## Cuándo se escribe

Después de que el cambio en Supabase termina bien, en las cuatro acciones del mantenedor:

| Acción | Endpoint | Efecto en U+ |
|---|---|---|
| Cargar Excel | `POST /desbloqueo-toma-ramos/importar` | Un upsert por RUT distinto entre las filas válidas |
| Desbloquear | `POST /desbloqueo-toma-ramos/desbloquear` | Upsert del RUT |
| Volver a bloquear | `POST /desbloqueo-toma-ramos/bloquear` | Upsert del RUT |
| Quitar | `DELETE /desbloqueo-toma-ramos/:id` | Upsert del RUT de la fila borrada |

En los cuatro casos `DESBLOQUEADO` se calcula leyendo Supabase después del cambio. Nunca se borran filas de `MOL_ALUMNOS_DESBL`.

## Upsert

```sql
MERGE ConectorIntegracion.dbo.MOL_ALUMNOS_DESBL WITH (HOLDLOCK) AS t
USING (SELECT @rut AS RUT, @ano AS ANO, @periodo AS PERIODO) AS s
   ON t.RUT = s.RUT AND t.ANO = s.ANO AND t.PERIODO = s.PERIODO
WHEN MATCHED THEN
  UPDATE SET FECHA = GETDATE(), USUARIO = @usuario, DESBLOQUEADO = @desbloqueado
WHEN NOT MATCHED THEN
  INSERT (RUT, ANO, PERIODO, FECHA, USUARIO, DESBLOQUEADO)
  VALUES (@rut, @ano, @periodo, GETDATE(), @usuario, @desbloqueado);
```

Todos los valores van como parámetros de `mssql`.

## Errores

Supabase es la fuente del mantenedor. Si U+ falla, el cambio en Supabase se mantiene y no se revierte.

- La respuesta de las cuatro acciones agrega `avisosU: string[]`. Ejemplo: `18056961-8 quedó en MOL, pero no llegó a U+.`
- Sin período activo: no se escribe en U+ y se agrega el aviso `No hay período activo; no se envió a U+.`
- El error técnico va al log de la API con el prefijo `[desbloqueo-conector]`, sin credenciales.
- El campo `ok` de la respuesta no cambia por un fallo de U+.

## Front (mol-docker)

`desbloqueoTomaRamosApi.ts` lee `avisosU` en las cuatro llamadas. `MantenedorDesbloqueoTomaRamosView.vue` muestra un `toast.warning` con la cantidad y el primer aviso, igual que hoy con las filas que no entran en la carga.

## Alumnos ya cargados

Un script de una sola vez en la API (`scripts/backfill-desbloqueo-conector.ts`) recorre los RUT distintos de `mnp_desbloqueo_toma_ramos` y hace el mismo upsert con `USUARIO = MOL`. Se corre dentro del contenedor `uniacc-api` de mol-dev, que hoy tiene 113 RUT, todos desbloqueados. Producción tiene 0 filas, así que no hace falta correrlo allá.

## Unidades

- `src/services/desbloqueo-conector-integracion.ts`
  - `filaConector(input)`: arma `{ rut, ano, periodo, usuario, desbloqueado }` desde el cuerpo, el DV, el período, el actor y el estado. Es pura.
  - `sincronizarRutConector(rutCuerpo, dv, actor, deps)`: lee el período activo y el estado del RUT en Supabase, arma la fila y ejecuta el `MERGE`. Devuelve `null` si salió bien o el texto del aviso. Las dependencias (período, estado, ejecutar `MERGE`) se inyectan.
- `desbloqueo-toma-ramos.service.ts`: después de cada cambio llama a `sincronizarRutConector` y devuelve los avisos.
- `desbloqueo-toma-ramos.controller.ts`: agrega `avisosU` a la respuesta.

## Pruebas

`node:test`, como `desbloqueo-toma-ramos.test.ts`:

- `filaConector` arma `18056961-8`, deja `MOL` si el actor viene vacío y recorta el actor a 100 caracteres.
- `S` cuando queda al menos un CODCLI desbloqueado y `N` cuando no queda ninguno.
- Si el `MERGE` falla, devuelve el aviso y no lanza error.
- Sin período activo, devuelve el aviso y no llama al `MERGE`.

## Fuera de alcance

- No se usa `QAConectorIntegracion`.
- No se borra en U+.
- No hay reintento automático ni cola.
- No se cambian procedimientos de U+.
