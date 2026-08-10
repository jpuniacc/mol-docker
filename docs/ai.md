# mol-docker — memoria para IA

Frontend Vue (ex `rematricula-online`) dockerizado. Home activo: **`/opt/mol-docker`**.

Legacy sin Docker: `/opt/rematricula-online` (PM2 `:9501`). Preferir este repo.

---

## Arquitectura

```text
Browser → https://mol-dev.uniacc.cl/   (nginx host :443 TLS)
            └── proxy → http://127.0.0.1:9080
                    └── Traefik (web :9080, Host mol-dev.uniacc.cl, priority 200)
                            └── mol-dev (nginx :80)
                                    ├── /              → SPA (try_files)
                                    ├── /health, /mol-health → OK
                                    ├── /api/auth*     → autenticacion-api:9502 (+ X-API-Key)
                                    └── /api/*         → uniacc-api:3001

Debug: http://mol-dev.uniacc.cl:9080/  (Traefik directo, sin TLS del host)
```

- **URL principal:** `https://mol-dev.uniacc.cl/`
- **Certificados (nginx host):** `/opt/Uniacc-dashboard-admision/certificados/uniacc_cl.crt` y `.key` (wildcard `*.uniacc.cl`)
- **Sitio nginx:** `/etc/nginx/sites-available/mol-dev.uniacc.cl` → `sites-enabled`
- **Same-origin:** `VITE_API_URL` vacío en build → el browser llama `/api/*` al Host público.
- **Red:** `traefik_default` (externa). Contenedores `autenticacion-api` y `uniacc-api` deben estar up.
- **No** editar `/opt/traefik-docker/docker-compose.yml` para este servicio: labels en `docker-compose.yml`.

---

## Archivos clave

| Archivo | Rol |
| --- | --- |
| `Dockerfile` | multi-stage: `base` → `builder` → `dev` → `production` (nginx) |
| `nginx/default.conf.template` | SPA + proxies; `REMATRICULA_API_KEY` en `/api/auth` |
| `docker-compose.yml` | prod + Traefik Host `mol-dev.uniacc.cl` |
| `docker-compose.dev.yml` | target `dev`, `:9501`, volúmenes `src` |
| `.env` | local (no commit); copiar desde rematricula o `.env.docker.example` |
| `scripts/stop-legacy-pm2.sh` | detiene PM2 `rematricula-online` |

---

## Comandos

```bash
cd /opt/mol-docker

# Producción (Traefik)
docker compose up -d --build --force-recreate
docker compose logs -f mol-dev

# Dev (Vite en contenedor, puerto host 9501)
docker compose -f docker-compose.dev.yml up -d --build
# Si choca con PM2 legacy:
./scripts/stop-legacy-pm2.sh

# Health (HTTPS público)
curl -sk https://mol-dev.uniacc.cl/mol-health
curl -sk -o /dev/null -w '%{http_code}\n' https://mol-dev.uniacc.cl/

# Debug directo Traefik :9080
curl -sS -H 'Host: mol-dev.uniacc.cl' http://127.0.0.1:9080/mol-health
curl -sS -o /dev/null -w '%{http_code}\n' -H 'Host: mol-dev.uniacc.cl' http://127.0.0.1:9080/
```

Rebuild obligatorio tras cambiar cualquier `VITE_*` (van al bundle en build time).

---

## /etc/hosts (clientes LAN sin DNS)

```text
172.16.0.206  mol-dev.uniacc.cl
```

No añadir `127.0.0.1 mol-dev.uniacc.cl` en el servidor si el DNS público ya resuelve al host (rompe HTTPS vía nginx).

- URL principal: `https://mol-dev.uniacc.cl/`
- Debug: `http://mol-dev.uniacc.cl:9080/`

---

## CORS (uniacc-api)

Orígenes browser: `https://mol-dev.uniacc.cl` (principal) y `http://mol-dev.uniacc.cl:9080` (debug).

Deben estar en `CORS_ORIGIN` de `/opt/uniacc-api-docker/.env` (y recrear `uniacc-api`). Auth API usa CORS abierto — sin cambio.

---

## Checklist despliegue

1. [ ] `.env` presente; `VITE_API_URL=` vacío; `REMATRICULA_API_KEY` set
2. [ ] `package-lock.json` sin `@uniacc/autenticacion` (`npm install`)
3. [ ] `traefik_default` up; `autenticacion-api` + `uniacc-api` healthy
4. [ ] CORS incluye `https://mol-dev.uniacc.cl` y `http://mol-dev.uniacc.cl:9080`
5. [ ] Nginx host habilitado + `nginx -t` + reload
6. [ ] `docker compose up -d --build --force-recreate`
7. [ ] `https://mol-dev.uniacc.cl/mol-health` → `OK`; `/` → HTML 200 (title rematrícula)
8. [ ] `./scripts/stop-legacy-pm2.sh` si se abandona `:9501` PM2
9. [ ] Hosts en cliente LAN: `mol-dev.uniacc.cl` → IP del server (sin override 127.0.0.1 en el server)

---

## Relación con rematricula-online

| Ítem | Valor |
| --- | --- |
| Código activo | `/opt/mol-docker` |
| Legacy | `/opt/rematricula-online` (referencia / PM2 opcional) |
| Mapa global | `/opt/rematricula-online/docs/legacy-docker-map.md` |
| Puertos | `/opt/rematricula-online/docs/ports.md` |
