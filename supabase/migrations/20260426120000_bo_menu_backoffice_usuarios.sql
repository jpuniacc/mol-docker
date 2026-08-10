-- Enlace «Mantenedor de usuarios» bajo el grupo Backoffice (solo TI por regla actual, sin bo_menu_item_grupo).

insert into public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo) values
  (
    'b0000001-0001-4000-8000-000000000050',
    'b0000001-0001-4000-8000-000000000040',
    'link',
    'Mantenedor de usuarios',
    'dashboard-backoffice-usuarios',
    'Users',
    20,
    true
  )
on conflict (id) do nothing;
