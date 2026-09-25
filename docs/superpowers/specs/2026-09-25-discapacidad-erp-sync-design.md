# Encuesta discapacidad: sync ERP (`SP_MOL_ACTUALIZA_DISCAPACIDAD`) + afirmaciones en Supabase

Fecha: 2026-09-25  
Proyecto: `mol-docker` + `uniacc-api-docker`  
Estado: aprobado (diseño)

## Problema

En Datos personales, el alumno puede contestar la encuesta de discapacidad (tipo SENADIS + afirmaciones funcionales). Hoy la respuesta ya se persiste en Supabase (`mnp_discapacidad_encuesta` vía `guardar_mnp_discapacidad_encuesta`), pero **no se escribe** el tipo en ERP (`MT_CLIENT.DISCAPACIDAD`).

Existe el SP:

```sql
EXEC SP_MOL_ACTUALIZA_DISCAPACIDAD
    @CODCLI = '12345678-9',
    @DISCAPACIDAD = 'Visual'
```

`@DISCAPACIDAD` debe ser un `CODIGO` de `MT_DISCAPACIDAD`. Los códigos actuales en U+ Test:

| CODIGO | DESCRIPCION |
| --- | --- |
| Auditiva | Auditiva |
| Espectro del Autismo | Espectro del Autismo |
| Física-Motora | Física-Motora |
| Física–Visceral | Física–Visceral |
| Intelectual | Intelectual |
| Ninguna | Ninguna |
| Psíquica | Psíquica |
| Visual | Visual |

La UI actual (`Física`, `Autismo`, …) **no** cuadra 1:1 con esos códigos (`Física` y `Autismo` harían fallar el SP).

Las afirmaciones (silla de ruedas, lengua de señas, persona ciega, ninguna) **no existen** en U+.

## Decisiones

| Tema | Decisión |
|------|----------|
| Enfoque | **A** — Endpoint dedicado en uniacc-api + orquestación en MOL (mismo patrón que `SP_ACTUALIZA_DATOS_MOL` / OTP) |
| Pregunta 1 (tipo) | Opciones UI = códigos de `MT_DISCAPACIDAD` **excepto** `Ninguna` (esa no se ofrece como opción de “contesta”) |
| Mapeo | 1:1 label → `@DISCAPACIDAD` (sin traducción). Incluye Física-Motora, Física–Visceral, Intelectual, Espectro del Autismo |
| Pregunta 2 (afirmaciones) | Solo Supabase (`afirmaciones` jsonb). Sin SP / sin columna ERP |
| Al omitir (`contesta=false`) | Guardar en Supabase como hoy. **No** llamar al SP. Dejar intacto el valor ERP existente |
| Al contestar | Guardar en Supabase + llamar SP con el tipo elegido |
| Fallo del SP | Alumno **avanza igual**; error en log API + auditoría MOL |
| Ambiente ERP | `resolveAmbienteActivo()` (`tp_mnp_erp_sp_ambiente`) |
| CODCLI | Con DV, p. ej. `21310817-4` (como el ejemplo del SP / patrón contacto OTP) |
| Sync TEST | Si ambiente = `test`, mismo criterio de espejo mínimo que contacto OTP **solo si** hace falta para que el `UPDATE` del SP no falle por fila ausente; no inventar discapacidad desde PROD al omitir |

## Fuera de alcance

- Cambiar TyC / texto SENADIS más allá de alinear labels a `MT_DISCAPACIDAD`.
- Escribir afirmaciones en ERP.
- Bloquear matrícula por fallo del SP.
- Mantenedor de catálogo de discapacidad (se lee de U+ o se fija el enum en código alineado a la tabla actual).
- Push / deploy automático.

## Flujo

```text
Encuesta discapacidad
  │
  ¿Desea contestar?
  ├─ No (omitir)
  │     → RPC guardar_mnp_discapacidad_encuesta (contesta=false)
  │     → NO llama SP
  │     → MT_CLIENT.DISCAPACIDAD sin cambio
  │     → continúa flujo
  │
  └─ Sí
        → tipo obligatorio (códigos MT_DISCAPACIDAD sin Ninguna)
        → afirmaciones opcionales
        → RPC Supabase (tipo + afirmaciones)
        → POST uniacc-api …/discapacidad/actualizar-erp
              ambiente = resolveAmbienteActivo()
              EXEC SP_MOL_ACTUALIZA_DISCAPACIDAD @CODCLI, @DISCAPACIDAD
              OK / ERROR → log; alumno no se bloquea
        → continúa flujo
```

## API (uniacc-api)

### `POST /api/rematricula/discapacidad/actualizar-erp`

**Body**

```json
{
  "codcli": "21310817-4",
  "discapacidad": "Visual"
}
```

- `discapacidad`: debe existir en `MT_DISCAPACIDAD.CODIGO` (validación en API y en el SP).
- No se acepta omitir vía este endpoint (omitir = no llamar).

**Respuesta:** mismo estilo que contacto OTP (`ok`, `message`, `data`, logs).

## MOL (front)

1. Actualizar `DISCAPACIDAD_TIPOS` (y CHECK de `mnp_discapacidad_encuesta` / RPC) a los códigos U+ sin `Ninguna`.
2. Tras guardar encuesta con `contesta=true`, invocar el endpoint ERP (fire-and-forget respecto al avance del alumno).
3. Si `contesta=false`, solo RPC Supabase; no hay POST ERP.

## Datos Supabase

- Tabla y RPC existentes se mantienen.
- Migración: ampliar / reemplazar el CHECK de `tipo_discapacidad` para los nuevos literales (Física-Motora, Física–Visceral, Intelectual, Espectro del Autismo, etc.).
- Afirmaciones: sin cambio de modelo.

## Criterios de éxito

1. Contestar con `Visual` → fila Supabase con tipo `Visual` + `MT_CLIENT.DISCAPACIDAD = Visual` en el ambiente ERP activo.
2. Omitir → fila Supabase `contesta=false` y valor ERP previo **sin cambio**.
3. Afirmaciones solo en Supabase.
4. SP con código inválido o alumno inexistente → error logueado; UI sigue.
5. Labels UI = códigos de `MT_DISCAPACIDAD` (salvo `Ninguna`).

## Referencias

- UI: `src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue`, `src/constants/discapacidadEncuesta.ts`
- Supabase: `supabase/migrations/20260707180000_mnp_discapacidad_encuesta.sql`
- Patrón ERP: `docs/superpowers/specs/2026-09-22-actualiza-datos-mol-otp-design.md`
- SP: `SP_MOL_ACTUALIZA_DISCAPACIDAD` (U+); catálogo `MT_DISCAPACIDAD`
