# Sync cartera → TEST_UNIACC

Ver procedimiento en el repo ETL:

[`/opt/integracion-umas-docker/docs/sync-cartera-prod-to-test.md`](/opt/integracion-umas-docker/docs/sync-cartera-prod-to-test.md)

```bash
cd /opt/integracion-umas-docker
./scripts/run_sync_cartera_prod_to_test.sh --dry-run --only MT_CLIENT
./scripts/run_sync_cartera_prod_to_test.sh --only MT_CLIENT
./scripts/run_sync_cartera_prod_to_test.sh
./scripts/run_sync_cartera_prod_to_test.sh --verify-only
```

Puebla `TEST_UNIACC` (SPs on-demand MOL), con upsert de `MT_CLIENT` en columnas de contacto (`FONOACT`/`MAIL`) + flags deuda. No reemplaza el ETL → Postgres.

Si `tempdb` TEST está lleno (error 1101/3958), el sync masivo falla: liberar espacio o reintentar más tarde; dry-run y compare SELECT siguen sirviendo para validar paridad.

Tras sync con badge `ERP SP: TEST`, probar contacto: `POST /api/rematricula/contacto/actualizar-datos-erp` o `EXEC SP_ACTUALIZA_DATOS_MOL` con un CODCLI de cartera (sin DV, p. ej. `15459973`).
