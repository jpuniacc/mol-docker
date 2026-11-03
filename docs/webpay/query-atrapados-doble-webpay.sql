-- Alumnos con matrícula+arancel Webpay autorizada y sin cuenta.grabar en 30 min
-- (cruzar por RUT normalizado). Solo consulta operativa.
WITH wp AS (
  SELECT regexp_replace(codcli, '\D', '', 'g') AS rut_norm,
    max(actualizado_en) FILTER (WHERE concepto = 'matricula' AND estado = 'autorizada') AS mat_ok,
    max(actualizado_en) FILTER (WHERE concepto = 'arancel' AND estado = 'autorizada') AS ara_ok
  FROM public.mnp_webpay_transaccion
  WHERE anio_periodo = 2027 AND semestre_periodo = 1 AND ambiente = 'produccion'
  GROUP BY 1
),
grab AS (
  SELECT regexp_replace(coalesce(rut_alumno, codcli), '\D', '', 'g') AS rut_norm,
    min(creado_en) AS grabar_en
  FROM public.log_mol_evento
  WHERE categoria = 'cuenta' AND accion = 'grabar'
    AND anio_periodo = 2027 AND semestre_periodo = 1
  GROUP BY 1
)
SELECT w.rut_norm,
  w.mat_ok AT TIME ZONE 'America/Santiago' AS mat_ok_cl,
  w.ara_ok AT TIME ZONE 'America/Santiago' AS ara_ok_cl,
  g.grabar_en AT TIME ZONE 'America/Santiago' AS grabar_cl,
  CASE WHEN g.grabar_en IS NULL THEN NULL
       ELSE round(EXTRACT(EPOCH FROM (g.grabar_en - w.ara_ok)) / 60.0) END AS min_hasta_grabar
FROM wp w
LEFT JOIN grab g ON g.rut_norm = w.rut_norm
WHERE w.mat_ok IS NOT NULL AND w.ara_ok IS NOT NULL
  AND (g.grabar_en IS NULL OR g.grabar_en > w.ara_ok + interval '30 minutes')
ORDER BY w.ara_ok DESC;
