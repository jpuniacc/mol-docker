# Ramas Git — repos Docker UNIACC

Modelo de ramas (todos los repos en `/opt/*-docker`):

| Rama | Uso |
| --- | --- |
| `main` / `master` | Línea de producción desplegada en servidor |
| `dev` | Desarrollo activo |
| `QA` | Integración QA — **merge de `dev` → `QA`** antes de promover a prod |

## Crear / actualizar ramas

```bash
cd /opt/autenticacion-uniacc-api-docker
chmod +x scripts/setup-git-branches-dev-qa.sh
./scripts/setup-git-branches-dev-qa.sh           # todos los docker
./scripts/setup-git-branches-dev-qa.sh --push  # + push origin dev QA
```

Un solo repo:

```bash
./scripts/setup-git-branches-dev-qa.sh /opt/integracion-umas-docker --push
```

## Flujo de trabajo

```bash
# 1. Trabajar en dev
git checkout dev
git pull origin dev
# ... commits ...
git push origin dev

# 2. Integrar a QA
./scripts/setup-git-branches-dev-qa.sh /opt/mi-repo-docker
# o manualmente:
git checkout QA && git merge dev && git push origin QA

# 3. Producción (main/master) — tras validar QA
git checkout main   # o master
git merge QA
git push origin main
```

## Estado por repo (referencia)

| Repo | Prod | dev | QA |
| --- | --- | --- | --- |
| uniacc-api-docker | master | sí | merge desde dev |
| autenticacion-uniacc-api-docker | master | sí | merge desde dev |
| ldap-autenticacion-docker | master | sí | merge desde dev |
| integracion-umas-docker | main | sí | merge desde dev |
| uniacc-dashboard-admision-docker | main | sí | merge desde dev |

## Push vía SSH (work remote)

```bash
./scripts/uniacc-git-remote-push-work.sh
```

Pushea `dev`, `QA` y `main`/`master` en cada repo docker.
