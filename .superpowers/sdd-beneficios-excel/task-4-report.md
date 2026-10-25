# Task 4 Report — Script carga Excel → mnp_cartera_beneficios

**Estado:** ✅ Completado  
**Commit:** `feat(beneficios): script carga Excel mnp_cartera_beneficios`

## Entregables

| Archivo | Acción |
|---------|--------|
| `scripts/load_cartera_beneficios.py` | Creado |

## Ejecución (Supabase local, periodo 2027-01)

```
rows=4687 matched1=4041 unmatched1=1 matched2=57 unmatched2=1 upserted=4687 catalog=db(67)
vanessa=('Beneficio Apoyo UNIACC Renovable', '1756', None, None)
```

- Vanessa `20152PSIC1SR039`: `cod_beneficio_1=1756`, `beca_2` null ✅
- Unmatched: `Beca Colaboradores Hijos y Conyuges` (no en catálogo 2027-01)

## Uso

```bash
cd /opt/mol-docker
SUPABASE_PG_URL=... python3 scripts/load_cartera_beneficios.py
# env opcionales: CARTERA_XLSX, CARTERA_PERIODO, BENEFICIOS_CATALOG_CSV
```

## Siguiente

Task 5: API front + FormaPagoMockView.
