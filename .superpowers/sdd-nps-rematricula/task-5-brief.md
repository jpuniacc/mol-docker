### Task 5: API admin en uniacc-api

**Files (repo `/opt/uniacc-api-docker`):**
- Create: `src/services/nps-rematricula.service.ts`
- Create: `src/services/nps-rematricula.service.test.ts`
- Create: `src/controllers/rematricula-nps.controller.ts`
- Create: `src/routes/rematricula-nps.routes.ts`
- Modify: `src/index.ts`

**Interfaces:**
- `GET /api/rematricula/nps?anio=&semestre=&emailEjecutivo=`
- Response:

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

`totalFinalizados`: count en `mnp_progreso_rematricula` del periodo con `excluido_mol = false`, `sin_match_mol = false` y `etapa_actual IN ('firma','matriculado')`.

Filtro cartera ejecutivo: mismo patrón que encuesta discapacidad (`emailEjecutivoDeQuery` + `rutsDeEjecutivo` + filtrar por `rut`).

- [ ] **Step 1: Test de mapeo/filtro puro** (extraer helpers si hace falta)

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { filtrarComentariosBajos } from './nps-rematricula.service'

describe('filtrarComentariosBajos', () => {
  it('solo 1-3 con comentario', () => {
    const out = filtrarComentariosBajos([
      { calificacion: 5, comentario: 'ok' },
      { calificacion: 2, comentario: 'lento' },
      { calificacion: 1, comentario: null },
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0]?.comentario, 'lento')
  })
})
```

Exportar `filtrarComentariosBajos` desde el service (el front también puede filtrar; este helper documenta la regla del spec para comentarios del reporte).

- [ ] **Step 2: Implementar service** leyendo Postgres con el cliente que ya usa `encuesta-discapacidad.service.ts` (mismo pool/supabase admin).

Query respuestas:

```sql
SELECT id, creado_en, rut_alumno, codcli, codigo_carrera, jornada,
       calificacion, comentario
FROM public.mnp_nps_rematricula
WHERE anio_periodo = $1 AND semestre_periodo = $2
ORDER BY creado_en DESC
```

Query finalizados:

```sql
SELECT count(*)::int AS n
FROM public.mnp_progreso_rematricula
WHERE anio_periodo = $1 AND semestre_periodo = $2
  AND excluido_mol = false
  AND sin_match_mol = false
  AND etapa_actual IN ('firma', 'matriculado')
```

Si no hay `anio`/`semestre` en query, usar periodo activo igual que otros endpoints de rematrícula (revisar `encuesta-discapacidad` / periodo; si discapacidad no filtra periodo, aceptar query obligatoria `anio`+`semestre` desde el front con `usePeriodoActivoStore`).

- [ ] **Step 3: Controller + route + mount**

```ts
// routes
router.get('/', listarNpsRematriculaHttp)
// index.ts
app.use('/api/rematricula/nps', rematriculaNpsRoutes)
```

- [ ] **Step 4: Run tests**

Run (en uniacc-api): `npm test -- src/services/nps-rematricula.service.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** en uniacc-api (solo si el usuario lo pide)

---

