# Casos de rematrícula: certificado de convenio + bandeja consejero

Fecha: 2026-09-10  
Proyecto: `mol-docker`  
Estado: v1 implementada (pendiente commit)

## Problema

Si el alumno tiene un convenio que exige certificado (Caja Los Andes, Caja La Araucana, Carabineros, Sindicato BancoEstado), el mock debe pedir el documento y **no dejar continuar** hasta que un consejero lo acepte. Hoy se puede subir y seguir de inmediato, y no hay bandeja para resolver. Además el consejero va a necesitar ver **estos casos y otros** (apoderado desactualizado, CAE en espera) en una sola vista.

## Decisiones

| Tema | Decisión |
|------|----------|
| Quién debe subir certificado | Cruce: código en el plan del alumno **y** `mnp_mv_beneficio_periodo` del periodo activo con `requiere_certificado = true` |
| Periodo | Mismo formato del catálogo: `YYYY-0S` (ej. `2027-01`) a partir de periodo activo |
| Tras subir | Caso `EN_REVISION` + standby; no pago, no firma, no resumen |
| Aprobación | Consejero en dashboard; no botón “simular” en el mock |
| Rechazo | Motivo obligatorio; alumno re-sube; sigue bloqueado |
| Modelo | Tabla genérica `mnp_caso_rematricula` (no solo convenios) |
| Ciclo completo en este MVP | `CONVENIO_CERTIFICADO` (subir, esperar, aprobar/rechazar, desbloquear) |
| Otros tipos ahora | Se **abren** casos `APODERADO_DATOS` y `CAE_RESOLUCION` cuando esos flujos ya ocurren; resolverlos en detalle queda fuera |
| Bypass | Router + stepper: no se puede saltar firma/resumen con caso de certificado en revisión |
| Fuente de documento | Reutilizar Storage + `mnp_convenio_documento`; el caso apunta a esa fila |

## Tipos de caso

| `tipo` | Se abre cuando | Resolución en este MVP |
|---|---|---|
| `CONVENIO_CERTIFICADO` | Alumno con match certificado sube (o debe subir) el PDF | Completa: ver archivo, aprobar / rechazar |
| `APODERADO_DATOS` | Alumno marca datos de apoderado como desactualizados | Solo listar (ya hay bloqueo + correo) |
| `CAE_RESOLUCION` | Verificación CAE queda `pendiente_resolucion` | Solo listar |

Estados: `ABIERTO` → `EN_REVISION` → `APROBADO` \| `RECHAZADO`.  
`CERRADO` reservado para tipos futuros que no sean aprueba/rechaza.

Unicidad de caso abierto: `(periodo, tipo, codcli, ref_id)` — recargar no duplica.

## Modelo de datos

`mnp_caso_rematricula`:

- `id` uuid PK
- `periodo` text (`2027-01`)
- `tipo` text (check de los tres valores)
- `estado` text (check)
- `rut_alumno`, `codcli`, `nombre_alumno`, `carrera`, `jornada`
- `titulo`, `detalle`
- `ref_tipo` text (`convenio_documento` \| `log_evento` \| `verificacion_cae`)
- `ref_id` uuid/text
- `payload` jsonb (ej. `codigo_beneficio`, `tipo_certificado`, `convenio_id`, `storage_path`)
- `resuelto_por` text null, `resuelto_en` timestamptz null, `motivo` text null
- `created_at`, `updated_at`

RPCs (`SECURITY DEFINER`, mismo estilo que `registrar_mnp_convenio_documento`):

1. `abrir_mnp_caso_rematricula(...)` — upsert si ya existe abierto/en revisión
2. `resolver_mnp_caso_rematricula(p_id, p_estado, p_motivo, p_resuelto_por)`
3. `listar_mnp_casos_rematricula(p_periodo, p_tipo, p_estado)` — lectura bandeja
4. `consultar_casos_alumno(p_codcli, p_periodo)` — el mock rehidrata standby

`mnp_convenio_documento` no se reemplaza. Se le agrega `estado_revision` (`PENDIENTE` \| `APROBADO` \| `RECHAZADO`) alineado al caso, o se deriva solo desde el caso (preferir **derivar del caso** para no tener dos verdades).

RLS: sin SELECT/UPDATE directo desde anon; solo RPCs. Consejero usa `listar` + `resolver`. Signed URL del PDF vía servicio existente / RPC de lectura de path.

## Flujo alumno (mock)

```text
Datos personales → Forma de pago
                      │
                 ¿CAE pendiente? ──► abre caso CAE_RESOLUCION (lista)
                      │
                 subpaso becas
                      │
        ¿plan ∩ requiere_certificado?
             no ──► sigue (si no hay caso EN_REVISION)
             sí ──► pide PDF (afiliación o antigüedad según catálogo)
                    │
                 sin archivo ──► BLOQUEO
                 sube ──► caso CONVENIO_CERTIFICADO EN_REVISION
                          + pantalla “En revisión por tu consejero”
                          + BLOQUEO (no pago / firma / resumen)
                    │
            consejero aprueba ──► desbloquea; sigue a pago
            consejero rechaza ──► motivo visible; re-sube; sigue bloqueado
```

Apoderado “datos mal” (ya implementado): además del correo/log, **abre** `APODERADO_DATOS`.

Gate de certificado **solo** con el catálogo 2027-01 (`requiere_certificado`). Deja de usarse “todo `tp_mnp_convenio` VIGENTE pide documento” para este bloqueo.

## UI mock

- Mismo bloque visual que CAE en espera / OTP.
- Texto de certificado según `tipo_certificado` (`AFILIACION` / `ANTIGUEDAD_LABORAL`).
- Tras subir: no check “listo para continuar”; estado “Enviado, en revisión”.
- Si hay caso `EN_REVISION` al reentrar (rehidratación por RPC): ir directo a standby.

## UI consejero (dashboard)

Nueva ruta, mismo guard que mantenedor convenios (admin admisión / DVU / perfiles 1-2-3):

- `/dashboard/casos-rematricula`
- Item de menú Rematrícula: “Casos rematrícula”
- Filtros: periodo (default activo), tipo, estado
- Tabla: RUT, nombre, carrera, jornada, tipo, estado, título, fecha
- Detalle `CONVENIO_CERTIFICADO`: ver/descargar archivo, aprobar, rechazar con motivo
- Detalle otros tipos: ficha de solo lectura (este MVP)

## Fuera de alcance (este MVP)

- Resolver en bandeja apoderado o CAE (desbloquear esos flujos desde la vista)
- Notificación email al consejero por cada caso nuevo
- Asignar caso a un consejero individual
- Tipos extra (deuda, discapacidad, etc.)
- Cambiar el stepper principal (sigue siendo Datos / Forma de pago / Firma / Resumen)
- Editar datos del apoderado o del convenio en MOL

## Criterios de éxito

1. Alumno sin código de certificado en plan ∩ catálogo: no se le pide PDF por convenio.
2. Alumno con 89 / 749 / 1552 / 1565 en el plan 2027-01: no avanza a pago/firma sin documento **aprobado**.
3. Tras subir: caso `EN_REVISION` visible en bandeja; mock en standby; recargar no pierde el bloqueo.
4. Aprobar desbloquea el mock; rechazar exige motivo y obliga a re-subir.
5. Marcar apoderado desactualizado o CAE pendiente **crea** fila en la bandeja (aunque no se resuelva ahí todavía).
6. No se duplican casos abiertos al recargar. Tras rechazo, la re-subida **actualiza** el mismo caso (`ref_id` / payload del nuevo archivo) y vuelve a `EN_REVISION`.
