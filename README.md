# mol-docker

Frontend Vue de rematrícula / matrícula online (migración Docker de `/opt/rematricula-online`).

## Acceso

- **URL principal:** `https://mol-dev.uniacc.cl/` (nginx host `:443` → Traefik `:9080`)
- Certificados wildcard nginx: `/opt/Uniacc-dashboard-admision/certificados/uniacc_cl.{crt,key}`
- Sitio nginx: `/etc/nginx/sites-available/mol-dev.uniacc.cl`
- **Debug (sin TLS):** `http://mol-dev.uniacc.cl:9080/` — Traefik entrypoint `web` (`:9080`), Host `mol-dev.uniacc.cl`
- En LAN sin DNS, añadir a `/etc/hosts`: `172.16.0.206 mol-dev.uniacc.cl` (no usar `127.0.0.1` en el servidor si hay DNS público)

## Requisitos

- Red Docker externa `traefik_default`
- Contenedores `autenticacion-api` y `uniacc-api` en esa red
- Archivo `.env` (ver `.env.docker.example`)

```bash
cp /opt/rematricula-online/.env .env
# Dejar VITE_API_URL vacío (same-origin vía nginx)
```

## Producción

```bash
cd /opt/mol-docker
docker compose up -d --build --force-recreate
curl -sk https://mol-dev.uniacc.cl/mol-health
# Debug directo Traefik:
curl -sS -H 'Host: mol-dev.uniacc.cl' http://127.0.0.1:9080/mol-health
```

`VITE_*` se aplican en **build**. Cambios → rebuild.

## Desarrollo (Vite :9501)

```bash
./scripts/stop-legacy-pm2.sh   # libera :9501 si PM2 legacy está up
docker compose -f docker-compose.dev.yml up -d --build
```

## Proxy API

Nginx del contenedor:

- `/api/auth` → `autenticacion-api:9502` (+ `X-API-Key` = `REMATRICULA_API_KEY`)
- `/api/` → `uniacc-api:3001`

## Docs

Más detalle: [`docs/ai.md`](docs/ai.md).

## Supabase

`VITE_SUPABASE_URL=https://supabase-dev.uniacc.cl` (nginx + wildcard → Traefik → Kong).

Requiere DNS `supabase-dev.uniacc.cl` → IP del server. No usar `http://…:8000` (Mixed Content) ni `https://…:8443` (cert autofirmado).

Manual gateway / QA-Prod: [`/opt/traefik-docker/docs/MANUAL.md`](/opt/traefik-docker/docs/MANUAL.md) (Partes 8 y 11).
