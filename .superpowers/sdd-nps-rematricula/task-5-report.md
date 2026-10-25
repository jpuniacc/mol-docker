# Task 5 report — API admin NPS (uniacc-api-docker)

**Status:** DONE  
**Repo:** `/opt/uniacc-api-docker`  
**Branch:** `dev`  
**Date:** 2026-10-18

## Commit

| Hash | Message |
|------|---------|
| `3dfcb9d` | `feat(rematricula): API admin para listar respuestas NPS` |

Archivos incluidos:
- `src/services/nps-rematricula.service.ts` (nuevo)
- `src/services/nps-rematricula.service.test.ts` (nuevo)
- `src/controllers/rematricula-nps.controller.ts` (nuevo)
- `src/routes/rematricula-nps.routes.ts` (nuevo)
- `src/index.ts` (mount `/api/rematricula/nps`)

**No commitado:** `.env.docker.example` (WIP ajeno).

## Endpoint

`GET /api/rematricula/nps?anio=&semestre=&emailEjecutivo=`

- **400** si faltan `anio` o `semestre` (enteros).
- Respuestas desde `mnp_nps_rematricula` del periodo.
- `totalFinalizados`: count en `mnp_progreso_rematricula` con `excluido_mol = false`, `sin_match_mol = false`, `etapa_actual IN ('firma','matriculado')`.
- Filtro cartera: `emailEjecutivoDeQuery` + `rutsDeEjecutivo` + `rutEnCartera` (ajusta `filas` y `totalRespuestas`).
- `totalFinalizados` queda del periodo completo (no recortado por cartera), igual que el SQL del brief.

Shape:

```ts
{
  ok: true
  anio: number
  semestre: number
  totalRespuestas: number
  totalFinalizados: number
  filas: Array<{
    id: string
    creadoEn: string
    rut: string | null
    codcli: string
    codigoCarrera: string
    jornada: string
    calificacion: number
    comentario: string | null
  }>
}
```

Helper exportado: `filtrarComentariosBajos` (solo 1–3 con comentario no vacío).

## Tests

```bash
npm test -- src/services/nps-rematricula.service.test.ts
```

Resultado: **PASS** (`filtrarComentariosBajos` + suite completa del repo: 121 pass / 0 fail).

## Concerns

1. `totalFinalizados` no se filtra por cartera del ejecutivo; si el BO ejecutivo necesita tasa NPS solo de su cartera, habrá que cruzar progreso por RUT.
2. No se validó el endpoint contra Supabase en runtime (solo unit test del helper).
3. Lectura vía `querySupabase` (pool admin); RLS de anon/authenticated no aplica.
