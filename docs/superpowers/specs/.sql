-- Medios de pago matrícula/arancel de quienes ya grabaron cuenta (MOL)
-- Filtra por mes de grabación con el BETWEEN de creado_en (Chile).

WITH grabar_ok AS (
  SELECT
    i.id,
    i.codcli,
    i.rut_alumno,
    i.creado_en,
    i.payload->>'medioMatricula' AS medio_matricula,
    i.payload->>'medioArancel'   AS medio_arancel,
    i.payload->>'numOperacion'   AS num_operacion,
    -- mes calendario Chile del grabado
    to_char((i.creado_en AT TIME ZONE 'America/Santiago'), 'YYYY-MM') AS mes_chile
  FROM public.log_mol_intento i
  WHERE i.tema = 'cuenta'
    AND i.accion = 'grabar'
    AND i.resultado = 'ok'
    AND i.payload ? 'medioMatricula'
    AND i.payload ? 'medioArancel'
),
-- si hubo más de un grabado ok, nos quedamos con el último por codcli
ultimo AS (
  SELECT DISTINCT ON (codcli)
    *
  FROM grabar_ok
  ORDER BY codcli, creado_en DESC
)
SELECT
  u.mes_chile,
  u.codcli,
  u.rut_alumno,
  p.nombre_alumno,
  p.nombre_carrera,
  p.codigo_carrera,
  u.medio_matricula,
  u.medio_arancel,
  CASE
    WHEN u.medio_matricula = 'webpay' AND u.medio_arancel = 'webpay' THEN 'Ambos Webpay'
    WHEN u.medio_matricula = 'pagare' AND u.medio_arancel = 'pagare' THEN 'Ambos pagaré'
    WHEN u.medio_matricula = 'webpay' AND u.medio_arancel = 'pagare' THEN 'Matrícula Webpay + Arancel pagaré'
    WHEN u.medio_matricula = 'pagare' AND u.medio_arancel = 'webpay' THEN 'Matrícula pagaré + Arancel Webpay'
    ELSE 'Otro / revisar'
  END AS forma_seleccionada,
  u.num_operacion,
  u.creado_en AS grabado_en
FROM ultimo u
LEFT JOIN public.mnp_progreso_rematricula p
  ON p.codcli = u.codcli
 AND p.anio_periodo = 2027
 AND p.semestre_periodo = 1
-- opcional: solo quienes figuran matriculados en progreso
-- WHERE p.etapa_actual = 'matriculado'
ORDER BY u.mes_chile, u.creado_en DESC;
