-- Gestión Pagos: excluir alumnos ya matriculados (MOL, BO o conflicto).
CREATE OR REPLACE FUNCTION public.listar_gestion_pagos_pendientes_arancel(
  p_anio integer,
  p_semestre integer
)
RETURNS TABLE(
  codcli text,
  rut text,
  rut_norm text,
  nombre_alumno text,
  codigo_carrera text,
  nombre_carrera text,
  telefono text,
  email text,
  fecha_pago_matricula timestamptz,
  anio integer,
  semestre integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_anio IS NULL OR p_semestre IS NULL OR p_semestre NOT IN (1, 2) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH progreso AS (
    SELECT
      p.codcli,
      p.rut,
      p.rut_norm,
      p.nombre_alumno,
      p.codigo_carrera,
      p.nombre_carrera
    FROM public.mnp_progreso_rematricula p
    WHERE p.anio_periodo = p_anio
      AND p.semestre_periodo = p_semestre
      AND coalesce(p.etapa_actual, '') NOT IN (
        'matriculado',
        'matriculado_bo',
        'conflicto_mol_bo'
      )
  ),
  webpay_ult AS (
    SELECT DISTINCT ON (u.codcli, w.concepto)
      u.codcli AS alumno_codcli,
      w.concepto,
      coalesce(w.transaction_date, w.actualizado_en) AS fecha
    FROM progreso u
    JOIN public.mnp_webpay_transaccion w
      ON w.anio_periodo = p_anio
     AND w.semestre_periodo = p_semestre
     AND w.estado = 'autorizada'
     AND w.concepto IN ('matricula', 'arancel')
     AND w.codcli IS NOT NULL
     AND (
       w.codcli = u.codcli
       OR (
         u.rut_norm IS NOT NULL
         AND length(u.rut_norm) >= length(w.codcli)
         AND left(u.rut_norm, length(w.codcli)) = w.codcli
       )
     )
    ORDER BY u.codcli, w.concepto, w.actualizado_en DESC NULLS LAST, w.creado_en DESC NULLS LAST
  ),
  base AS (
    SELECT
      u.*,
      b.payload,
      wm.fecha AS fecha_mat
    FROM progreso u
    INNER JOIN webpay_ult wm
      ON wm.alumno_codcli = u.codcli AND wm.concepto = 'matricula'
    LEFT JOIN webpay_ult wa
      ON wa.alumno_codcli = u.codcli AND wa.concepto = 'arancel'
    LEFT JOIN public.mol_borrador_rematricula b
      ON b.anio_periodo = p_anio
     AND b.semestre_periodo = p_semestre
     AND b.codcli = u.codcli
    WHERE wa.alumno_codcli IS NULL
  ),
  con_flags AS (
    SELECT
      b.*,
      CASE
        WHEN b.payload IS NULL THEN false
        WHEN lower(nullif(trim(b.payload->>'medioArancel'), '')) IS NOT NULL THEN false
        WHEN (b.payload->>'webpayMontoArancel') ~ '^-?[0-9]+(\.[0-9]+)?$'
          AND (b.payload->>'webpayMontoArancel')::numeric = 0 THEN true
        ELSE (
          COALESCE((
            SELECT sum(coalesce(nullif(q->>'monto', '')::numeric, 0))
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(b.payload->'pagoMatricula'->'cuotasDetalle') = 'array'
                THEN b.payload->'pagoMatricula'->'cuotasDetalle'
                ELSE '[]'::jsonb
              END
            ) q
            WHERE coalesce(nullif(q->>'item', ''), '') ~ '^[0-9]+$'
              AND (q->>'item')::int = 2
          ), 0) <= 0
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(b.payload->'pagoMatricula'->'descuentos') = 'array'
                THEN b.payload->'pagoMatricula'->'descuentos'
                ELSE '[]'::jsonb
              END
            ) d
            WHERE lower(coalesce(d->>'concepto', '')) IN ('arancel', 'a')
          )
        )
      END AS arancel_cubierto
    FROM base b
  )
  SELECT
    f.codcli,
    f.rut,
    f.rut_norm,
    f.nombre_alumno,
    f.codigo_carrera,
    f.nombre_carrera,
    nullif(trim(f.payload->>'contactoTelefonoValidado'), '') AS telefono,
    nullif(trim(f.payload->>'contactoCorreoValidado'), '') AS email,
    f.fecha_mat AS fecha_pago_matricula,
    p_anio AS anio,
    p_semestre AS semestre
  FROM con_flags f
  WHERE NOT f.arancel_cubierto
  ORDER BY f.nombre_alumno NULLS LAST, f.codcli;
END;
$function$;

COMMENT ON FUNCTION public.listar_gestion_pagos_pendientes_arancel(integer, integer) IS
  'Gestión Pagos: Webpay matrícula autorizada, sin arancel Webpay/cubierto, sin etapa matriculado/matriculado_bo/conflicto_mol_bo. TuFirma se filtra en API.';

NOTIFY pgrst, 'reload schema';
