-- Ítem «Aranceles ERP» (vista consulta) bajo Mantenedores / Rematrícula

INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
  'b0000001-0001-4000-8000-000000000029',
  'b0000001-0001-4000-8000-000000000024',
  'link',
  'Aranceles ERP',
  'dashboard-vista-aranceles-erp',
  'DollarSign',
  25,
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
VALUES ('b0000001-0001-4000-8000-000000000029', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;
