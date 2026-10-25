### Task 5: Rebuild / verificación de contenedores

**Files:** ninguno de código (ops)

- [ ] **Step 1:** Rebuild `uniacc-api` si corre en Docker (`docker compose up -d --build` en `/opt/uniacc-api-docker`).
- [ ] **Step 2:** Rebuild `mol-dev` (`docker compose up -d --build --force-recreate` en `/opt/mol-docker`) si se valida en `mol-dev.uniacc.cl`.
- [ ] **Step 3:** Health + smoke de los 2 casos del Task 4.

---

## Spec coverage (self-review)

| Requisito spec | Task |
|----------------|------|
| Endpoint uniacc-api + SP | 1–2 |
| Labels = códigos MT (split Física, Autismo→Espectro) | 3 |
| Afirmaciones solo Supabase | 3–4 (sin cambio de modelo; no SP) |
| Omitir sin SP | 4 Step 3 |
| Contestar → Supabase + SP | 4 Step 2 |
| Fallo no bloquea | 4 Step 2 |
| CODCLI con DV | 4 (usa `ctx.codcli`) |
| Ambiente activo | 1 (resolveAmbienteActivo) |

## Fuera de este plan

- Mantenedor de catálogo discapacidad
- Escribir afirmaciones en ERP
- Bloquear matrícula por fallo SP
