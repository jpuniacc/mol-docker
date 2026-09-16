# Gate de matrícula por certificado de convenio vigente

Fecha: 2026-09-16  
Proyecto: `mol-docker`  
Estado: aprobado en brainstorming  
Relacionado: `docs/superpowers/specs/2026-09-10-casos-rematricula-design.md`

## Problema

Cuando el alumno tiene un convenio **vigente** que exige documento (p. ej. Caja Los Andes), el portal ya muestra el bloque de carga y abre un caso `CONVENIO_CERTIFICADO` al subir el PDF. Hoy **Pagar matrícula** se habilita apenas hay archivo en el store (`conveniosDocumentos`), sin esperar la resolución del consejero. Además el botón **Siguiente — forma de pago** duplica el avance y confunde.

## Decisiones

| Tema | Decisión |
|------|----------|
| Desbloqueo de matrícula | Solo con caso(s) `CONVENIO_CERTIFICADO` en **`APROBADO`** |
| Varios vigentes | Todos los que exigen certificado deben estar `APROBADO` |
| Sin PDF / `EN_REVISION` / `RECHAZADO` | **Pagar matrícula** deshabilitado |
| Botón **Siguiente — forma de pago** | **Eliminar** de esta pantalla; el avance queda vía **Pagar matrícula** |
| Fuente de verdad | Casos vía `consultar_casos_alumno` (no solo presencia de archivo local) |
| Aprobación | Bandeja existente (`CasosRematriculaView`); sin auto-aprobar en mock |
| Re-subida tras rechazo | Permite nuevo PDF → caso vuelve a `EN_REVISION` (flujo RPC actual) |

## Regla de gate

Para cada convenio **vigente** que exige certificado:

| Situación | Pagar matrícula |
|-----------|-----------------|
| Sin documento | Deshabilitado |
| Documento + caso `EN_REVISION` | Deshabilitado |
| Caso `RECHAZADO` | Deshabilitado (puede re-subir) |
| Caso `APROBADO` | Habilitado **si todos** los exigidos están `APROBADO` |

Se combina con el gate de deuda ya existente (`tieneDeuda` / `puedeAbrirPagoMatricula`).

Sin convenio vigente que exija certificado: el pago solo depende de deuda (comportamiento actual).

## UI (FormaPagoMockView + ConvenioVigenteUpload)

1. Quitar **Siguiente — forma de pago** y textos asociados a “continuar a la forma de pago” por ese botón.
2. **Pagar matrícula**: `disabled` según la regla de gate + deuda.
3. Copy bajo el botón / en el bloque convenio:
   - Sin PDF → “Sube el documento del convenio vigente para poder pagar.”
   - `EN_REVISION` → “Documento en revisión por tu consejero. Podrás pagar cuando lo aprueben.”
   - `RECHAZADO` → motivo del caso + “Vuelve a subir el documento.”
4. Badge en la card del convenio: **En revisión** / **Rechazado** / **Aprobado** (dejar de tratar “Documento cargado” como listo para pagar).
5. Rehidratación al montar/entrar: `consultar_casos_alumno`; mapear casos a cada convenio (`payload.convenio_id`, `ref_id` o código beneficio) y reflejar documento + bloqueo sin depender solo de la sesión.

## Flujo

```text
Convenio vigente detectado
        │
   ¿tiene PDF?
    no ──► Pagar OFF
    sí ──► caso CONVENIO_CERTIFICADO
              │
         EN_REVISION / RECHAZADO ──► Pagar OFF (+ mensaje)
         APROBADO (todos) ───────► Pagar ON (si no hay deuda)
```

Subida de PDF sigue abriendo/rehidratando el caso y encolando aviso al consejero (ya implementado).

## Match convenio ↔ caso

Prioridad de cruce:

1. `payload.convenio_id` === id del convenio en UI  
2. `ref_id` del documento / storage path asociado  
3. `payload.codigo_beneficio` vs código del match  

Si no hay match claro para un vigente exigido, se trata como **bloqueado** (fail closed).

## Fuera de alcance

- Cambios en la bandeja de resolución del consejero (ya existe aprobar/rechazar).
- Auto-aprobación en mock.
- Nuevo modelo de tablas o `estado_revision` paralelo en `mnp_convenio_documento` (se deriva del caso).
- Gates adicionales de router hacia firma/resumen más allá de quitar **Siguiente** y el gate de pago.

## Pruebas de aceptación

- [ ] Vigente sin PDF → **Pagar matrícula** off + mensaje de subir.
- [ ] Sube PDF → caso `EN_REVISION` → pago off + badge En revisión.
- [ ] Consejero aprueba → al refrescar/reentrar, pago on (sin deuda).
- [ ] Consejero rechaza → pago off + motivo + permite re-subir.
- [ ] Dos vigentes que exigen certificado → ambos `APROBADO` para desbloquear.
- [ ] Sin convenio vigente exigido → pago solo sujeto a deuda.
- [ ] No existe el botón **Siguiente — forma de pago** en esta vista.
