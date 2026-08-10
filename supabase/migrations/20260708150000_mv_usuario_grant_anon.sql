-- El front usa la anon key de Supabase; sin GRANT a anon PostgREST responde 42501
-- ("permission denied for table mv_usuario") en el mantenedor de usuarios.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mv_usuario TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mv_usuario TO authenticated;
GRANT ALL ON TABLE public.mv_usuario TO service_role;
