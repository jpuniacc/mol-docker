-- Menú: agrupa Bandeja y Métricas bajo «Seguimiento rematrícula» (dentro de Rematrícula)
INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES ('b0000001-0001-4000-8000-000000000084', 'b0000001-0001-4000-8000-000000000020', 'group',
        'Seguimiento rematrícula', NULL, 'Inbox', 26, true)
ON CONFLICT (id) DO UPDATE SET parent_id = EXCLUDED.parent_id, tipo = EXCLUDED.tipo, label = EXCLUDED.label,
  route_name = EXCLUDED.route_name, icon_key = EXCLUDED.icon_key, orden = EXCLUDED.orden, activo = EXCLUDED.activo;

UPDATE public.bo_menu_item
   SET parent_id = 'b0000001-0001-4000-8000-000000000084', label = 'Bandeja', icon_key = 'Inbox', orden = 10
 WHERE route_name = 'dashboard-bandeja-seguimiento';

UPDATE public.bo_menu_item
   SET parent_id = 'b0000001-0001-4000-8000-000000000084', label = 'Métricas', icon_key = 'LayoutDashboard', orden = 20
 WHERE route_name = 'dashboard-metricas-seguimiento';

INSERT INTO public.bo_menu_item_grupo (menu_item_id, codigo_grupo)
SELECT 'b0000001-0001-4000-8000-000000000084', g.codigo_grupo
  FROM public.bo_menu_item_grupo g
  JOIN public.bo_menu_item i ON i.id = g.menu_item_id
 WHERE i.route_name IN ('dashboard-bandeja-seguimiento', 'dashboard-metricas-seguimiento')
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
