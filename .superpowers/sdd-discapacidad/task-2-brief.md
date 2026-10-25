### Task 2: Controller + routes + mount

**Files:**
- Create: `/opt/uniacc-api-docker/src/controllers/rematricula-discapacidad.controller.ts`
- Create: `/opt/uniacc-api-docker/src/routes/rematricula-discapacidad.routes.ts`
- Modify: `/opt/uniacc-api-docker/src/index.ts`

**Interfaces:**
- Consumes: `actualizaDiscapacidadMolService.actualizar`
- Produces: `POST /api/rematricula/discapacidad/actualizar-erp`

- [ ] **Step 1: Controller**

```ts
export const validadoresActualizarDiscapacidadErp = [
  body('codcli').isString().trim().notEmpty().isLength({ max: 20 }),
  body('discapacidad').isString().trim().notEmpty().isLength({ max: 100 }),
]

export async function actualizarDiscapacidadErpHttp(req: Request, res: Response): Promise<void> {
  // validation → 400
  // result = await actualizaDiscapacidadMolService.actualizar({ codcli, discapacidad })
  // !ok → 502 si ERP_ERROR, 200 si NO_ROWS/INVALID_CODE (mismo estilo contacto)
  // ok → 200 json
}
```

Lista blanca opcional en controller (códigos conocidos) **además** del SP; si falla la lista → 400. Incluir los 7 tipos UI (no `Ninguna` en el body de “contesta”).

- [ ] **Step 2: Routes**

```ts
router.post('/actualizar-erp', validadoresActualizarDiscapacidadErp, actualizarDiscapacidadErpHttp)
```

- [ ] **Step 3: Mount en `index.ts`**

```ts
app.use('/api/rematricula/discapacidad', rematriculaDiscapacidadRoutes)
// startup log:
// POST /api/rematricula/discapacidad/actualizar-erp
```

- [ ] **Step 4: Verificar build TypeScript**

Run: `cd /opt/uniacc-api-docker && npx tsc --noEmit` (o el script `npm run build` del repo)  
Expected: sin errores en archivos nuevos.

- [ ] **Step 5: Commit** (si el usuario lo pide)

```bash
git add src/services/actualiza-discapacidad-mol.service.ts \
  src/controllers/rematricula-discapacidad.controller.ts \
  src/routes/rematricula-discapacidad.routes.ts src/index.ts
git commit -m "feat(rematricula): endpoint actualizar discapacidad ERP"
```

---

