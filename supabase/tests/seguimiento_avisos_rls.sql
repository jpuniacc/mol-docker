-- No requiere extensiones pgTAP; verificaciones reales contra el stack self-hosted.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.mnp_seguimiento_aviso_outbox') IS NULL THEN RAISE EXCEPTION 'Falta migración de avisos aprobada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mnp_seguimiento_contacto' AND column_name='proxima_accion_estado') THEN RAISE EXCEPTION 'Falta estado de acciones'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('public.mnp_seguimiento_contacto'::regclass,'public.mnp_seguimiento_aviso_outbox'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'RLS deshabilitado'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ DECLARE t text;op text;denied boolean; BEGIN
 FOREACH t IN ARRAY ARRAY['mnp_seguimiento_contacto','mnp_seguimiento_aviso_outbox'] LOOP
  FOREACH op IN ARRAY ARRAY['SELECT * FROM public.%I','INSERT INTO public.%I DEFAULT VALUES','UPDATE public.%I SET id=id','DELETE FROM public.%I'] LOOP
   denied:=false;
   BEGIN EXECUTE format(op,t); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
   IF NOT denied THEN RAISE EXCEPTION 'anon tiene acceso inesperado: % %',op,t; END IF;
  END LOOP;
 END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ DECLARE t text;op text;denied boolean; BEGIN
 FOREACH t IN ARRAY ARRAY['mnp_seguimiento_contacto','mnp_seguimiento_aviso_outbox'] LOOP
  FOREACH op IN ARRAY ARRAY['SELECT * FROM public.%I','INSERT INTO public.%I DEFAULT VALUES','UPDATE public.%I SET id=id','DELETE FROM public.%I'] LOOP
   denied:=false;
   BEGIN EXECUTE format(op,t); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
   IF NOT denied THEN RAISE EXCEPTION 'authenticated tiene acceso inesperado: % %',op,t; END IF;
  END LOOP;
 END LOOP;
END $$;
RESET ROLE;
DO $$ DECLARE id_nuevo uuid;habilitada boolean; BEGIN
 INSERT INTO public.mnp_seguimiento_contacto(codcli,anio_periodo,semestre_periodo,autor_email,canal,origen,nota,proxima_accion_at)
  VALUES('__PRUEBA_AVISOS_ROLLBACK__',2027,1,'prueba@uniacc.cl','nota','manual','Fixture transaccional',now())
  RETURNING id,proxima_accion_digest_habilitada INTO id_nuevo,habilitada;
 IF NOT habilitada THEN RAISE EXCEPTION 'Las notas nuevas no habilitan digest'; END IF;
 BEGIN
  UPDATE public.mnp_seguimiento_contacto SET proxima_accion_estado='invalido' WHERE id=id_nuevo;
  RAISE EXCEPTION 'Se aceptó un estado inválido';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;
