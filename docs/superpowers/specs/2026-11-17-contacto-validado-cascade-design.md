# Contacto validado: cascade OTP → continuar_sin_otp / borrador

**Fecha:** 2026-11-17  
**Estado:** aprobado (diseño v1)  
**Proyecto:** uniacc-api-docker (consumo desde MOL Casos / avisos)  
**Rollout:** mol-dev → uniacc-mol tras merge `dev`/`qa`/`main` + rebuild API  

## Problema

En Datos personales el alumno ve badge **Validado** si el borrador tiene `contactoCorreoValidado` / `contactoTelefonoValidado`. Eso también se setea con **continuar sin OTP** tras fallos de envío/verificación.

Varios flujos de API exigían solo OTP con `evento = 'verificar_ok'` (p. ej. Confirmar apoderado desde ERP y avisos que necesitan correo del alumno). Resultado: UI “Validado” y backoffice bloqueado (caso Alexa Salinas `19907275-7`).

## Decisiones

| Tema | Decisión |
|------|----------|
| Alcance | Todos los consumidores del criterio estricto de correo/teléfono validado (no solo apoderado) |
| Fuente | Cascade **C**: (1) `verificar_ok` OTP → (2) `continuar_sin_otp` o borrador periodo |
| Enfoque | Resolver compartido en TypeScript (no ampliar solo el SQL monolítico; no fabricar `verificar_ok` falso) |
| Front MOL | Sin cambio de UI |
| Migración SQL | Ninguna |
| Periodo borrador | Periodo activo de rematrícula (`anio`/`semestre` del caso o fetchPeriodoActivo) |

## Comportamiento

Para **correo** y **teléfono**, por separado:

1. Si existe evidencia OTP `verificar_ok` (mismo join log + tabla OTP consumida que hoy) → devolver ese valor normalizado.  
2. Si no, en este orden:  
   - `contactoCorreoValidado` / `contactoTelefonoValidado` en `mol_borrador_rematricula` del periodo (mismo criterio que el badge del alumno);  
   - si el borrador no trae valor, último log `continuar_sin_otp` del canal (`correo` / `telefono` o `sms` según tabla) con destino usable.  
3. Si nada → `null` (mismos errores/omisiones que hoy: `SIN_CORREO_VALIDADO`, aviso `omitido` por sin correo, etc.).

Prioridad explícita: `verificar_ok` **gana** sobre borrador y sobre `continuar_sin_otp`, aunque el borrador difiera.

## Componentes

Nuevo módulo en uniacc-api, p. ej. `src/services/contacto-validado-alumno.ts`:

- `resolverCorreoValidadoAlumno(rut, codcli)`  
- `resolverTelefonoValidadoAlumno(rut, codcli)`  

Call sites a cablear:

- `apoderado-refresh-from-erp.service` → dep `correoValidado`  
- `rematricula-aviso-outbox.service` → reemplazo de uso directo de `CORREO_VALIDADO_ALUMNO_SQL` al resolver alumno  
- `seguimiento-caso-enrichment` → unificar `cargarCorreoOtp` / `cargarTelefonoOtp` / `resolverContactoAlumno` con el mismo cascade (hoy enrichment prioriza borrador antes que OTP; debe alinearse a **OTP primero**)

`CORREO_VALIDADO_ALUMNO_SQL` permanece como implementación del paso 1 de correo (o se reutiliza desde el resolver). Análogo SMS para teléfono.

## Tests

Unitarios del resolver:

- `verificar_ok` gana sobre borrador / `continuar_sin_otp`  
- Sin OTP ok, con borrador o `continuar_sin_otp` → valor  
- Sin fuentes → `null`  

Integración liviana / tests de servicio:

- Apoderado preview: `puedeConfirmar === true` con solo borrador (Alexa)  
- Aviso outbox: no omite por “sin correo validado” si el fallback entrega email  

## Errores

Fallo de consulta en un eslabón del cascade: intentar el siguiente. Si todos fallan o no hay valor → `null` / códigos existentes.

## Fuera de alcance

- Cambiar copy o flujo “continuar sin OTP” en el front  
- Backfill masivo de logs  
- Relajar otras validaciones (RUT apoderado, ERP, etc.)  

## Verificación manual post-deploy

1. Caso `19907275-7` / `20251TRSO1AR032`: preview apoderado con `puedeConfirmar` true sin rehacer OTP.  
2. Confirmar actualización apoderado OK.  
3. Un alumno solo con `verificar_ok` real sigue resolviendo el email OTP.
