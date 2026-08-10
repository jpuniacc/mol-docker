# Mapa carpetas legacy ↔ Docker

Fecha de revisión: 2026-06-23

Tabla de referencia para analizar la migración de `/opt` en `devsclapp1`: qué carpeta legacy
corresponde a cada repo Docker, qué está en producción y qué convivencia hay entre ambas.

## Mapeo principal

| Servicio | Carpeta legacy | Carpeta Docker | Producción actual | Tipo | Acceso / puerto | Traefik | Script sync `.env` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API postulantes / OTP / firma | [`/opt/uniacc-api`](/opt/uniacc-api) | [`/opt/uniacc-api-docker`](/opt/uniacc-api-docker) | **Docker** | API HTTP (Node) | Interno `:3001` · `http://IP:9080/api/*` | Sí · `PathPrefix(/api)` | Manual / `.env.docker.example` |
| API autenticación (Pixarron, clientes) | [`/opt/autenticacion_uniacc`](/opt/autenticacion_uniacc) | [`/opt/autenticacion-uniacc-api-docker`](/opt/autenticacion-uniacc-api-docker) | **Docker** | API HTTP (Node) | Host `:9502` · `http://IP:9080/api/auth` | Sí · priority 100 | [`sync-env-from-shared.sh`](/opt/autenticacion-uniacc-api-docker/scripts/sync-env-from-shared.sh) |
| Servicio LDAP (bridge AD) | [`/opt/ldap-autenticacion`](/opt/ldap-autenticacion) | [`/opt/ldap-autenticacion-docker`](/opt/ldap-autenticacion-docker) | **Docker** | API HTTP interna | `:9500` solo red `auth_internal` | No | [`sync-env-from-shared.sh`](/opt/ldap-autenticacion-docker/scripts/sync-env-from-shared.sh) (auth repo) |
| ETL ERP → Supabase (`mnp_*`) | [`/opt/integracion_umas`](/opt/integracion_umas) | [`/opt/integracion-umas-docker`](/opt/integracion-umas-docker) | **Docker** | Batch Python (sin HTTP) | Scheduler 04:00 (supercronic) | No | [`sync-env-from-legacy.sh`](/opt/integracion-umas-docker/scripts/sync-env-from-legacy.sh) |
| Frontend rematrícula | [`/opt/rematricula-online`](/opt/rematricula-online) | — *(pendiente)* | **Host** (Vite/PM2) | Frontend Vue | `:9501` | No | `.env` local |
| Dashboard admisión | [`/opt/Uniacc-dashboard-admision`](/opt/Uniacc-dashboard-admision) | [`/opt/uniacc-dashboard-admision-docker`](/opt/uniacc-dashboard-admision-docker) | **Docker** | Frontend Vue (nginx) | nginx `:443` → `:4173` | No (nginx host) | [`sync-env-from-legacy.sh`](/opt/uniacc-dashboard-admision-docker/scripts/sync-env-from-legacy.sh) |
| Stack Supabase / Postgres | [`/opt/supabase`](/opt/supabase) | *(mismo repo)* | **Docker** nativo | Infra BD | `:54322` pool · `:8000` Kong | Parcial | `/opt/supabase/.env` |
| Reverse proxy dev | [`/opt/traefik-docker`](/opt/traefik-docker) | *(mismo repo)* | **Docker** nativo | Proxy | `:9080` HTTP · `:9444` HTTPS | — | `/opt/traefik-docker/.env` |

## Eliminados / obsoletos

| Carpeta | Estado | Reemplazo |
| --- | --- | --- |
| `/opt/autenticacion-uniacc-api` | **Eliminado** (monolito auth+LDAP en un compose) | `ldap-autenticacion-docker` + `autenticacion-uniacc-api-docker` |

## Matriz de convivencia (reglas)

| Par legacy + Docker | ¿Pueden correr a la vez? | Riesgo si conviven |
| --- | --- | --- |
| `uniacc-api` + `uniacc-api-docker` | No en el mismo puerto | PM2 legacy en `:3001` vs contenedor |
| `autenticacion_uniacc` + `autenticacion-uniacc-api-docker` | No en `:9502` | Doble API auth |
| `ldap-autenticacion` + `ldap-autenticacion-docker` | No en `:9500` | Doble LDAP bridge |
| `integracion_umas` + `integracion-umas-docker` | No a las 04:00 | **Doble ETL** (cron host + supercronic) — cron legacy desactivado 2026-06-22 |
| `Uniacc-dashboard-admision` + `uniacc-dashboard-admision-docker` | No en `:4173` | PM2 `uniacc-frontend` vs contenedor nginx |

## Postgres / SQL Server desde contenedor

| Servicio Docker | Host legacy en `.env` | Host dentro del contenedor |
| --- | --- | --- |
| `uniacc-api-docker` | `127.0.0.1` / `localhost` | `host.docker.internal` (override en compose) |
| `autenticacion-uniacc-api-docker` | Supabase URL host | `host.docker.internal` |
| `integracion-umas-docker` | `127.0.0.1:54322` o `DB_HOST=127.0.0.1` | `host.docker.internal` (override en compose) |
| Todos (SQL Server ERP) | IP institucional (`192.168.x.x`) | **Misma IP** (sin override) |

## Documentación por par

| Par | Legacy | Docker |
| --- | --- | --- |
| API | [`uniacc-api/docs/dockerizacion.md`](/opt/uniacc-api/docs/dockerizacion.md) | [`uniacc-api-docker/docs/ai.md`](/opt/uniacc-api-docker/docs/ai.md) |
| Auth | [`autenticacion_uniacc`](/opt/autenticacion_uniacc) (`.env.shared`) | [`autenticacion-uniacc-api-docker/docs/ai.md`](/opt/autenticacion-uniacc-api-docker/docs/ai.md) |
| LDAP | [`ldap-autenticacion/docs/ai.md`](/opt/ldap-autenticacion/docs/ai.md) | [`ldap-autenticacion-docker/docs/ai.md`](/opt/ldap-autenticacion-docker/docs/ai.md) |
| ETL UMAS | [`integracion_umas/LEGACY.md`](/opt/integracion_umas/LEGACY.md) | [`integracion-umas-docker/docs/ai.md`](/opt/integracion-umas-docker/docs/ai.md) |
| Dashboard | [`Uniacc-dashboard-admision/LEGACY.md`](/opt/Uniacc-dashboard-admision/LEGACY.md) | [`uniacc-dashboard-admision-docker/docs/ai.md`](/opt/uniacc-dashboard-admision-docker/docs/ai.md) |
| Proxy / rutas | — | [`traefik/docs/ai.md`](/opt/traefik-docker/docs/ai.md) |
| Puertos servidor | — | [`rematricula-online/docs/ports.md`](/opt/rematricula-online/docs/ports.md) |
| Ramas git docker | — | [`rematricula-online/docs/git-branches-docker.md`](/opt/rematricula-online/docs/git-branches-docker.md) |

## Pendiente de dockerizar

| Carpeta | Notas |
| --- | --- |
| `rematricula-online` | Front Vue; depende de auth-docker (`file:../autenticacion-uniacc-api-docker`) |

## Estado objetivo dev 206 (2026-06-23)

Backends **solo Docker**. Frontends activos: dashboard Docker (`:4173` → nginx `:443`) y rematrícula legacy (`:9501` PM2). APIs consumidas vía **`http://172.16.0.206:9080`** (Traefik).

### PM2 legacy detenidos (no levantar en dev)

| Proceso PM2 | Puerto | Reemplazo Docker |
| --- | --- | --- |
| `uniacc-api` | `:3001` | `uniacc-api-docker` (interno, Traefik `9080/api/*`) |
| `autenticacion-uniacc` | `:9502` | `autenticacion-uniacc-api-docker` (Traefik `9080/api/auth`) |
| `ldap-autenticacion` | `:9500` | `ldap-autenticacion-docker` (red `auth_internal`) |
| `uniacc-frontend` | `:4173` | `uniacc-dashboard-admision-docker` |

Permanece activo: `rematricula-online` en `:9501`.

### Comunicación entre servicios

| Origen | Destino | URL / mecanismo |
| --- | --- | --- |
| Browser (`:9501`, `:4173`) | uniacc-api | `http://172.16.0.206:9080/api/*` |
| Browser / proxy Vite | autenticación | `http://172.16.0.206:9080/api/auth` |
| autenticacion-api | LDAP | `http://ldap-autenticacion:9500` (red `auth_internal`) |
| autenticacion-api | Supabase | `http://host.docker.internal:8000` |
| uniacc-api / ETL | Postgres | `host.docker.internal:54322` |

### Valores `.env` canónicos (dev 206)

**uniacc-api-docker** — CORS para ambos frontends:

```env
CORS_ORIGIN=http://172.16.0.206:9501,http://172.16.0.206:4173,https://postulantes.uniacc.cl
```

**autenticacion-uniacc-api-docker** (compose también override en runtime):

```env
LDAP_SERVICE_URL=http://ldap-autenticacion:9500
VITE_SUPABASE_URL=http://host.docker.internal:8000
```

**uniacc-dashboard-admision-docker** (build-time; rebuild obligatorio):

```env
VITE_API_URL=http://172.16.0.206:9080
VITE_SUPABASE_URL=https://lxdvlysoiixkrunlzruf.supabase.co
```

**rematricula-online** (host):

```env
VITE_API_URL=http://172.16.0.206:9080
AUTH_API_URL=http://172.16.0.206:9080
VITE_SUPABASE_URL=http://172.16.0.206:8000
```

### Health checks

```bash
curl -s http://172.16.0.206:9080/api/health
curl -s http://172.16.0.206:9080/health
curl -sk -o /dev/null -w '%{http_code}' https://postulantes.uniacc.cl
curl -s -o /dev/null -w '%{http_code}' http://172.16.0.206:9501
```
