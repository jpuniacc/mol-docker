-- Periodo académico activo para rematrícula (cabecera, Plan de pagos, mantenedor DVU/TI).

CREATE TABLE IF NOT EXISTS public.tp_periodo_activo (
    id serial PRIMARY KEY,
    anio_periodo integer NOT NULL,
    semestre_periodo integer NOT NULL CHECK (semestre_periodo IN (1, 2)),
    created_at timestamptz NOT NULL DEFAULT now(),
    estado boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tp_periodo_activo_anio_sem
    ON public.tp_periodo_activo (anio_periodo, semestre_periodo);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tp_periodo_activo_unico_activo
    ON public.tp_periodo_activo ((true)) WHERE estado IS TRUE;

COMMENT ON TABLE public.tp_periodo_activo IS
    'Periodos académicos disponibles; exactamente uno con estado=true define el ciclo activo de rematrícula.';

ALTER TABLE public.tp_periodo_activo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_periodo_activo_select ON public.tp_periodo_activo;
CREATE POLICY tp_periodo_activo_select ON public.tp_periodo_activo
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_periodo_activo_insert ON public.tp_periodo_activo;
CREATE POLICY tp_periodo_activo_insert ON public.tp_periodo_activo
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS tp_periodo_activo_update ON public.tp_periodo_activo;
CREATE POLICY tp_periodo_activo_update ON public.tp_periodo_activo
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tp_periodo_activo_delete ON public.tp_periodo_activo;
CREATE POLICY tp_periodo_activo_delete ON public.tp_periodo_activo
    FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tp_periodo_activo TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tp_periodo_activo_id_seq TO anon, authenticated, service_role;

INSERT INTO public.tp_periodo_activo (id, anio_periodo, semestre_periodo, created_at, estado)
VALUES
    (1, 2026, 2, '2026-06-25'::timestamptz, true),
    (2, 2027, 1, '2026-06-25'::timestamptz, false),
    (3, 2027, 2, '2026-06-25'::timestamptz, false)
ON CONFLICT (id) DO UPDATE SET
    anio_periodo = EXCLUDED.anio_periodo,
    semestre_periodo = EXCLUDED.semestre_periodo,
    estado = EXCLUDED.estado;

SELECT setval(
    pg_get_serial_sequence('public.tp_periodo_activo', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.tp_periodo_activo), 1)
);

CREATE OR REPLACE FUNCTION public.activar_tp_periodo_activo(p_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.tp_periodo_activo WHERE id = p_id) THEN
        RAISE EXCEPTION 'Periodo con id % no existe', p_id;
    END IF;

    UPDATE public.tp_periodo_activo SET estado = false WHERE estado IS TRUE;
    UPDATE public.tp_periodo_activo SET estado = true WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.activar_tp_periodo_activo(integer) IS
    'Desactiva todos los periodos y activa el indicado (atómico).';

GRANT EXECUTE ON FUNCTION public.activar_tp_periodo_activo(integer) TO anon, authenticated, service_role;
