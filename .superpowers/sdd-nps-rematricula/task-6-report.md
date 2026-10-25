# Task 6 report — Vista admin MOL + menú NPS rematrícula

**Status:** DONE  
**Repo:** `/opt/mol-docker`  
**Branch:** `dev`  
**Date:** 2026-10-18

## Commit

| Hash | Message |
|------|---------|
| `6d0e255` | `feat(nps): vista admin MOL y menú NPS rematrícula` |

Archivos incluidos:
- `src/services/npsRematriculaAdminApi.ts` (nuevo)
- `src/views/dashboard/rematricula/NpsRematriculaView.vue` (nuevo)
- `src/router/index.ts` (ruta `dashboard-nps-rematricula`)
- `src/constants/dashboardRouteNames.ts` (nombre de menú)
- `src/views/dashboard/layout/menuIcons.ts` (`Star` en el mapa)

**No commitado:** WIP ajeno (docs, `.superpowers/*`, scripts, etc.).

## Implementación

### Cliente admin
`GET ${admisionApiBaseUrl()}/api/rematricula/nps?anio=&semestre=` vía `urlConCarteraEjecutivo` (mismo patrón que `encuestaDiscapacidadApi.ts`). Timeout 60s. Tipado camelCase alineado al API Task 5.

### Vista
- Periodo activo (`usePeriodoActivoStore`): label + `ensureLoaded` antes del fetch.
- Cards: promedio (1 decimal o «—»), total respuestas, total finalizados, tasa % (o «—» si finalizados ≤ 0).
- Barras de distribución 1–5 con `distribucionNps`.
- Tabla de comentarios solo calificación 1–3 con comentario no vacío (RUT, codcli, carrera, jornada, nota, comentario, fecha).
- Estilo Card/Table cercano a `EncuestaDiscapacidadView`.

### Router / menú
- Ruta `/dashboard/nps-rematricula`, meta idéntica a encuesta-discapacidad (`requiresAdminAdmision`, `requiresSoloGrupoDvU`, `requiresPerfilUsuarioIn: [1,2,3]`).
- `dashboard-nps-rematricula` en `DASHBOARD_MENU_ROUTE_NAMES`.
- Icono `Star` registrado (migración Task 2 ya inserta el ítem de menú).

## Verification

| Check | Resultado |
|-------|-----------|
| Route name coincide menú SQL / constants / router | OK |
| `Star` en `menuIcons` | OK |
| Agregados desde `@/utils/npsRematricula` | OK |
| `vue-tsc` sin errores nuevos en archivos de esta task | OK (errores previos en otros módulos del repo) |
| Runtime con respuestas reales / menú DVU visible | No ejercido en esta sesión (depende de API + migración aplicada) |

## Concerns

1. Visibilidad del ítem «NPS rematrícula» requiere migración Task 2 aplicada en el ambiente donde se prueba el menú.
2. Con 0 finalizados la tasa muestra «—» (comportamiento de `tasaRespuestaNps`); promedio también «—» sin respuestas.
3. Filtro de cartera del ejecutivo lo aplica el API (`emailEjecutivo`); la vista solo consume el listado ya filtrado. `totalFinalizados` sigue siendo del periodo completo (ver concern Task 5).
