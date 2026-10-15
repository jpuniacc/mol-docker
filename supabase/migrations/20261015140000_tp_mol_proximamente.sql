-- Pantalla pública Próximamente. Una fila. La editan DVU y TI desde el mantenedor.

CREATE TABLE IF NOT EXISTS public.tp_mol_proximamente (
    id integer PRIMARY KEY CHECK (id = 1),
    activo boolean NOT NULL DEFAULT false,
    mensaje text NOT NULL,
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tp_mol_proximamente_mensaje_chk CHECK (char_length(btrim(mensaje)) > 0)
);

COMMENT ON TABLE public.tp_mol_proximamente IS
    'Interruptor y mensaje de la pantalla Próximamente, antes del login de MOL.';

CREATE OR REPLACE FUNCTION public.tp_mol_proximamente_touch_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_tp_mol_proximamente_actualizado_en ON public.tp_mol_proximamente;
CREATE TRIGGER tr_tp_mol_proximamente_actualizado_en
    BEFORE UPDATE ON public.tp_mol_proximamente
    FOR EACH ROW
    EXECUTE FUNCTION public.tp_mol_proximamente_touch_actualizado_en();

ALTER TABLE public.tp_mol_proximamente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_mol_proximamente_select ON public.tp_mol_proximamente;
CREATE POLICY tp_mol_proximamente_select ON public.tp_mol_proximamente
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_mol_proximamente_update ON public.tp_mol_proximamente;
CREATE POLICY tp_mol_proximamente_update ON public.tp_mol_proximamente
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.tp_mol_proximamente TO anon, authenticated, service_role;

INSERT INTO public.tp_mol_proximamente (id, activo, mensaje)
VALUES (
    1,
    false,
    'El proceso de rematrícula estará disponible próximamente. Cuando se habilite, podrás ingresar con tu usuario y contraseña habituales.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo)
VALUES (
    'b0000001-0001-4000-8000-000000000047',
    'b0000001-0001-4000-8000-000000000024',
    'link',
    'Próximamente',
    'dashboard-mantenedor-proximamente',
    'Hand',
    47,
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
VALUES ('b0000001-0001-4000-8000-000000000047', 1)
ON CONFLICT (menu_item_id, codigo_grupo) DO NOTHING;

DELETE FROM public.bo_menu_item_grupo
WHERE menu_item_id = 'b0000001-0001-4000-8000-000000000047'
  AND codigo_grupo = 2;

NOTIFY pgrst, 'reload schema';
