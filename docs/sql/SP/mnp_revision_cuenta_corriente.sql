/* Revision cuenta corriente MOL staging.
 * Tras Confirmar plan de pagos, usa el CORRELATIVO.preview del preflight:
 *   psql ... -v op=<ese_numero> -f docs/sql/SP/mnp_revision_cuenta_corriente.sql
 * Esperado pagaré-solo: 2 / 22 / 2 / 2, usuario 27904, ctadep.ctadoc = 41.
 */
\if :{?op}
\else
\set op 960252
\endif


SELECT * FROM public.mnp_mt_docitem WHERE num_operacion = :op::numeric ORDER BY item;
SELECT * FROM public.mnp_mt_ctapag WHERE num_operacion = :op::numeric ORDER BY ctapagnum;
SELECT * FROM public.mnp_mt_ctadep WHERE num_operacion = :op::numeric ORDER BY ctadocnum;
SELECT * FROM public.mnp_mt_ctadoc WHERE num_operacion = :op::numeric ORDER BY ctadoc, ctadocnum;

SELECT * FROM public.mnp_mt_docitem ORDER BY item;
SELECT * FROM public.mnp_mt_ctapag ORDER BY ctapagnum;
SELECT * FROM public.mnp_mt_ctadep ORDER BY ctadocnum;
SELECT * FROM public.mnp_mt_ctadoc ORDER BY ctadoc, ctadocnum;

/* usuario UMAS (caja 10) = 27904; origen mol */
SELECT 'docitem' AS t, usuario, count(*) FROM public.mnp_mt_docitem WHERE num_operacion = :op::numeric GROUP BY usuario
UNION ALL SELECT 'ctadoc', usuario, count(*) FROM public.mnp_mt_ctadoc WHERE num_operacion = :op::numeric GROUP BY usuario
UNION ALL SELECT 'ctapag', usuario, count(*) FROM public.mnp_mt_ctapag WHERE num_operacion = :op::numeric GROUP BY usuario
UNION ALL SELECT 'ctadep', usuario, count(*) FROM public.mnp_mt_ctadep WHERE num_operacion = :op::numeric GROUP BY usuario;

/* Conteos receta pagaré-solo: 2 / 22 / 2 / 2 */
SELECT 'docitem' AS t, count(*) FROM public.mnp_mt_docitem WHERE num_operacion = :op::numeric
UNION ALL SELECT 'ctadoc', count(*) FROM public.mnp_mt_ctadoc WHERE num_operacion = :op::numeric
UNION ALL SELECT 'ctapag', count(*) FROM public.mnp_mt_ctapag WHERE num_operacion = :op::numeric
UNION ALL SELECT 'ctadep', count(*) FROM public.mnp_mt_ctadep WHERE num_operacion = :op::numeric;

/* ctadep debe apuntar a boleta 41, no a cuota 14; suma = docitem */
SELECT d.item, d.ctadocnum AS boleta, d.monto AS cargo,
       dep.ctadoc AS dep_ctadoc, dep.ctapagnum, dep.monto AS aplicado
FROM public.mnp_mt_docitem d
LEFT JOIN public.mnp_mt_ctadep dep
  ON dep.num_operacion = d.num_operacion
 AND dep.ctadocnum = d.ctadocnum
 AND dep.ctadoc = 41
WHERE d.num_operacion = :op::numeric
ORDER BY d.item;

SELECT count(*) AS ctadep_sobre_cuota_14
FROM public.mnp_mt_ctadep
WHERE num_operacion = :op::numeric AND ctadoc = 14;

UPDATE public.mnp_mt_docitem SET usuario = '27904' WHERE num_operacion = :op::numeric;
UPDATE public.mnp_mt_ctadoc  SET usuario = '27904' WHERE num_operacion = :op::numeric;
UPDATE public.mnp_mt_ctapag  SET usuario = '27904' WHERE num_operacion = :op::numeric;
UPDATE public.mnp_mt_ctadep  SET usuario = '27904' WHERE num_operacion = :op::numeric;

/* Eliminacion (descomentar COMMIT para aplicar) */
BEGIN;

DELETE FROM public.mnp_mt_ctadep ;
DELETE FROM public.mnp_mt_ctapag ;
DELETE FROM public.mnp_mt_ctadoc ;
DELETE FROM public.mnp_mt_docitem;

SELECT 'docitem' AS t, count(*) FROM public.mnp_mt_docitem WHERE num_operacion = :op::numeric
UNION ALL SELECT 'ctadoc', count(*) FROM public.mnp_mt_ctadoc WHERE num_operacion = :op::numeric
UNION ALL SELECT 'ctapag', count(*) FROM public.mnp_mt_ctapag WHERE num_operacion = :op::numeric
UNION ALL SELECT 'ctadep', count(*) FROM public.mnp_mt_ctadep WHERE num_operacion = :op::numeric;

ROLLBACK;
-- COMMIT;
