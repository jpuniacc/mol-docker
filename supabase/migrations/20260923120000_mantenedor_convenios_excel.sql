-- Mantenedor Convenios Excel: editar vigente y copiar un periodo (historia).
-- Sin DELETE: la historia no se borra desde la pantalla.

DROP POLICY IF EXISTS mnp_mv_beneficio_periodo_insert ON public.mnp_mv_beneficio_periodo;
CREATE POLICY mnp_mv_beneficio_periodo_insert ON public.mnp_mv_beneficio_periodo
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS mnp_mv_beneficio_periodo_update ON public.mnp_mv_beneficio_periodo;
CREATE POLICY mnp_mv_beneficio_periodo_update ON public.mnp_mv_beneficio_periodo
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

GRANT INSERT, UPDATE ON TABLE public.mnp_mv_beneficio_periodo TO anon, authenticated, service_role;

INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000044',
  'b0000001-0001-4000-8000-000000000024',
  'link',
  'Convenios Excel',
  'dashboard-mantenedor-convenios-excel',
  'FileCheck',
  31,
  true
)
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000044', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
