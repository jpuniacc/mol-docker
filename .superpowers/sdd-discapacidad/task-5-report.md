# Task 5 — Rebuild / verificación de contenedores

**Fecha:** 2026-09-25 (CLT)  
**Ambiente:** host dev (`127.0.0.1:9080` vía Traefik)

## Step 1: Rebuild `uniacc-api`

```bash
cd /opt/uniacc-api-docker && docker compose up -d --build
```

| Resultado | Detalle |
|-----------|---------|
| Build | OK (`tsc`, imagen `uniacc-api-docker-uniacc-api`) |
| Contenedor | `uniacc-api` recreado e iniciado |
| Imagen | `sha256:50a2584a1fe6…` |

**Nota:** No se usó `--force-recreate` explícito; Compose recreó el contenedor al cambiar la imagen (norma del proyecto).

## Step 2: Rebuild `mol-dev`

```bash
cd /opt/mol-docker && docker compose up -d --build --force-recreate
```

| Resultado | Detalle |
|-----------|---------|
| Build | OK (`vite build`, ~2188 módulos) |
| Contenedor | `mol-dev` force-recreate + start |
| Imagen | `sha256:766952c48cf5…` |

## Step 3: Health checks

| Check | Comando / ruta | HTTP | Cuerpo |
|-------|----------------|------|--------|
| uniacc-api (IP legacy) | `GET http://127.0.0.1:9080/api/health` | 200 | `{"status":"OK",…}` |
| uniacc-api (Host gateway) | `GET` + `Host: apigateway-dev.uniacc.cl` | 200 | `{"status":"OK",…}` |
| mol-dev | `GET` + `Host: mol-dev.uniacc.cl` → `/mol-health` | 200 | `OK` |
| mol-dev (directo en contenedor) | `wget http://127.0.0.1/mol-health` | 200 | `OK` |

**Observación:** Tras el `--force-recreate`, el primer `curl` a `/mol-health` vía Traefik devolvió **404** (probable ventana de registro/routing). Reintento ~30 s después: **200 OK**.

## Step 4: Smoke (bundles + API)

### Bundles MOL (contenedor `mol-dev`)

El paso de discapacidad vive en el chunk lazy de datos personales:

- Archivo: `/usr/share/nginx/html/assets/DatosPersonalesMockView.CFb6aglN.js`
- Cadenas presentes:
  - `discapacidad/actualizar-erp`
  - `[discapacidadErp]` (log fire-and-forget)

Confirma que el cliente ERP y la orquestación del Task 4 están en el bundle servido en producción del contenedor.

### Ruta montada en `uniacc-api`

Log de arranque incluye:

```text
POST   /api/rematricula/discapacidad/actualizar-erp
```

### POST validación (cuerpo vacío `{}`)

| Vía | HTTP | Respuesta |
|-----|------|-----------|
| Traefik → `apigateway-dev.uniacc.cl` | 400 | `Parámetros incompletos o inválidos` |
| Traefik PathPrefix `/api` (sin Host) | 400 | idem |
| Traefik → `mol-dev.uniacc.cl` (nginx → `uniacc-api:3001`) | 400 | idem |

Demuestra que la ruta está montada y los validadores responden antes de invocar el SP.

## Smoke UI (Task 4 Step 4) — no ejecutado

| Caso | Estado |
|------|--------|
| Contestar encuesta → POST ERP + Supabase | **Bloqueado** — flujo matrícula mock requiere sesión LDAP / login y contexto alumno |
| Omitir → sin POST ERP | **Bloqueado** — mismo motivo |
| Verificar `MT_CLIENT.DISCAPACIDAD` en ERP | **Manual** — requiere CODCLI real y ambiente activo |

**Recomendación manual:** Tras login en `https://mol-dev.uniacc.cl`, paso discapacidad → contestar con tipo (ej. Visual) → DevTools Network debe mostrar `POST …/api/rematricula/discapacidad/actualizar-erp`. Omitir no debe generar ese POST.

## Estado final contenedores

| Contenedor | Estado |
|------------|--------|
| `uniacc-api` | running |
| `mol-dev` | running |
| `traefik-docker-traefik-1` | running (`9080→80`) |

## Conclusión

Rebuild de **uniacc-api** y **mol-dev** completado. Health OK (con reintento en mol-health). Bundles contienen la ruta ERP de discapacidad; API responde **400** de validación en POST vacío por las tres rutas probadas. Smoke UI pendiente por autenticación.
