-- Restaura «Gestión de firmas»: el id ...000041 pasó a KPI rematrícula
-- (20260915140000) y dejó sin ítem de menú a dashboard-gestion-firmas,
-- por lo que el guard redirigía a dashboard-home.

INSERT INTO public.bo_menu_item (
  id, parent_id, tipo, label, route_name, icon_key, orden, activo
) VALUES (
  'b0000001-0001-4000-8000-000000000043',
  'b0000001-0001-4000-8000-000000000020',
  'link',
  'Gestión de firmas',
  'dashboard-gestion-firmas',
  'PenLine',
  28,
  true
) ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  tipo = EXCLUDED.tipo,
  label = EXCLUDED.label,
  route_name = EXCLUDED.route_name,
  icon_key = EXCLUDED.icon_key,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
VALUES ('b0000001-0001-4000-8000-000000000043', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
