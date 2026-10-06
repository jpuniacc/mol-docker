-- El flujo mock de rematrícula queda fuera del menú.

UPDATE public.bo_menu_item
SET activo = false,
    updated_at = now()
WHERE id = 'b0000001-0001-4000-8000-000000000002'
   OR route_name IN ('matricula-mock-datos', 'matricula-mock-seleccion-alumno');

DELETE FROM public.bo_menu_item_grupo
WHERE menu_item_id = 'b0000001-0001-4000-8000-000000000002';
