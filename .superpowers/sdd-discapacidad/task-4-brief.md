### Task 4: Cliente MOL + orquestación del paso

**Files:**
- Create: `/opt/mol-docker/src/services/actualizarDiscapacidadMolApi.ts`
- Modify: `/opt/mol-docker/src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue`
- Modify: `/opt/mol-docker/src/services/discapacidadEncuesta.ts` (solo si hace falta tipar `tipoDiscapacidad` con el union nuevo)

**Interfaces:**
- Consumes: `POST /api/rematricula/discapacidad/actualizar-erp`, `guardarDiscapacidadEncuesta`
- Produces: `actualizarDiscapacidadMolErp({ codcli, discapacidad })`

- [ ] **Step 1: Cliente API** (copiar patrón de `actualizarDatosMolApi.ts`)

```ts
export async function actualizarDiscapacidadMolErp(payload: {
  codcli: string
  discapacidad: string
}): Promise<{ ok: boolean; error?: string; message?: string }> {
  const url = apiUrl('/api/rematricula/discapacidad/actualizar-erp')
  // fetch POST, timeout 60s, no throw al caller
}
```

- [ ] **Step 2: En `guardar()` (contesta=true)**

Orden:
1. `persistirEncuesta` (Supabase)
2. `mockCtx.setDiscapacidad`
3. Fire-and-forget ERP (no await bloqueante del router, o await con try/catch que nunca impide `router.push`):

```ts
const codcli = (ctx.codcli ?? '').trim()
if (codcli && respuesta.tipo) {
  void actualizarDiscapacidadMolErp({
    codcli,
    discapacidad: respuesta.tipo,
  }).then((r) => {
    if (!r.ok) console.warn('[discapacidadErp]', r.error ?? r.message)
  })
}
void router.push({ name: 'matricula-mock-forma-pago' })
```

- [ ] **Step 3: En `omitir()`**

Solo Supabase + `setDiscapacidad` + navigate. **Ninguna** llamada a `actualizarDiscapacidadMolErp`.

- [ ] **Step 4: Smoke UI**

1. Contestar con Visual → red: POST discapacidad/actualizar-erp; ERP `MT_CLIENT.DISCAPACIDAD` = Visual (ambiente activo).  
2. Omitir → no POST ERP; valor ERP previo intacto.  
3. Afirmaciones siguen en Supabase.

- [ ] **Step 5: Commit** (si el usuario lo pide)

```bash
cd /opt/mol-docker
git add src/services/actualizarDiscapacidadMolApi.ts \
  src/views/matricula-mock/MatriculaMockDiscapacidadStep.vue
git commit -m "feat(rematricula): sync discapacidad a ERP al contestar encuesta"
```

---

