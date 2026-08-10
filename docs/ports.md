# Inventario de puertos del servidor

Fecha de revision: 2026-06-23

Este inventario resume los puertos encontrados en archivos de configuracion bajo
`/opt` y en revisiones de solo lectura realizadas desde Cursor. La inspeccion en
vivo con `ss` desde la sesion de Cursor no mostro todos los servicios del host,
probablemente por aislamiento/sandbox, por lo que este documento debe tomarse
como inventario de configuracion y no como auditoria runtime definitiva.

## Puertos principales

| Puerto | Servicio / uso | Fuente | Docker activo | Legacy detenido | Notas |
| --- | --- | --- | --- | --- | --- |
| `3001` | `uniacc-api` (interno Docker) | `/opt/uniacc-api-docker/docker-compose.yml` | Sí | PM2 `uniacc-api` | Puerto del contenedor; no publicado al host. Acceso: `9080/api/*`. |
| `3002` | Fallback `uniacc-api` | `/opt/uniacc-api-docker/src/index.ts` | — | — | Si falta `PORT` en `.env`. |
| `9080` | Traefik HTTP | `/opt/traefik-docker/docker-compose.yml` | Sí | — | Gateway único: `http://IP:9080/api/*`, `http://IP:9080/api/auth`. |
| `8000` | Supabase Kong HTTP | `/opt/supabase/.env` | Sí | — | Frontends host y `host.docker.internal` desde contenedores. |
| `8443` | Supabase Kong HTTPS | `/opt/supabase/.env` | Sí | — | Variable `KONG_HTTPS_PORT`. |
| `8055` | Directus | `/opt/directus/docker-compose.yml` | Sí | — | Puerto expuesto por Directus. |
| `9500` | LDAP auth service | `/opt/ldap-autenticacion-docker/docker-compose.yml` | Sí | PM2 `ldap-autenticacion` | Solo red `auth_internal`; sin puerto host. |
| `9501` | Frontend `rematricula-online` | `/opt/rematricula-online/vite.config.ts` | — | **Activo** (PM2) | En `CORS_ORIGIN` de uniacc-api-docker. API vía `9080`. |
| `4173` | Dashboard admisión (Docker) | `/opt/uniacc-dashboard-admision-docker/docker-compose.yml` | Sí | PM2 `uniacc-frontend` | nginx `:443` → `:4173`. API vía `9080`. |
| `9502` | API autenticación | `/opt/autenticacion-uniacc-api-docker/docker-compose.yml` | Sí | PM2 `autenticacion-uniacc` | Debug directo; frontends usan `9080/api/auth`. |
| `9444` | Traefik HTTPS | `/opt/traefik-docker/docker-compose.yml` | Sí | — | Host `9444` → contenedor `443`. |
| `8080` | Traefik dashboard | `/opt/traefik-docker/docker-compose.yml` | Sí | — | Panel admin en `http://IP:8080/dashboard/`. |

### CORS (uniacc-api-docker)

Orígenes permitidos en dev 206 (`/opt/uniacc-api-docker/.env`):

```env
CORS_ORIGIN=http://172.16.0.206:9501,http://172.16.0.206:4173,https://postulantes.uniacc.cl
```

Necesario porque rematrícula (`:9501`) y dashboard (`:4173` / `postulantes.uniacc.cl`) llaman a `9080/api/*` desde el navegador.

## Bases de datos y servicios internos

| Puerto | Servicio / uso | Fuente | Notas |
| --- | --- | --- | --- |
| `5968` | Postgres de Directus expuesto al host | `/opt/directus/docker-compose.yml` | Mapeo `5968:5432`. |
| `5432` | Postgres interno/default | Configs de Supabase, Directus y `uniacc-api` | Puerto Postgres estandar. |
| `54322` | Postgres/Supabase pool o acceso desde host | `/opt/supabase/.env`, `/opt/uniacc-api-docker/.env`, `/opt/integracion-umas-docker/.env` | Usado para integraciones con Supabase/Postgres. Legacy: `/opt/integracion_umas/.env`. |
| `6543` | Supabase pooler transaction | `/opt/supabase/.env` | Variable `POOLER_PROXY_PORT_TRANSACTION`. |
| `1433` | SQL Server externo/integraciones | `/opt/uniacc-api-docker/.env`, `/opt/integracion-umas-docker/.env` | Puerto SQL Server. Legacy ETL: `/opt/integracion_umas/.env`. |

## ETL integracion_umas (sin puerto HTTP)

| Modo | Programación | Fuente |
| --- | --- | --- |
| **Docker (producción)** | supercronic 04:00 en contenedor `integracion-umas-scheduler` | `/opt/integracion-umas-docker/docker-compose.yml`, `cron/etl.crontab` |
| **Legacy** | cron host → `/opt/integracion_umas/scripts/run_sync_cron.sh` | Desactivar al migrar a Docker |

## SMTP y correo

| Puerto | Servicio / uso | Fuente | Notas |
| --- | --- | --- | --- |
| `25` | SMTP usado por `uniacc-api` | `/opt/uniacc-api/.env` | Puerto SMTP configurado. |
| `587` | SMTP TX fallback | `/opt/uniacc-api/src/services/email.service.ts` | Fallback de envio autenticado/TLS. |
| `2500` | SMTP local/dev de Supabase | `/opt/supabase/.env`, `/opt/supabase/dev/docker-compose.dev.yml` | Usado por stack local/dev. |

## Puertos reservados o recomendados

| Puerto | Uso recomendado | Motivo |
| --- | --- | --- |
| `9510` | WordPress | Evita el bloque `9500-9502`, ya usado por LDAP, frontend rematricula y API autenticacion. |

Ejemplo de publicacion Docker recomendada para WordPress:

```yaml
ports:
  - "9510:80"
```

## Puertos del host reservados por nginx

| Puerto | Servicio / uso | Fuente | Notas |
| --- | --- | --- | --- |
| `80` | nginx HTTP | `/etc/nginx/sites-enabled/uniacc-dashboard` | Redirige a HTTPS. |
| `443` | nginx HTTPS | `/etc/nginx/sites-enabled/uniacc-dashboard` | Proxy a `uniacc-dashboard-admision-docker` en `4173`. |

Traefik no puede usar `80`/`443` del host mientras nginx este activo. En desarrollo
usa `9080`/`9444` como alternativa.

## Puertos que conviene evitar para nuevos servicios

- `80` y `443`: ocupados por nginx en el host.
- `9500`: LDAP (solo Docker interno en `ldap-autenticacion-docker`).
- `9501`: ocupado/referenciado por `rematricula-online`.
- `9502`: ocupado por `autenticacion-uniacc-api-docker` (Docker).
- `9443`: libre.
- `8000` y `8443`: ocupados por Supabase/Kong.
- `8055`: ocupado por Directus.
- `54322`, `5968` y `6543`: asociados a bases de datos/Supabase.

## Comandos para validacion runtime

Ejecutar desde una terminal real del servidor, fuera del sandbox de Cursor:

```bash
sudo ss -tulpen
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
sudo lsof -nP -iTCP -sTCP:LISTEN
```

## Decision actual para WordPress

Usar `9510` como puerto publico del contenedor WordPress:

```text
http://IP_DEL_SERVIDOR:9510
```
