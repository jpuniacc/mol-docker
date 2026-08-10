-- Información financiera tipo plan de cuotas (extract 13_informacion_finanzas) + ítem menú Rematricula (solo DVU en bo_menu_item_grupo).

CREATE TABLE IF NOT EXISTS public.mnp_informacion_finanzas (
  codcli text,
  nombre_carrera text,
  nombre_area text,
  modalidad text,
  periodo text,
  rut text,
  nombre_alumno text,
  rut_apoder text,
  nombre_apoderado text,
  mat_primer_ano text,
  monto_matricula numeric,
  monto_arancel numeric,
  cuota_matricula numeric,
  cuota_arancel numeric,
  desc_matricula numeric,
  desc_arancel numeric,
  beca_matricula numeric,
  beca_arancel numeric,
  valor_total_matricula numeric,
  valor_total_arancel numeric,
  pagos_por_mora numeric,
  cuotas_matricula_vencidas numeric,
  monto_matricula_vencidas numeric,
  monto_arancel_vencidas numeric,
  monto_matricula_por_vencer numeric,
  monto_arancel_por_vencer numeric,
  fecha_corte date,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mnp_finanzas_codcli ON public.mnp_informacion_finanzas (codcli);
CREATE INDEX IF NOT EXISTS idx_mnp_finanzas_periodo ON public.mnp_informacion_finanzas (periodo);
CREATE INDEX IF NOT EXISTS idx_mnp_finanzas_rut ON public.mnp_informacion_finanzas (rut);
CREATE INDEX IF NOT EXISTS idx_mnp_finanzas_synced ON public.mnp_informacion_finanzas (synced_at DESC);

COMMENT ON TABLE public.mnp_informacion_finanzas IS 'Información financiera / cuotas (REP_REPORTE_FINANZAS); carga desde ERP. Lectura portal DVU.';

ALTER TABLE public.mnp_informacion_finanzas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mnp_informacion_finanzas_select"
  ON public.mnp_informacion_finanzas FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.mnp_informacion_finanzas TO anon, authenticated, service_role;

-- Plan de pagos bajo grupo Rematricula; visibilidad solo codigo_grupo 1 (DVU).
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo) VALUES
  ('b0000001-0001-4000-8000-000000000023', 'b0000001-0001-4000-8000-000000000020', 'link', 'Plan de pagos', 'dashboard-plan-de-pagos', 'Wallet', 30, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo) VALUES
  ('b0000001-0001-4000-8000-000000000023', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
