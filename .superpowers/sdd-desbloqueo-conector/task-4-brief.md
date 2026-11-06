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

