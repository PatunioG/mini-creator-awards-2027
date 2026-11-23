-- MINI CREATOR AWARDS 2027
-- Ejecuta TODO este archivo en Supabase > SQL Editor > New query.
-- Crea perfiles y una lista privada de administradores. No permite que un usuario
-- se convierta en admin desde la página.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;

-- Los perfiles solo pueden ser consultados/actualizados por su dueño.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Ningún usuario normal puede leer o modificar la lista de administradores.
drop policy if exists "Admins can read admin list" on public.admin_users;
create policy "Admins can read admin list"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

-- Crear automáticamente el perfil cuando alguien se registra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired_username text;
  desired_name text;
begin
  desired_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    'creator_' || substr(new.id::text, 1, 8)
  );
  desired_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    'Nuevo creador'
  );

  insert into public.profiles (id, username, display_name)
  values (new.id, desired_username, desired_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Para nombrar administradores más adelante:
-- 1) Registra primero la cuenta desde la web.
-- 2) Copia su UUID desde Authentication > Users.
-- 3) Ejecuta: insert into public.admin_users (user_id) values ('UUID-AQUI');
-- Nunca pongas ese UUID en el código público del sitio.
