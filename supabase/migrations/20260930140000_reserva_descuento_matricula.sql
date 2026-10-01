-- Reserva del descuento de matrícula para quien queda en espera de CAE o beca ministerial.

ALTER TABLE public.tp_mnp_descuento_matricula_anticipada
    ADD COLUMN IF NOT EXISTS reserva_hasta date;

ALTER TABLE public.tp_mnp_descuento_matricula_anticipada
    DROP CONSTRAINT IF EXISTS tp_mnp_descuento_matricula_anticipada_reserva_hasta_chk;

ALTER TABLE public.tp_mnp_descuento_matricula_anticipada
    ADD CONSTRAINT tp_mnp_descuento_matricula_anticipada_reserva_hasta_chk
    CHECK (reserva_hasta IS NULL OR reserva_hasta >= vigencia_hasta);

COMMENT ON COLUMN public.tp_mnp_descuento_matricula_anticipada.reserva_hasta IS
    'Hasta cuándo (inclusive) se puede usar el monto reservado al quedar en espera. Vacío: no hay reserva.';

CREATE TABLE IF NOT EXISTS public.mnp_resolucion_beca_estatal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codcli text NOT NULL,
    anio_periodo integer NOT NULL,
    semestre_periodo integer NOT NULL,
    resolucion_disponible boolean NOT NULL DEFAULT false,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mnp_resolucion_beca_estatal_codcli_periodo_uniq
        UNIQUE (codcli, anio_periodo, semestre_periodo)
);

COMMENT ON TABLE public.mnp_resolucion_beca_estatal IS
    'Resolución ministerial por codcli y periodo. El equipo la marca en la base, igual que mnp_resolucion_cae.';

ALTER TABLE public.mnp_resolucion_beca_estatal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_resolucion_beca_estatal_no_select_anon ON public.mnp_resolucion_beca_estatal;
CREATE POLICY mnp_resolucion_beca_estatal_no_select_anon ON public.mnp_resolucion_beca_estatal
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS mnp_resolucion_beca_estatal_no_insert_anon ON public.mnp_resolucion_beca_estatal;
CREATE POLICY mnp_resolucion_beca_estatal_no_insert_anon ON public.mnp_resolucion_beca_estatal
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS mnp_resolucion_beca_estatal_no_select_authenticated ON public.mnp_resolucion_beca_estatal;
CREATE POLICY mnp_resolucion_beca_estatal_no_select_authenticated ON public.mnp_resolucion_beca_estatal
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS mnp_resolucion_beca_estatal_no_insert_authenticated ON public.mnp_resolucion_beca_estatal;
CREATE POLICY mnp_resolucion_beca_estatal_no_insert_authenticated ON public.mnp_resolucion_beca_estatal
    FOR INSERT TO authenticated WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.mnp_reserva_descuento_matricula (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codcli text NOT NULL,
    rut_alumno text,
    anio_periodo integer NOT NULL,
    semestre_periodo integer NOT NULL,
    descuento_id integer NOT NULL
        REFERENCES public.tp_mnp_descuento_matricula_anticipada (id),
    cod_beneficio integer NOT NULL,
    nombre text NOT NULL,
    monto_reservado numeric(14, 2) NOT NULL CHECK (monto_reservado > 0),
    motivo text NOT NULL CHECK (motivo IN ('CAE', 'ESTATAL')),
    reservado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mnp_reserva_descuento_matricula_codcli_periodo_uniq
        UNIQUE (codcli, anio_periodo, semestre_periodo)
);

COMMENT ON TABLE public.mnp_reserva_descuento_matricula IS
    'Primera reserva del descuento de matrícula por alumno y periodo. El monto queda congelado.';

ALTER TABLE public.mnp_reserva_descuento_matricula ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mnp_reserva_descuento_matricula_no_select_anon ON public.mnp_reserva_descuento_matricula;
CREATE POLICY mnp_reserva_descuento_matricula_no_select_anon ON public.mnp_reserva_descuento_matricula
    FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS mnp_reserva_descuento_matricula_no_insert_anon ON public.mnp_reserva_descuento_matricula;
CREATE POLICY mnp_reserva_descuento_matricula_no_insert_anon ON public.mnp_reserva_descuento_matricula
    FOR INSERT TO anon WITH CHECK (false);

DROP POLICY IF EXISTS mnp_reserva_descuento_matricula_no_select_authenticated ON public.mnp_reserva_descuento_matricula;
CREATE POLICY mnp_reserva_descuento_matricula_no_select_authenticated ON public.mnp_reserva_descuento_matricula
    FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS mnp_reserva_descuento_matricula_no_insert_authenticated ON public.mnp_reserva_descuento_matricula;
CREATE POLICY mnp_reserva_descuento_matricula_no_insert_authenticated ON public.mnp_reserva_descuento_matricula
    FOR INSERT TO authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.consultar_resolucion_beca_estatal(
    p_codcli text,
    p_anio_periodo integer,
    p_semestre_periodo integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_codcli text := nullif(trim(coalesce(p_codcli, '')), '');
BEGIN
    IF v_codcli IS NULL THEN
        RAISE EXCEPTION 'codcli requerido';
    END IF;
    IF p_anio_periodo IS NULL OR p_semestre_periodo IS NULL THEN
        RAISE EXCEPTION 'anio_periodo y semestre_periodo requeridos';
    END IF;

    RETURN jsonb_build_object(
        'resolucion_disponible',
        EXISTS (
            SELECT 1
            FROM public.mnp_resolucion_beca_estatal
            WHERE codcli = v_codcli
              AND anio_periodo = p_anio_periodo
              AND semestre_periodo = p_semestre_periodo
              AND resolucion_disponible = true
        )
    );
END;
$$;

COMMENT ON FUNCTION public.consultar_resolucion_beca_estatal IS
    'Indica si la beca ministerial del periodo ya tiene resolución para dejar continuar.';

CREATE OR REPLACE FUNCTION public.consultar_reserva_descuento_matricula(
    p_codcli text,
    p_anio_periodo integer,
    p_semestre_periodo integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_codcli text := nullif(trim(coalesce(p_codcli, '')), '');
    v_row record;
BEGIN
    IF v_codcli IS NULL THEN
        RAISE EXCEPTION 'codcli requerido';
    END IF;
    IF p_anio_periodo IS NULL OR p_semestre_periodo IS NULL THEN
        RAISE EXCEPTION 'anio_periodo y semestre_periodo requeridos';
    END IF;

    SELECT
        r.descuento_id,
        r.cod_beneficio,
        r.nombre,
        r.monto_reservado,
        r.motivo,
        d.reserva_hasta
    INTO v_row
    FROM public.mnp_reserva_descuento_matricula r
    JOIN public.tp_mnp_descuento_matricula_anticipada d ON d.id = r.descuento_id
    WHERE r.codcli = v_codcli
      AND r.anio_periodo = p_anio_periodo
      AND r.semestre_periodo = p_semestre_periodo;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('reservado', false);
    END IF;

    RETURN jsonb_build_object(
        'reservado', true,
        'descuento_id', v_row.descuento_id,
        'cod_beneficio', v_row.cod_beneficio,
        'nombre', v_row.nombre,
        'monto', v_row.monto_reservado,
        'reserva_hasta', v_row.reserva_hasta,
        'motivo', v_row.motivo
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reservar_descuento_matricula(
    p_codcli text,
    p_anio_periodo integer,
    p_semestre_periodo integer,
    p_rut_alumno text DEFAULT NULL,
    p_motivo text DEFAULT 'CAE'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_codcli text := nullif(trim(coalesce(p_codcli, '')), '');
    v_motivo text := upper(trim(coalesce(p_motivo, '')));
    v_hoy date := (timezone('America/Santiago', now()))::date;
    v_periodo text;
    v_fila record;
BEGIN
    IF v_codcli IS NULL THEN
        RAISE EXCEPTION 'codcli requerido';
    END IF;
    IF p_anio_periodo IS NULL OR p_semestre_periodo IS NULL THEN
        RAISE EXCEPTION 'anio_periodo y semestre_periodo requeridos';
    END IF;
    IF v_motivo NOT IN ('CAE', 'ESTATAL') THEN
        RAISE EXCEPTION 'motivo inválido';
    END IF;

    v_periodo := p_anio_periodo::text || '-' || p_semestre_periodo::text;

    SELECT d.id, d.cod_beneficio, d.nombre, d.monto_descuento
    INTO v_fila
    FROM public.tp_mnp_descuento_matricula_anticipada d
    WHERE d.activo = true
      AND d.aplicable_a = 'MATRICULA'
      AND d.periodo = v_periodo
      AND d.vigencia_desde <= v_hoy
      AND d.vigencia_hasta >= v_hoy
      AND to_char(d.vigencia_desde, 'YYYY-MM') = to_char(d.vigencia_hasta, 'YYYY-MM')
      AND d.reserva_hasta IS NOT NULL
      AND d.monto_descuento > 0
    ORDER BY d.vigencia_desde
    LIMIT 1;

    IF FOUND THEN
        INSERT INTO public.mnp_reserva_descuento_matricula (
            codcli,
            rut_alumno,
            anio_periodo,
            semestre_periodo,
            descuento_id,
            cod_beneficio,
            nombre,
            monto_reservado,
            motivo
        )
        VALUES (
            v_codcli,
            nullif(trim(coalesce(p_rut_alumno, '')), ''),
            p_anio_periodo,
            p_semestre_periodo,
            v_fila.id,
            v_fila.cod_beneficio,
            v_fila.nombre,
            v_fila.monto_descuento,
            v_motivo
        )
        ON CONFLICT (codcli, anio_periodo, semestre_periodo) DO NOTHING;
    END IF;

    RETURN public.consultar_reserva_descuento_matricula(
        v_codcli,
        p_anio_periodo,
        p_semestre_periodo
    );
END;
$$;

COMMENT ON FUNCTION public.reservar_descuento_matricula IS
    'Guarda la primera reserva del mes de Chile en que el alumno queda en espera. No pisa una reserva ya hecha.';

GRANT EXECUTE ON FUNCTION public.consultar_resolucion_beca_estatal(text, integer, integer)
    TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consultar_reserva_descuento_matricula(text, integer, integer)
    TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reservar_descuento_matricula(text, integer, integer, text, text)
    TO anon, authenticated;
