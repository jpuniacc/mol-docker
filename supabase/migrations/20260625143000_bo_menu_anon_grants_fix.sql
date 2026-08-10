-- Fix: el front (rol anon / VITE_SUPABASE_KEY) debe poder leer el menú lateral.
-- Sin estos GRANT, PostgREST devuelve 42501 permission denied aunque existan políticas RLS.

grant usage on schema public to anon;

grant select, insert, update, delete on public.bo_menu_item to anon;
grant select, insert, update, delete on public.bo_menu_item_grupo to anon;
