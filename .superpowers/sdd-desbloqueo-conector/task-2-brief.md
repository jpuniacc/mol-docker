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

