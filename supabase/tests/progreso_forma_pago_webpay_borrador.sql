-- Prueba aislada: ejecuta los CTE reales de la función contra fixtures temporales.
-- No modifica datos de alumnos. Ejecutar psql -v ON_ERROR_STOP=1 -f este_archivo.
BEGIN;
CREATE TEMP TABLE progreso_test_webpay (codcli text, buy_order text, anio_periodo int, semestre_periodo int, concepto text, estado text);
CREATE TEMP TABLE progreso_test_borrador (codcli text, anio_periodo int, semestre_periodo int, payload jsonb);
DO $test$
DECLARE
  definicion text := pg_get_functiondef('public.refresh_mnp_progreso_rematricula(integer,integer)'::regprocedure);
  consulta text;
  caso jsonb;
  actual boolean;
  errores text[] := '{}';
BEGIN
  consulta := 'WITH universo AS (SELECT ''TEST_ACADEMICO''::text AS codcli, ''210671439''::text AS rut_norm, false AS sin_match_mol), '
    || split_part(split_part(definicion, '  webpay_matricula_ok AS (', 2), '  hitos AS (', 1);
  consulta := replace(consulta, 'WITH universo AS (SELECT ''TEST_ACADEMICO''::text AS codcli, ''210671439''::text AS rut_norm, false AS sin_match_mol), ',
    'WITH universo AS (SELECT ''TEST_ACADEMICO''::text AS codcli, ''210671439''::text AS rut_norm, false AS sin_match_mol), webpay_matricula_ok AS (');
  consulta := regexp_replace(consulta, ',[[:space:]]*$', '');
  consulta := replace(replace(consulta, 'public.mnp_webpay_transaccion', 'pg_temp.progreso_test_webpay'), 'public.mol_borrador_rematricula', 'pg_temp.progreso_test_borrador');
  consulta := replace(replace(consulta, 'p_anio', '2027'), 'p_semestre', '1');
  consulta := consulta || ' SELECT EXISTS(SELECT 1 FROM webpay_matricula_ok) OR EXISTS(SELECT 1 FROM borrador_forma_pago_ok)';
  FOR caso IN SELECT value FROM jsonb_array_elements('[
    {"nombre":"codcli académico","w":"TEST_ACADEMICO","esperado":true},
    {"nombre":"RUT sin DV","w":"21067143","esperado":true},
    {"nombre":"RUT con DV","w":"210671439","esperado":true},
    {"nombre":"RUT formateado","w":"21.067.143-9","esperado":true},
    {"nombre":"no extraer RUT desde codcli alfanumérico","w":"21ABC0671439","esperado":false},
    {"nombre":"buy_order delimitado","w":"legacy","order":"210671432027-1-118","esperado":true},
    {"nombre":"rechaza colisión prefijo","w":"otro","order":"2106714392027-1-118","esperado":false},
    {"nombre":"rechaza pago no autorizado","w":"21067143","estado":"rechazada","esperado":false},
    {"nombre":"rechaza otro período","w":"21067143","anio":2026,"esperado":false},
    {"nombre":"rechaza concepto arancel","w":"21067143","concepto":"arancel","esperado":false},
    {"nombre":"borrador autorizado","payload":{"webpayMatriculaEstado":"autorizada"},"esperado":true},
    {"nombre":"borrador matrícula seleccionado","payload":{"medioMatricula":"pagare"},"esperado":true},
    {"nombre":"borrador arancel seleccionado","payload":{"medioArancel":"pagare"},"esperado":true},
    {"nombre":"modal vacío","payload":{"medioMatricula":null,"medioArancel":"","pasoAlcanzado":2},"esperado":false},
    {"nombre":"medio inválido","payload":{"medioMatricula":"otra cosa","medioArancel":"sin elegir"},"esperado":false},
    {"nombre":"sin actividad","esperado":false}
  ]'::jsonb)
  LOOP
    TRUNCATE progreso_test_webpay, progreso_test_borrador;
    IF caso ? 'w' THEN
      INSERT INTO progreso_test_webpay VALUES (caso->>'w',coalesce(caso->>'order','sin-order'),coalesce((caso->>'anio')::int,2027),1,coalesce(caso->>'concepto','matricula'),coalesce(caso->>'estado','autorizada'));
    END IF;
    IF caso ? 'payload' THEN
      INSERT INTO progreso_test_borrador VALUES ('TEST_ACADEMICO',2027,1,caso->'payload');
    END IF;
    EXECUTE consulta INTO actual;
    IF actual IS DISTINCT FROM (caso->>'esperado')::boolean THEN
      errores := array_append(errores, caso->>'nombre');
      RAISE WARNING 'FAIL: % (actual=%, esperado=%)',caso->>'nombre',actual,caso->>'esperado';
    ELSE RAISE NOTICE 'PASS: %',caso->>'nombre';
    END IF;
  END LOOP;
  IF cardinality(errores)>0 THEN RAISE EXCEPTION 'Regresiones: %',array_to_string(errores,', '); END IF;
END;
$test$;
ROLLBACK;
