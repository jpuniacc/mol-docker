### Task 6: Vista admin MOL + menú

**Files:**
- Create: `src/services/npsRematriculaAdminApi.ts`
- Create: `src/views/dashboard/rematricula/NpsRematriculaView.vue`
- Modify: `src/router/index.ts`
- Modify: `src/constants/dashboardRouteNames.ts`
- Modify: `src/views/dashboard/layout/menuIcons.ts` (agregar `Star` al mapa si falta)

**Interfaces:**
- Consumes: `GET` admin + `distribucionNps` / `promedioNps` / `tasaRespuestaNps`
- Route name: `dashboard-nps-rematricula`
- Meta: igual que `dashboard-encuesta-discapacidad` (`requiresAdminAdmision`, `requiresSoloGrupoDvU`, `requiresPerfilUsuarioIn: [1,2,3]`)

- [ ] **Step 1: Cliente admin**

```ts
// npsRematriculaAdminApi.ts — patrón encuestaDiscapacidadApi.ts
// destino: `${admisionApiBaseUrl()}/api/rematricula/nps?anio=&semestre=`
// + urlConCarteraEjecutivo
```

- [ ] **Step 2: Vista**

Mostrar:
- Periodo activo (label)
- Cards: promedio (1 decimal), total respuestas, total finalizados, tasa %
- Barras o tabla de distribución 1–5
- Tabla de comentarios solo calificación 1–3 con texto (RUT, codcli, carrera, jornada, nota, comentario, fecha)

Estilo cercano a `EncuestaDiscapacidadView.vue` / `RematriculaKpiView.vue` (Card + Table, sin inventar design system nuevo).

- [ ] **Step 3: Router + constants + icon**

```ts
{
  path: '/dashboard/nps-rematricula',
  name: 'dashboard-nps-rematricula',
  meta: {
    requiresAdminAdmision: true,
    requiresSoloGrupoDvU: true,
    requiresPerfilUsuarioIn: [1, 2, 3],
  },
  component: () => import('../views/dashboard/rematricula/NpsRematriculaView.vue'),
},
```

Añadir `'dashboard-nps-rematricula'` a `DASHBOARD_MENU_ROUTE_NAMES`.

- [ ] **Step 4: Verificar**

1. Ítem «NPS rematrícula» visible para DVU tras migración.
2. Con 0 respuestas: promedio «—», distribución en ceros, tasa según finalizados.
3. Con respuestas de prueba: promedio y comentarios bajos correctos.
4. Ejecutivo (perfil 3) solo ve RUTs de su cartera si aplica el mismo filtro.

- [ ] **Step 5: Commit** (solo si el usuario lo pide)

---

## Spec coverage (self-review)

| Requisito spec | Task |
|----------------|------|
| tNPS facilidad 1–5 en resumen | 4 |
| Omitible sin bloquear contrato | 4 |
| Comentario opcional 1–3 ≤500 | 1, 2, 3, 4 |
| Una respuesta por alumno/periodo | 2 (UNIQUE), 3–4 |
| Persistencia rut, codcli, codigo_carrera, jornada | 2, 3, 4 |
| Reporte promedio, distribución, tasa, comentarios | 1, 5, 6 |
| Acceso admin DVU/TI vía menú | 2, 6 |
| Sin mock en v1 | Global + Task 4 solo alumno |

## Placeholder scan

Sin TBD/TODO en pasos. Rutas, nombres RPC y UUID de menú fijados.

## Type consistency

- `CalificacionNps` / `esCalificacionNps` compartidos entre util, API alumno y card.
- Campos DB: `codigo_carrera`, `jornada` (valor desde `jornada_carrera` MNP).
- Route name idéntico en menú SQL, router y `dashboardRouteNames`.
