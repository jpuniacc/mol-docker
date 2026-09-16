-- Copy MOL: el sitio es solo rematrícula.
-- Renombra ítems de menú visibles y el título de TyC (el cuerpo legal no se reescribe).

UPDATE public.bo_menu_item
SET label = 'Mock rematrícula'
WHERE id = 'b0000001-0001-4000-8000-000000000002'
   OR route_name IN ('matricula-mock-datos', 'matricula-mock-seleccion-alumno');

UPDATE public.bo_menu_item
SET label = 'Rematrícula'
WHERE id = 'b0000001-0001-4000-8000-000000000020'
   OR (parent_id IS NULL AND tipo = 'group' AND lower(label) IN ('rematricula', 'rematrícula'));

UPDATE public.tp_terminos_condiciones
SET titulo = 'Términos y Condiciones de Rematrícula Online'
WHERE codigo = 'mol';

UPDATE public.tp_terminos_condiciones
SET contenido_html = replace(
  contenido_html,
  'Portal de Matrícula Online',
  'Portal de Rematrícula Online'
)
WHERE codigo = 'mol';
