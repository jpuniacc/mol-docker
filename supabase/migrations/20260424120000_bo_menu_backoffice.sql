-- Menú lateral del backoffice (dinámico) y visibilidad por codigo_grupo de mv_usuario.
-- Grupos en bo_menu_item_grupo: solo 1 (DVU) y 2 (Admisión). Grupo 3 (TI) ve todos los ítems activos sin filas aquí.

create table if not exists public.bo_menu_item (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid null references public.bo_menu_item (id) on delete cascade,
  tipo text not null check (tipo in ('link', 'group')),
  label text not null,
  route_name text null,
  icon_key text null,
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bo_menu_item_parent_id_idx on public.bo_menu_item (parent_id);
create index if not exists bo_menu_item_orden_idx on public.bo_menu_item (parent_id, orden);

comment on table public.bo_menu_item is 'Ítems del menú lateral del dashboard (jerárquicos). icon_key mapea a Lucide en el front.';

create table if not exists public.bo_menu_item_grupo (
  menu_item_id uuid not null references public.bo_menu_item (id) on delete cascade,
  codigo_grupo int not null check (codigo_grupo in (1, 2)),
  primary key (menu_item_id, codigo_grupo)
);

comment on table public.bo_menu_item_grupo is 'Visibilidad por área: 1=DVU, 2=Admisión. TI (3) no usa esta tabla; el cliente muestra todo si codigo_grupo=3.';

create or replace function public.bo_menu_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = current_timestamp;
  return new;
end;
$$;

drop trigger if exists bo_menu_item_touch_updated_at on public.bo_menu_item;
create trigger bo_menu_item_touch_updated_at
  before update on public.bo_menu_item
  for each row execute function public.bo_menu_touch_updated_at();

alter table public.bo_menu_item enable row level security;
alter table public.bo_menu_item_grupo enable row level security;

-- PostgREST (anon/authenticated) como el resto de tablas de lectura del portal interno.
create policy "bo_menu_item_select" on public.bo_menu_item for select to anon, authenticated using (true);
create policy "bo_menu_item_insert" on public.bo_menu_item for insert to anon, authenticated with check (true);
create policy "bo_menu_item_update" on public.bo_menu_item for update to anon, authenticated using (true) with check (true);
create policy "bo_menu_item_delete" on public.bo_menu_item for delete to anon, authenticated using (true);

create policy "bo_menu_item_grupo_select" on public.bo_menu_item_grupo for select to anon, authenticated using (true);
create policy "bo_menu_item_grupo_insert" on public.bo_menu_item_grupo for insert to anon, authenticated with check (true);
create policy "bo_menu_item_grupo_update" on public.bo_menu_item_grupo for update to anon, authenticated using (true) with check (true);
create policy "bo_menu_item_grupo_delete" on public.bo_menu_item_grupo for delete to anon, authenticated using (true);

grant select, insert, update, delete on public.bo_menu_item to anon, authenticated, service_role;
grant select, insert, update, delete on public.bo_menu_item_grupo to anon, authenticated, service_role;

-- ---------- Seed (UUIDs fijos para referencias estables) ----------
insert into public.bo_menu_item (id, parent_id, tipo, label, route_name, icon_key, orden, activo) values
  ('b0000001-0001-4000-8000-000000000001', null, 'link', 'Inicio', 'dashboard-home', 'Home', 10, true),
  ('b0000001-0001-4000-8000-000000000002', null, 'link', 'Mock matrícula', 'matricula-mock-datos', 'GraduationCap', 20, true),
  ('b0000001-0001-4000-8000-000000000010', null, 'group', 'Matricula', null, null, 30, true),
  ('b0000001-0001-4000-8000-000000000011', 'b0000001-0001-4000-8000-000000000010', 'link', 'Postulaciones', 'dashboard-postulantes', 'Users', 10, true),
  ('b0000001-0001-4000-8000-000000000012', 'b0000001-0001-4000-8000-000000000010', 'link', 'Uso Simulador', 'dashboard-simulador-uso', 'FlaskConical', 20, true),
  ('b0000001-0001-4000-8000-000000000020', null, 'group', 'Rematricula', null, null, 40, true),
  ('b0000001-0001-4000-8000-000000000021', 'b0000001-0001-4000-8000-000000000020', 'link', 'Firma Contrato', 'dashboard-estado-firma-contrato', 'FileSignature', 10, true),
  ('b0000001-0001-4000-8000-000000000022', 'b0000001-0001-4000-8000-000000000020', 'link', 'Matriculados', 'dashboard-matriculados', 'School', 20, true),
  ('b0000001-0001-4000-8000-000000000030', null, 'link', 'Mantenedor menú', 'dashboard-bo-menu', 'Menu', 50, true)
on conflict (id) do nothing;

insert into public.bo_menu_item_grupo (menu_item_id, codigo_grupo) values
  ('b0000001-0001-4000-8000-000000000001', 1),
  ('b0000001-0001-4000-8000-000000000001', 2),
  ('b0000001-0001-4000-8000-000000000002', 2),
  ('b0000001-0001-4000-8000-000000000010', 2),
  ('b0000001-0001-4000-8000-000000000011', 2),
  ('b0000001-0001-4000-8000-000000000012', 2),
  ('b0000001-0001-4000-8000-000000000020', 1),
  ('b0000001-0001-4000-8000-000000000021', 1),
  ('b0000001-0001-4000-8000-000000000022', 1)
on conflict (menu_item_id, codigo_grupo) do nothing;

-- Mock matrícula y Mantenedor menú: solo TI vía regla cliente (sin filas para 1/2).
