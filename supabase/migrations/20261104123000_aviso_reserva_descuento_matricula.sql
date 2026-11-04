-- Aviso por correo al crear la primera reserva de descuento de matrícula (CAE / ESTATAL).

ALTER TABLE public.mnp_aviso_consejero
  DROP CONSTRAINT IF EXISTS mnp_aviso_consejero_tipo_check;

ALTER TABLE public.mnp_aviso_consejero
  ADD CONSTRAINT mnp_aviso_consejero_tipo_check
  CHECK (tipo IN (
    'TYC_RECHAZO',
    'CONVENIO_CERTIFICADO',
    'CONVENIO_CERTIFICADO_ALUMNO',
    'CONVENIO_CERTIFICADO_APROBADO',
    'CONVENIO_CERTIFICADO_APROBADO_ALUMNO',
    'CONVENIO_CERTIFICADO_RECHAZADO',
    'CONVENIO_CERTIFICADO_RECHAZADO_ALUMNO',
    'CONVENIO_CERTIFICADO_ELIMINADO',
    'APODERADO_DATOS',
    'APODERADO_ACTUALIZADO',
    'FIRMA_COMPLETA',
    'MATRICULADO',
    'MATRICULADO_ALUMNO',
    'RESERVA_DESCUENTO_MATRICULA'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_mnp_aviso_reserva_descuento_matricula
  ON public.mnp_aviso_consejero (tipo, periodo, codcli)
  WHERE tipo = 'RESERVA_DESCUENTO_MATRICULA';

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
    v_rut text;
    v_inserted_id uuid;
    v_progreso record;
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
    v_rut := nullif(trim(coalesce(p_rut_alumno, '')), '');

    SELECT d.id, d.cod_beneficio, d.nombre, d.monto_descuento, d.reserva_hasta
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
            v_rut,
            p_anio_periodo,
            p_semestre_periodo,
            v_fila.id,
            v_fila.cod_beneficio,
            v_fila.nombre,
            v_fila.monto_descuento,
            v_motivo
        )
        ON CONFLICT (codcli, anio_periodo, semestre_periodo) DO NOTHING
        RETURNING id INTO v_inserted_id;

        IF v_inserted_id IS NOT NULL THEN
            SELECT
                p.rut,
                p.nombre_alumno,
                p.nombre_carrera,
                p.jornada_carrera
            INTO v_progreso
            FROM public.mnp_progreso_rematricula p
            WHERE p.codcli = v_codcli
              AND p.anio_periodo = p_anio_periodo
              AND p.semestre_periodo = p_semestre_periodo
            LIMIT 1;

            INSERT INTO public.mnp_aviso_consejero (
                tipo,
                periodo,
                codcli,
                rut_alumno,
                nombre_alumno,
                carrera,
                jornada,
                ref_id,
                payload,
                estado,
                es_mock
            ) VALUES (
                'RESERVA_DESCUENTO_MATRICULA',
                v_periodo,
                v_codcli,
                coalesce(v_rut, nullif(trim(coalesce(v_progreso.rut, '')), '')),
                nullif(trim(coalesce(v_progreso.nombre_alumno, '')), ''),
                nullif(trim(coalesce(v_progreso.nombre_carrera, '')), ''),
                nullif(trim(coalesce(v_progreso.jornada_carrera, '')), ''),
                v_inserted_id::text,
                jsonb_build_object(
                    'motivo', v_motivo,
                    'descuento_id', v_fila.id,
                    'nombre_descuento', v_fila.nombre,
                    'monto', v_fila.monto_descuento,
                    'reserva_hasta', v_fila.reserva_hasta
                ),
                'pendiente',
                false
            )
            ON CONFLICT (tipo, periodo, codcli)
            WHERE (tipo = 'RESERVA_DESCUENTO_MATRICULA')
            DO NOTHING;
        END IF;
    END IF;

    RETURN public.consultar_reserva_descuento_matricula(
        v_codcli,
        p_anio_periodo,
        p_semestre_periodo
    );
END;
$$;

COMMENT ON FUNCTION public.reservar_descuento_matricula IS
    'Guarda la primera reserva del mes de Chile en que el alumno queda en espera. Si el INSERT crea fila, encola aviso RESERVA_DESCUENTO_MATRICULA. No pisa una reserva ya hecha.';
