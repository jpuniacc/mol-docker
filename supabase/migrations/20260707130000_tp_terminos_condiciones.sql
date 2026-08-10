-- Términos y condiciones MOL (documento único, rich text HTML).

CREATE TABLE IF NOT EXISTS public.tp_terminos_condiciones (
    id serial PRIMARY KEY,
    codigo text NOT NULL UNIQUE,
    titulo text NOT NULL,
    contenido_html text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tp_terminos_condiciones IS
    'Documento de términos y condiciones MOL (matrícula/rematrícula online). Código fijo mol.';

CREATE OR REPLACE FUNCTION public.tp_terminos_condiciones_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_tp_terminos_condiciones_updated_at ON public.tp_terminos_condiciones;
CREATE TRIGGER tr_tp_terminos_condiciones_updated_at
    BEFORE UPDATE ON public.tp_terminos_condiciones
    FOR EACH ROW
    EXECUTE FUNCTION public.tp_terminos_condiciones_touch_updated_at();

ALTER TABLE public.tp_terminos_condiciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_terminos_condiciones_select ON public.tp_terminos_condiciones;
CREATE POLICY tp_terminos_condiciones_select ON public.tp_terminos_condiciones
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_terminos_condiciones_insert ON public.tp_terminos_condiciones;
CREATE POLICY tp_terminos_condiciones_insert ON public.tp_terminos_condiciones
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS tp_terminos_condiciones_update ON public.tp_terminos_condiciones;
CREATE POLICY tp_terminos_condiciones_update ON public.tp_terminos_condiciones
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tp_terminos_condiciones_delete ON public.tp_terminos_condiciones;
CREATE POLICY tp_terminos_condiciones_delete ON public.tp_terminos_condiciones
    FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tp_terminos_condiciones TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tp_terminos_condiciones_id_seq TO anon, authenticated, service_role;
