-- telefono_apoderado: varchar(12) -> varchar(32); recrea vista dependiente.
DROP VIEW IF EXISTS public.v_mnp_mv_plan_pagos;

ALTER TABLE public.mnp_mv_plan_pagos_consolidado
  ALTER COLUMN telefono_apoderado TYPE varchar(32);

COMMENT ON COLUMN public.mnp_mv_plan_pagos_consolidado.telefono_apoderado IS
  'Teléfono apoderado desde vista ERP; ancho 32 para formatos con sufijo/guión.';

CREATE VIEW public.v_mnp_mv_plan_pagos
WITH (security_invoker = true)
AS
 SELECT c.codcli,
    c.rut_alumno AS rut,
    c.nombre_alumno,
    c.apellido_paterno_alumno,
    c.apellido_materno_alumno,
    c.es_responsable_financiero,
    c.rut_apoderado AS rut_apoder,
    c.nombre_apoderado,
    c.apellido_paterno_apoderado,
    c.apellido_materno_apoderado,
    c.telefono_apoder,
    c.mail_apoder,
    c.estado_academico,
    c.anio_ingreso AS ano_ingreso,
    c.periodo_ingreso,
    c.categoria_alumno,
    c.jornada_carrera,
    c.codigo_carrera AS cod_carrera,
    c.nombre_carrera AS carrera,
    c.codigo_plan_estudio AS codigo_planestudio,
    c.nombre_plan_estudio AS nombre_planestudios,
    c.direccion_alumno AS direccion,
    c.comuna_alumno AS comuna,
    c.ciudad_alumno AS ciudad,
    c.email_personal_alumno AS mail,
    c.telefono_alumno AS telefono,
    c.telefono_apoderado,
    c.discapacidad,
    c.ramos_aprobados,
    c.ramos_reprobados,
    c.ultima_matricula AS ult_matricula,
    c.ultima_situacion,
    c.periodo_rematricula,
    c.promedio_notas_2025_2 AS prom_ultimo_periodo,
    c.promedio_notas_2025 AS prom_anio,
    c.matricula_valor AS precio_matricula,
    c.matricula_n_cuotas AS cuotas_matricula,
    NULL::text AS doc_pago_matricula,
    c.arancel_valor AS precio_arancel,
    c.arancel_n_cuotas AS cuotas_arancel,
    NULL::text AS doc_pago_arancel,
    ben.monto_beneficio_matricula,
    ben.monto_beneficio_arancel,
    ben.beneficios_detalle,
    c.anio_matricula,
    c.periodo_matricula,
    (c.anio_matricula::text || '-'::text) || c.periodo_matricula::text AS periodo,
    c.synced_at,
    c.nombre_carrera,
    c.matricula_valor AS monto_matricula,
    c.arancel_valor AS monto_arancel,
    c.matricula_n_cuotas AS cuota_matricula,
    c.arancel_n_cuotas AS cuota_arancel,
    ben.monto_beneficio_matricula AS beca_matricula,
    ben.monto_beneficio_arancel AS beca_arancel,
    COALESCE(c.matricula_valor, 0::numeric) - COALESCE(ben.monto_beneficio_matricula, 0::numeric) AS valor_total_matricula,
    COALESCE(c.arancel_valor, 0::numeric) - COALESCE(ben.monto_beneficio_arancel, 0::numeric) AS valor_total_arancel,
    c.alumno_cae,
    c.tiene_beneficio,
    c.beneficio_ano,
    c.beneficio_periodo,
    c.cantidad_beneficios,
    c.monto_total_beneficios,
    c.fuera_cartera_oficial
   FROM mnp_mv_plan_pagos_consolidado c
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(COALESCE(NULLIF(elem.value ->> 'monto'::text, ''::text)::numeric, NULLIF(elem.value ->> 'monto_aprobado'::text, ''::text)::numeric, 0::numeric)) FILTER (WHERE upper(COALESCE(elem.value ->> 'aplicable'::text, ''::text)) = ANY (ARRAY['MATRICULA'::text, 'M'::text])), 0::numeric) AS monto_beneficio_matricula,
            COALESCE(sum(COALESCE(NULLIF(elem.value ->> 'monto'::text, ''::text)::numeric, NULLIF(elem.value ->> 'monto_aprobado'::text, ''::text)::numeric, 0::numeric)) FILTER (WHERE (upper(COALESCE(elem.value ->> 'aplicable'::text, ''::text)) = ANY (ARRAY['ARANCEL'::text, 'A'::text, 'S'::text, 'SI'::text])) OR COALESCE(elem.value ->> 'aplicable'::text, ''::text) = ''::text), 0::numeric) AS monto_beneficio_arancel,
            COALESCE(jsonb_agg(jsonb_build_object('cod_beneficio', elem.value ->> 'codigo_beneficio'::text, 'descripcion', elem.value ->> 'descripcion'::text, 'monto', NULLIF(elem.value ->> 'monto'::text, ''::text)::numeric, 'monto_aprobado', NULLIF(elem.value ->> 'monto_aprobado'::text, ''::text)::numeric, 'monto_solicitado', NULLIF(elem.value ->> 'monto_solicitado'::text, ''::text)::numeric, 'porc_apr', NULLIF(elem.value ->> 'porcentaje_aprobado'::text, ''::text)::numeric, 'porc_sol', NULLIF(elem.value ->> 'porcentaje_solicitud'::text, ''::text)::numeric, 'aplicable', elem.value ->> 'aplicable'::text, 'estado', elem.value ->> 'estado'::text) ORDER BY (elem.value ->> 'codigo_beneficio'::text)) FILTER (WHERE elem.value IS NOT NULL), '[]'::jsonb) AS beneficios_detalle
           FROM jsonb_array_elements(COALESCE(c.beneficios_json, '[]'::jsonb)) elem(value)) ben ON true;
;
