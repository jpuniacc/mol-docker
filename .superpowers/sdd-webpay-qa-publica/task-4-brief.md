### Task 4: Despliegue en `mol.uniacc.cl` y smoke

**Files:**
- Modify on server: `/opt/mol-docker/uniacc-api-docker/.env` (QA URLs; no commit)

- [ ] **Step 1: Env en `uniacc-mol`**

```bash
ssh uniacc-mol 'grep WEBPAY_PLUS_QA /opt/mol-docker/uniacc-api-docker/.env || true'
```

Si faltan, agregar:

```
WEBPAY_PLUS_QA_VOLVER_URL=https://mol.uniacc.cl/api/webpay-qa/volver
WEBPAY_PLUS_QA_MOL_RETORNO=https://mol.uniacc.cl/webpay-qa/retorno
```

- [ ] **Step 2: Rebuild API + MOL**

En el servidor, rebuild de `uniacc-api` y del front `mol-dev` (imagen que sirve `mol.uniacc.cl`) con el código de estas tasks.

- [ ] **Step 3: Smoke sin login**

1. Abrir `https://mol.uniacc.cl/webpay-qa` en ventana privada (sin sesión).
2. Monto 1500, matrícula → Ir a Webpay.
3. Pagar con VISA `4051 8856 0044 6623`, CVV 123, RUT `11.111.111-1` / `123`.
4. Debe volver a `/webpay-qa/retorno?buy_order=...` con estado `autorizada` y token visible.
5. Copiar token y verificar longitud 64.

- [ ] **Step 4: Actualizar nota de tokens**

Agregar al inicio de `docs/webpay/tokens-validacion-transbank.md`:

```md
Para nuevas pruebas usar https://mol.uniacc.cl/webpay-qa (sin login).
```

Commit solo si el usuario lo pide en esa sesión; si no, dejar el archivo modificado.

---

## Spec coverage (self-review)

| Requisito del spec | Task |
| --- | --- |
| Rutas `/webpay-qa` y `/webpay-qa/retorno` | 3 |
| Sin login / fuera de dashboard | 3 |
| API crear / volver / transaccion | 2 |
| Solo integración | 1, 2 |
| return_url y retorno QA | 1, 2 |
| Mostrar token + estado | 3 |
| Reutiliza `mnp_webpay_transaccion` | 2 (`crearTransaccion`) |
| No tocar flujo alumno | File map + constraints |
| Smoke en mol.uniacc.cl | 4 |

## Placeholder scan

Sin TBD / “implement later” / “similar to Task N” sin código.

---

## Execution handoff

Plan guardado en `docs/superpowers/plans/2026-10-18-webpay-qa-publica.md`.

**Opciones de ejecución:**

1. **Subagent-Driven (recomendado)** — un subagente por task, revisión entre tasks  
2. **Inline Execution** — ejecutar las tasks en esta sesión con checkpoints  

¿Cuál preferís?
