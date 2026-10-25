### Task 3: Migración SQL + RPC lectura — ✅ Done

**Commit:** `95ade5b` · **Review:** `task-3-report.md` · **Diff:** `.superpowers/sdd/task-3-mnp_cartera_beneficios.diff`

**Entregables:** `supabase/migrations/20260916120000_mnp_cartera_beneficios.sql`, types en `src/types/supabase.ts`

**RPC:** `consultar_cartera_beneficios(p_periodo, p_codcli_excel?, p_rut_norm?)` — codcli preferido; fallback rut; vacío si ambos null.

**Nota review:** agregar `SET search_path = public` al RPC en follow-up opcional.

**Next:** Task 4 — ETL Excel → UPSERT.
