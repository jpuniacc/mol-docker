# Go-live MOL Prod (sin E2E alumno)

Estado operativo en `uniacc-mol` cuando no hay recorrido completo de alumno.

## Qué está en producción

| Pieza | Valor |
|---|---|
| Host | `https://mol.uniacc.cl` |
| Webpay | `WEBPAY_PLUS_AMBIENTE=produccion` · comercio `597053102249` |
| TuFirma | `https://api.aws.prod.tufirma.digital/api` · key live |
| U+ ERP SP activo | `prod` → `UNIACC` @ `192.168.135.20` |
| `MOL_PUBLIC_URL` | `https://mol.uniacc.cl` |
| Caja MOL | `997` · usuario Prod `68678` · Test `69065` |

## Checklist sin alumno

1. **Backoffice (lectura):** Gestión de firmas, Mantenedor ERP SP (prod activo), Casos, KPI.
2. **Avisos:** outbox activo; CTAs usan `MOL_PUBLIC_URL`. OTP CC solo `mol@uniacc.cl`. Apoderado desactualizado → ejecutivo + CC `mol@`.
3. **Ping dry:** ambiente activo = prod + preflight de un RUT de cartera (ej. `20199851-4` / `TEAT1VR`) sin grabar.
4. **Caja 997:** fila del día con `ABIERTA=S` y usuario `68678` (cron 00:00 Chile + al arrancar API).
5. **Rollback escrito** (abajo).

## Riesgo asumido sin E2E

No validado de punta a punta: retorno Webpay en rematrícula, firma con mails reales, `sp_mol_grabar_plan_pagos` / cierre de ficha. Cerrar con el **primer alumno acompañado**.

## Rollback rápido (uniacc-mol)

Todo en el host `uniacc-mol`, API en `/opt/mol-docker/uniacc-api-docker`.

### 1) Volver ERP SP a Test

```bash
docker exec uniacc-api node --input-type=module -e '
import { querySupabase } from "./dist/config/postgres-supabase.js";
import { invalidateErpSpAmbienteCache } from "./dist/services/erp-sp-ambiente.service.js";
await querySupabase("SELECT public.activar_tp_mnp_erp_sp_ambiente($1)", ["test"]);
invalidateErpSpAmbienteCache();
console.log("ERP SP → test");
'
```

### 2) Restaurar `.env` (Webpay / TuFirma / URL)

Backups recientes en el mismo directorio:

- `.env.bak-webpay-prod-*`
- `.env.bak-tufirma-prod-*`
- `.env.bak-mol-public-*`

```bash
cd /opt/mol-docker/uniacc-api-docker
# ejemplo: volver al backup previo al corte Webpay
cp .env.bak-webpay-prod-YYYYMMDDHHMMSS .env
docker compose up -d --force-recreate uniacc-api
```

Elegir el `.bak` según qué quieras revertir (o combinar a mano las claves).

### 3) Confirmar

```bash
docker exec uniacc-api node -e 'console.log({
  webpay: process.env.WEBPAY_PLUS_AMBIENTE,
  tufirma: process.env.TU_FIRMA_BASE_URL,
  mol: process.env.MOL_PUBLIC_URL,
})'
```

## Smoke dry (a mano)

```bash
docker exec uniacc-api node --input-type=module -e '
import { resolveAmbienteActivo, invalidateErpSpAmbienteCache } from "./dist/services/erp-sp-ambiente.service.js";
import { matriculaFlujoPreflightService } from "./dist/services/matricula-flujo-preflight.service.js";
invalidateErpSpAmbienteCache();
console.log(await resolveAmbienteActivo());
console.log(await matriculaFlujoPreflightService.consultar({ rut: "20199851-4", codCarr: "TEAT1VR" }));
'
```
