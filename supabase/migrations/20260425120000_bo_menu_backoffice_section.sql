-- Sección «Backoffice» en el menú lateral: grupo padre + «Mantenedor menú» como hijo.
-- Sin filas en bo_menu_item_grupo → solo TI (grupo 3) ve el bloque, igual que el ítem anterior.

insert into public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo) values
  ('b0000001-0001-4000-8000-000000000040', null, 'group', 'Backoffice', null, 'Briefcase', 45, true)
on conflict (id) do nothing;

update public.bo_menu_item set
  parent_id = 'b0000001-0001-4000-8000-000000000040',
  route_name = 'dashboard-backoffice-menu',
  icon_key = 'Menu',
  orden = 10,
  label = 'Mantenedor menú'
where id = 'b0000001-0001-4000-8000-000000000030';
