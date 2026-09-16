# Sync cartera → TEST_UNIACC

Ver procedimiento en el repo ETL:

[`/opt/integracion-umas-docker/docs/sync-cartera-prod-to-test.md`](/opt/integracion-umas-docker/docs/sync-cartera-prod-to-test.md)

```bash
cd /opt/integracion-umas-docker
./scripts/run_sync_cartera_prod_to_test.sh --dry-run
./scripts/run_sync_cartera_prod_to_test.sh
./scripts/run_sync_cartera_prod_to_test.sh --verify-only
```

Puebla `TEST_UNIACC` (SPs on-demand MOL). No reemplaza el ETL → Postgres.
