### Task 3: Script de alumnos ya cargados

**Files:**
- Create: `/opt/uniacc-api-docker/src/scripts/backfill-desbloqueo-conector.ts`

**Interfaces:**
- Consumes: `sincronizarRutConector` de Task 1; `querySupabase`.

- [ ] **Step 1: Escribir el script**

```ts
import '../env'

import { querySupabase } from '../config/postgres-supabase'
import { sincronizarRutConector } from '../services/desbloqueo-conector-integracion'

async function main() {
  const res = await querySupabase(
    `SELECT DISTINCT ON (rut_cuerpo) rut_cuerpo, dv
       FROM public.mnp_desbloqueo_toma_ramos
      ORDER BY rut_cuerpo, updated_at DESC`,
  )
  const filas = res.rows as Array<{ rut_cuerpo: string; dv: string }>
  let enviados = 0
  const avisos: string[] = []
  for (const fila of filas) {
    const aviso = await sincronizarRutConector(fila.rut_cuerpo, fila.dv, 'MOL')
    if (aviso) avisos.push(aviso)
    else enviados += 1
  }
  console.log(JSON.stringify({ ok: avisos.length === 0, ruts: filas.length, enviados, avisos }, null, 2))
  process.exit(avisos.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('[desbloqueo-conector] backfill falló:', e instanceof Error ? e.message : e)
  process.exit(1)
})
```

- [ ] **Step 2: Verificar tipos**

Run: `cd /opt/uniacc-api-docker && npm run type-check`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/scripts/backfill-desbloqueo-conector.ts
git commit -m "feat(rematricula): subir a U+ los desbloqueos ya cargados"
```

---

