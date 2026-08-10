-- Plan de pagos reemplazado por Mantenedores → Alumnos a matricular.

UPDATE public.bo_menu_item
SET activo = false,
    updated_at = now()
WHERE id = 'b0000001-0001-4000-8000-000000000023'
   OR route_name = 'dashboard-plan-de-pagos';

DELETE FROM public.bo_menu_item_grupo
WHERE menu_item_id = 'b0000001-0001-4000-8000-000000000023';
