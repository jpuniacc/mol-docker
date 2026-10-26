# Desbloqueo hacia ConectorIntegracion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada cambio del mantenedor de desbloqueo de toma de ramos hace un upsert en `ConectorIntegracion.dbo.MOL_ALUMNOS_DESBL` de U+ PROD.

**Architecture:** Un módulo nuevo de la API arma la fila y ejecuta un `MERGE` con el pool `getConnectionErpSp('prod')`. El servicio del mantenedor lo llama después de cada cambio en Supabase y devuelve `avisosU` si U+ falla. El front muestra esos avisos. Un script sube una vez los RUT ya cargados.

**Tech Stack:** Express + TypeScript (`uniacc-api-docker`), `mssql`, `pg` vía `querySupabase`, `node:test` con `tsx --test`. Vue 3 + TS en `mol-docker`.

**Spec:** `docs/superpowers/specs/2026-10-26-desbloqueo-conector-integracion-design.md`

## Global Constraints

- Tabla: `ConectorIntegracion.dbo.MOL_ALUMNOS_DESBL`, siempre en U+ PROD (también desde mol-dev). Nunca `QAConectorIntegracion`.
- `RUT` = `cuerpo-DV` sin puntos, ej. `18056961-8`.
- `ANO`/`PERIODO` = `tp_periodo_activo` con `estado IS TRUE`.
- `FECHA` = `GETDATE()`.
- `USUARIO` = actor recortado a 100; vacío → `MOL`.
- `DESBLOQUEADO` = `S` si el RUT tiene algún CODCLI con `desbloqueado = true` en Supabase después del cambio; si no, `N`.
- Nunca se borran filas en U+. Un fallo de U+ no revierte Supabase ni cambia `ok`.
- Aviso de fallo: `<rut> quedó en MOL, pero no llegó a U+.` Sin período: `No hay período activo; no se envió a U+.`
- Logs con prefijo `[desbloqueo-conector]`, sin credenciales.
- No commit en `mol-docker` de archivos ajenos. No push.

---

### Task 1: Módulo conector en la API

**Files:**
- Create: `/opt/uniacc-api-docker/src/services/desbloqueo-conector-integracion.ts`
- Test: `/opt/uniacc-api-docker/src/services/desbloqueo-conector-integracion.test.ts`

**Interfaces:**
- Produces:
  - `type FilaConector = { rut: string; ano: number; periodo: 1 | 2; usuario: string; desbloqueado: 'S' | 'N' }`
  - `type DepsConector = { periodoActivo(): Promise<{ ano: number; periodo: 1 | 2 } | null>; rutDesbloqueado(rutCuerpo: string): Promise<boolean>; merge(fila: FilaConector): Promise<void> }`
  - `filaConector(input: { rutCuerpo: string; dv: string; ano: number; periodo: 1 | 2; actor: string | null; desbloqueado: boolean }): FilaConector`
  - `sincronizarRutConector(rutCuerpo: string, dv: string, actor: string | null, deps?: DepsConector): Promise<string | null>`
  - `depsConectorPorDefecto: DepsConector`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  filaConector,
  sincronizarRutConector,
  type DepsConector,
  type FilaConector,
} from './desbloqueo-conector-integracion'

function deps(over: Partial<DepsConector> = {}): DepsConector & { filas: FilaConector[] } {
  const filas: FilaConector[] = []
  return {
    filas,
    periodoActivo: async () => ({ ano: 2027, periodo: 1 }),
    rutDesbloqueado: async () => true,
    merge: async (fila) => {
      filas.push(fila)
    },
    ...over,
  }
}

describe('filaConector', () => {
  it('arma el RUT con guion y marca S', () => {
    assert.deepEqual(
      filaConector({
        rutCuerpo: '18056961',
        dv: '8',
        ano: 2027,
        periodo: 1,
        actor: 'jperez@uniacc.cl',
        desbloqueado: true,
      }),
      { rut: '18056961-8', ano: 2027, periodo: 1, usuario: 'jperez@uniacc.cl', desbloqueado: 'S' },
    )
  })

  it('usa MOL si el actor viene vacío y marca N', () => {
    const fila = filaConector({
      rutCuerpo: '18056961',
      dv: '8',
      ano: 2027,
      periodo: 1,
      actor: '  ',
      desbloqueado: false,
    })
    assert.equal(fila.usuario, 'MOL')
    assert.equal(fila.desbloqueado, 'N')
  })

  it('recorta el actor a 100 caracteres', () => {
    const fila = filaConector({
      rutCuerpo: '18056961',
      dv: '8',
      ano: 2027,
      periodo: 1,
      actor: 'x'.repeat(150),
      desbloqueado: true,
    })
    assert.equal(fila.usuario.length, 100)
  })
})

describe('sincronizarRutConector', () => {
  it('hace el merge con el estado que queda en Supabase', async () => {
    const d = deps({ rutDesbloqueado: async () => false })
    const aviso = await sincronizarRutConector('18056961', '8', null, d)
    assert.equal(aviso, null)
    assert.deepEqual(d.filas, [
      { rut: '18056961-8', ano: 2027, periodo: 1, usuario: 'MOL', desbloqueado: 'N' },
    ])
  })

  it('devuelve el aviso si U+ falla y no lanza', async () => {
    const d = deps({
      merge: async () => {
        throw new Error('timeout')
      },
    })
    const aviso = await sincronizarRutConector('18056961', '8', 'ana', d)
    assert.equal(aviso, '18056961-8 quedó en MOL, pero no llegó a U+.')
  })

  it('sin período activo no llama al merge', async () => {
    const d = deps({ periodoActivo: async () => null })
    const aviso = await sincronizarRutConector('18056961', '8', 'ana', d)
    assert.equal(aviso, 'No hay período activo; no se envió a U+.')
    assert.equal(d.filas.length, 0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/desbloqueo-conector-integracion.test.ts`
Expected: FAIL, `Cannot find module './desbloqueo-conector-integracion'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import sql from 'mssql'

import { getConnectionErpSp } from '../config/database-erp-sp'
import { querySupabase } from '../config/postgres-supabase'

export type FilaConector = {
  rut: string
  ano: number
  periodo: 1 | 2
  usuario: string
  desbloqueado: 'S' | 'N'
}

export type DepsConector = {
  periodoActivo(): Promise<{ ano: number; periodo: 1 | 2 } | null>
  rutDesbloqueado(rutCuerpo: string): Promise<boolean>
  merge(fila: FilaConector): Promise<void>
}

const AVISO_SIN_PERIODO = 'No hay período activo; no se envió a U+.'

export function filaConector(input: {
  rutCuerpo: string
  dv: string
  ano: number
  periodo: 1 | 2
  actor: string | null
  desbloqueado: boolean
}): FilaConector {
  const actor = (input.actor ?? '').trim()
  return {
    rut: `${input.rutCuerpo}-${input.dv}`,
    ano: input.ano,
    periodo: input.periodo,
    usuario: actor ? actor.slice(0, 100) : 'MOL',
    desbloqueado: input.desbloqueado ? 'S' : 'N',
  }
}

export const depsConectorPorDefecto: DepsConector = {
  async periodoActivo() {
    const res = await querySupabase(
      `SELECT anio_periodo, semestre_periodo
         FROM public.tp_periodo_activo
        WHERE estado IS TRUE
        ORDER BY id
        LIMIT 1`,
    )
    const row = res.rows[0] as { anio_periodo?: number; semestre_periodo?: number } | undefined
    const ano = Number(row?.anio_periodo)
    const periodo = Number(row?.semestre_periodo)
    if (!Number.isInteger(ano) || (periodo !== 1 && periodo !== 2)) return null
    return { ano, periodo }
  },
  async rutDesbloqueado(rutCuerpo) {
    const res = await querySupabase(
      `SELECT 1
         FROM public.mnp_desbloqueo_toma_ramos
        WHERE rut_cuerpo = $1
          AND desbloqueado IS TRUE
        LIMIT 1`,
      [rutCuerpo],
    )
    return (res.rows ?? []).length > 0
  },
  async merge(fila) {
    const pool = await getConnectionErpSp('prod')
    await pool
      .request()
      .input('rut', sql.VarChar(12), fila.rut)
      .input('ano', sql.Int, fila.ano)
      .input('periodo', sql.Int, fila.periodo)
      .input('usuario', sql.VarChar(100), fila.usuario)
      .input('desbloqueado', sql.Char(1), fila.desbloqueado)
      .query(`
        MERGE ConectorIntegracion.dbo.MOL_ALUMNOS_DESBL WITH (HOLDLOCK) AS t
        USING (SELECT @rut AS RUT, @ano AS ANO, @periodo AS PERIODO) AS s
           ON t.RUT = s.RUT AND t.ANO = s.ANO AND t.PERIODO = s.PERIODO
        WHEN MATCHED THEN
          UPDATE SET FECHA = GETDATE(), USUARIO = @usuario, DESBLOQUEADO = @desbloqueado
        WHEN NOT MATCHED THEN
          INSERT (RUT, ANO, PERIODO, FECHA, USUARIO, DESBLOQUEADO)
          VALUES (@rut, @ano, @periodo, GETDATE(), @usuario, @desbloqueado);
      `)
  },
}

export async function sincronizarRutConector(
  rutCuerpo: string,
  dv: string,
  actor: string | null,
  deps: DepsConector = depsConectorPorDefecto,
): Promise<string | null> {
  const rut = `${rutCuerpo}-${dv}`
  try {
    const periodo = await deps.periodoActivo()
    if (!periodo) return AVISO_SIN_PERIODO
    const desbloqueado = await deps.rutDesbloqueado(rutCuerpo)
    await deps.merge(
      filaConector({ rutCuerpo, dv, ano: periodo.ano, periodo: periodo.periodo, actor, desbloqueado }),
    )
    return null
  } catch (error) {
    console.error(
      `[desbloqueo-conector] ${rut}:`,
      error instanceof Error ? error.message : error,
    )
    return `${rut} quedó en MOL, pero no llegó a U+.`
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /opt/uniacc-api-docker && npx tsx --test src/services/desbloqueo-conector-integracion.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/desbloqueo-conector-integracion.ts src/services/desbloqueo-conector-integracion.test.ts
git commit -m "feat(rematricula): armar y enviar el desbloqueo de un RUT a ConectorIntegracion"
```

---

### Task 2: Llamar al conector desde el mantenedor

**Files:**
- Modify: `/opt/uniacc-api-docker/src/services/desbloqueo-toma-ramos.service.ts` (métodos `importar`, `desbloquear`, `bloquear`, `quitar`)
- Modify: `/opt/uniacc-api-docker/src/controllers/desbloqueo-toma-ramos.controller.ts` (métodos `importar`, `desbloquear`, `bloquear`, `quitar`)

**Interfaces:**
- Consumes: `sincronizarRutConector(rutCuerpo, dv, actor): Promise<string | null>` de Task 1.
- Produces (respuestas HTTP):
  - `POST /importar` → `{ ok, insertadas, errores, avisosU: string[] }`
  - `POST /desbloquear` y `POST /bloquear` → `{ ok: true, fila, avisosU: string[] }`
  - `DELETE /:id` → `{ ok: true, avisosU: string[] }`

- [ ] **Step 1: Agregar import y helper en el servicio**

Al inicio de `desbloqueo-toma-ramos.service.ts`, junto a los imports:

```ts
import { sincronizarRutConector } from './desbloqueo-conector-integracion'
```

Después de `upsertFila`:

```ts
async function avisosConector(
  ruts: Array<{ rutCuerpo: string; dv: string }>,
  actor: string | null,
): Promise<string[]> {
  const vistos = new Set<string>()
  const avisos: string[] = []
  for (const { rutCuerpo, dv } of ruts) {
    if (vistos.has(rutCuerpo)) continue
    vistos.add(rutCuerpo)
    const aviso = await sincronizarRutConector(rutCuerpo, dv, actor)
    if (aviso && !avisos.includes(aviso)) avisos.push(aviso)
  }
  return avisos
}
```

- [ ] **Step 2: `importar` devuelve `avisosU`**

Reemplazar el método completo:

```ts
  async importar(
    entradas: FilaDesbloqueoEntrada[],
    actualizadoPor: string | null,
  ): Promise<{ insertadas: number; errores: string[]; avisosU: string[] }> {
    if (!Array.isArray(entradas) || entradas.length === 0) {
      return { insertadas: 0, errores: ['El archivo no trae filas.'], avisosU: [] }
    }
    if (entradas.length > MAX_FILAS) {
      return { insertadas: 0, errores: [`El máximo por carga es ${MAX_FILAS} filas.`], avisosU: [] }
    }
    const errores: string[] = []
    const guardadas: Array<{ rutCuerpo: string; dv: string }> = []
    const actor = texto(actualizadoPor)
    for (const [indice, entrada] of entradas.entries()) {
      const validada = validarFilaDesbloqueo(entrada)
      if (!validada.ok) {
        errores.push(`Fila ${indice + 2}: ${validada.error}`)
        continue
      }
      await upsertFila(validada.fila, actor)
      guardadas.push(validada.fila)
    }
    const avisosU = await avisosConector(guardadas, actor)
    return { insertadas: guardadas.length, errores, avisosU }
  }
```

- [ ] **Step 3: `desbloquear` y `bloquear` devuelven `avisosU`**

`desbloquear`:

```ts
  async desbloquear(input: FilaDesbloqueoEntrada & { actualizadoPor?: string | null }): Promise<
    | { ok: true; fila: DesbloqueoTomaRamosRow; avisosU: string[] }
    | { ok: false; error: string }
  > {
    const validada = validarFilaDesbloqueo(input)
    if (!validada.ok) return validada
    const actor = texto(input.actualizadoPor)
    const fila = await upsertFila(validada.fila, actor)
    const avisosU = await avisosConector([validada.fila], actor)
    return { ok: true, fila, avisosU }
  }
```

`bloquear`: cambiar la firma de retorno a `Promise<{ ok: true; fila: DesbloqueoTomaRamosRow; avisosU: string[] } | { ok: false; error: string }>` y reemplazar el final:

```ts
    const row = (res.rows ?? [])[0] as Record<string, unknown> | undefined
    if (!row) return { ok: false, error: 'Ese RUT y CODCLI no están en la lista.' }
    const fila = filaDesdeRow(row)
    const avisosU = await avisosConector(
      [{ rutCuerpo: fila.rutCuerpo, dv: fila.dv }],
      texto(input.actualizadoPor),
    )
    return { ok: true, fila, avisosU }
```

- [ ] **Step 4: `quitar` devuelve el RUT y `avisosU`**

```ts
  async quitar(
    id: number,
    actualizadoPor: string | null = null,
  ): Promise<{ ok: true; avisosU: string[] } | { ok: false }> {
    if (!Number.isInteger(id) || id <= 0) return { ok: false }
    const res = await querySupabase(
      `DELETE FROM public.mnp_desbloqueo_toma_ramos WHERE id = $1 RETURNING rut_cuerpo, dv`,
      [id],
    )
    const row = (res.rows ?? [])[0] as { rut_cuerpo?: string; dv?: string } | undefined
    if (!row) return { ok: false }
    const avisosU = await avisosConector(
      [{ rutCuerpo: String(row.rut_cuerpo ?? ''), dv: String(row.dv ?? '') }],
      texto(actualizadoPor),
    )
    return { ok: true, avisosU }
  }
```

- [ ] **Step 5: Controlador**

En `importar`, agregar `avisosU` a la respuesta:

```ts
      res.status(200).json({
        ok: result.insertadas > 0 || (result.errores.length === 0 && rechazadas.length === 0),
        ...result,
        errores: [...result.errores, ...rechazadas],
      })
```

queda igual (ya expande `result`, que trae `avisosU`). `desbloquear` y `bloquear` ya responden `res.status(200).json(result)`, que trae `avisosU`.

En `quitar`, reemplazar desde `const ok = await ...`:

```ts
      const result = await desbloqueoTomaRamosService.quitar(id, actor(req))
      if (!result.ok) {
        res.status(404).json({ ok: false, message: 'La fila no existe.' })
        return
      }
      res.status(200).json({ ok: true, avisosU: result.avisosU })
```

`actor(req)` lee `req.body.actualizadoPor`; en `DELETE` el body puede venir vacío y entonces queda `MOL`.

- [ ] **Step 6: Verificar**

Run: `cd /opt/uniacc-api-docker && npm run type-check && npm test`
Expected: sin errores de tipos; todas las pruebas pasan.

- [ ] **Step 7: Commit**

```bash
cd /opt/uniacc-api-docker
git add src/services/desbloqueo-toma-ramos.service.ts src/controllers/desbloqueo-toma-ramos.controller.ts
git commit -m "feat(rematricula): enviar a U+ cada cambio del mantenedor de desbloqueo"
```

---

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

### Task 4: Avisos en el mantenedor de MOL

**Files:**
- Modify: `/opt/mol-docker/src/services/desbloqueoTomaRamosApi.ts`
- Modify: `/opt/mol-docker/src/views/dashboard/rematricula/MantenedorDesbloqueoTomaRamosView.vue:106-204`

**Interfaces:**
- Consumes: campo `avisosU: string[]` de las cuatro respuestas de Task 2.
- Produces:
  - `importarDesbloqueoTomaRamos` → `{ ok; insertadas; errores; avisosU: string[]; message? }`
  - `desbloquearTomaRamos`, `bloquearTomaRamos`, `quitarDesbloqueoTomaRamos` → `{ ok: true; avisosU: string[] } | { ok: false; message: string }`

- [ ] **Step 1: Cliente API**

En `importarDesbloqueoTomaRamos`, el tipo de retorno pasa a `Promise<{ ok: boolean; insertadas: number; errores: string[]; avisosU: string[]; message?: string }>`. En la rama de error de `destino` devolver `avisosU: []`. Al leer el body agregar `avisosU?: string[]` y devolver `avisosU: body?.avisosU ?? []`.

En `desbloquearTomaRamos`, `bloquearTomaRamos` y `quitarDesbloqueoTomaRamos`, el tipo de éxito pasa a `{ ok: true; avisosU: string[] }`, el body se lee como `{ ok?: boolean; message?: string; avisosU?: string[] }` y el retorno de éxito es:

```ts
  return { ok: true, avisosU: body.avisosU ?? [] }
```

- [ ] **Step 2: Vista**

En `MantenedorDesbloqueoTomaRamosView.vue`, antes de `subirExcel`:

```ts
function avisarU(avisos: string[]) {
  if (avisos.length === 0) return
  toast.warning(
    avisos.length === 1 ? avisos[0] : `${avisos.length} RUT no llegaron a U+. ${avisos[0]}`,
  )
}
```

Llamar `avisarU(result.avisosU)`:
- en `subirExcel`, después del `toast.warning` de filas que no entraron;
- en `desbloquearFila`, `bloquear` y `quitar`, después del `toast.success`.

- [ ] **Step 3: Verificar**

Run: `cd /opt/mol-docker && npx vue-tsc --noEmit -p tsconfig.app.json`
Expected: sin errores nuevos en esos dos archivos.

- [ ] **Step 4: Commit**

```bash
cd /opt/mol-docker
git add src/services/desbloqueoTomaRamosApi.ts src/views/dashboard/rematricula/MantenedorDesbloqueoTomaRamosView.vue
git commit -m "feat(rematricula): avisar en el mantenedor si el desbloqueo no llegó a U+"
```

---

### Task 5: Desplegar en mol-dev y subir los existentes

- [ ] **Step 1: Reconstruir la API de mol-dev**

Run: `cd /opt/uniacc-api-docker && docker compose up -d --build --force-recreate uniacc-api`
Expected: `Container uniacc-api Started`.

- [ ] **Step 2: Correr el script**

Run: `docker exec uniacc-api node dist/scripts/backfill-desbloqueo-conector.js`
Expected: `"ruts": 113`, `"enviados": 113`, `"avisos": []`.

- [ ] **Step 3: Verificar en U+ PROD**

```sql
SELECT DESBLOQUEADO, ANO, PERIODO, COUNT(*) AS filas
  FROM ConectorIntegracion.dbo.MOL_ALUMNOS_DESBL
 GROUP BY DESBLOQUEADO, ANO, PERIODO;
```

Expected: una fila `S | 2027 | 1 | 113`.

- [ ] **Step 4: Reconstruir mol-dev local**

Quitar el bloque `/prueba-pixarron` de `src/router/index.ts`, correr `cd /opt/mol-docker && docker compose up -d --build --force-recreate mol-dev` y restaurar el bloque. Confirmar `git diff --stat src/router/index.ts` vacío.

- [ ] **Step 5: Prueba en pantalla**

En `https://mol-dev.uniacc.cl/dashboard/mantenedor-desbloqueo-toma-ramos`, volver a bloquear un RUT ya cargado y comprobar en U+ que su fila pasó a `N` con `FECHA` y `USUARIO` nuevos. Desbloquearlo de nuevo y comprobar `S`.
