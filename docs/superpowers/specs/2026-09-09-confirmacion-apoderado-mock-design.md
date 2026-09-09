# Confirmación de apoderado / sostenedor en mock rematrícula

Fecha: 2026-09-09  
Proyecto: `mol-docker` (+ `uniacc-api-docker` para el correo)  
Estado: aprobado en brainstorming; pendiente plan de implementación

## Problema

Tras verificar email y teléfono del alumno, el mock no distingue si el alumno es su propio sostenedor o tiene apoderado. Cuando hay apoderado, el alumno debe confirmar que los datos del apoderado siguen vigentes. Si no, no puede continuar y el área debe enterarse por correo.

## Decisiones

| Tema | Decisión |
|------|----------|
| Ubicación | Subpaso en Datos personales, entre OTP contacto y discapacidad |
| Criterio propio sostenedor | `es_responsable_financiero === 'S'` → omitir confirmación |
| Criterio con apoderado | Cualquier otro valor (`N`, vacío, sin datos) → mostrar confirmación |
| Qué confirma el alumno | Que nombre, teléfono y email del apoderado **siguen correctos** |
| Si dice que no | **Bloqueo** del flujo (no discapacidad / forma de pago / etc.) |
| Aviso al área | Correo **real** a buzón fijo configurado + log de auditoría |
| Destinatario | Buzón fijo (env o config); no hardcodeado en el front |

## Flujo

```text
TyC → OTP email/tel alumno → [¿apoderado?] → discapacidad → forma de pago…
                                    │
                    es_responsable = S ──► salta confirmación
                    es_responsable ≠ S ──► muestra ficha apoderado
                         │
                    Sí, datos OK ──► discapacidad
                    No, datos mal ──► BLOQUEO + aviso consejero + correo al área
```

## UI (mock)

- Pantalla de solo lectura dentro de Datos personales (mismo patrón visual que OTP / discapacidad).
- Título orientativo: “Confirma los datos de tu apoderado / sostenedor”.
- Campos mostrados:
  - Nombre completo (`nombre_apoderado` + apellidos)
  - Teléfono (`telefono_apoder` con fallback a `telefono_apoderado`)
  - Email (`mail_apoder`)
  - Si falta un dato: “Sin información”
- Acciones:
  - **Sí, estos datos son correctos** → marca confirmación y avanza a discapacidad
  - **No, necesito actualizarlos** → bloquea; mensaje al alumno; dispara correo + log
- Mensaje de bloqueo (orientativo): el alumno debe comunicarse con su consejero; además se informa al área para la actualización.

## Estado en sesión (mock)

En el contexto del mock (p. ej. `mockMatriculaContext` o store dedicado):

- `apoderadoConfirmado: true | false | null`
- `apoderadoBloqueo: boolean` — si `true`, no se permite avanzar a pasos posteriores ni “saltar” el subpaso por navegación

## Correo al área (uniacc-api)

Al marcar datos incorrectos:

1. MOL llama endpoint nuevo en `uniacc-api` (mismo estilo que `/api/rematricula/contacto-otp/...`).
2. API envía correo vía `email.service` al buzón fijo configurado.
3. Cuerpo mínimo:
   - RUT, codcli, nombre alumno
   - Periodo de rematrícula
   - Carrera
   - Modalidad / jornada (`jornada_carrera`)
   - Datos del apoderado mostrados (nombre, teléfono, email)
   - Indicación de que el alumno marcó los datos como desactualizados
4. Se registra evento en log MOL (`log_mol_*` o equivalente existente) para auditoría.
5. Si el envío falla: el alumno **sigue bloqueado**; se registra el error; no se desbloquea el flujo.

Configuración del destinatario: variable de entorno o tabla/config (no en el front).

## Datos fuente

Desde `PlanPagosMvRow` / `v_mnp_mv_plan_pagos` (ya cargados en el mock):

- `es_responsable_financiero`
- `rut_apoder`, `nombre_apoderado`, `apellido_paterno_apoderado`, `apellido_materno_apoderado`
- `telefono_apoder`, `telefono_apoderado`, `mail_apoder`
- `carrera` / `nombre_carrera`, `jornada_carrera`
- `codcli`, `rut`, nombre alumno, periodo

## Fuera de alcance (este MVP)

- Editar datos del apoderado en el mock
- Asignar correo al consejero individual del alumno
- Ticket en sistema externo distinto del correo
- Cambiar el stepper principal (sigue siendo el mismo paso “Datos personales”)

## Criterios de éxito

1. Alumno propio sostenedor (`S`): tras OTP → discapacidad, sin pantalla de apoderado.
2. Alumno con apoderado: ve ficha; “Sí” → discapacidad; “No” → bloqueo + correo + log.
3. Correo incluye carrera y jornada además de identificación y datos del apoderado.
4. No se puede continuar el mock mientras `apoderadoBloqueo` esté activo.
