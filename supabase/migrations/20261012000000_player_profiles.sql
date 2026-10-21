-- Player profiles: usernames, first-claim passwords, and public image paths.
-- Existing names become lowercase URL-safe usernames. Any collision receives
-- a deterministic player-id suffix.
begin;

alter table public.players
  add column username text,
  add column password text,
  add column profile_image_path text,
  add column background_image_path text;

do $$
declare
  r record;
  v_base text;
  v_username text;
  v_suffix int;
begin
  for r in select id, name from public.players order by id loop
    v_base := nullif(trim(both '-' from regexp_replace(lower(trim(r.name)), '[^a-z0-9._-]+', '-', 'g')), '');
    if v_base is null then v_base := 'player'; end if;
    v_username := left(v_base, 32);
    v_suffix := 0;
    while exists (
      select 1 from public.players p
       where p.username is not null
         and lower(trim(p.username)) = lower(trim(v_username))
    ) loop
      v_suffix := v_suffix + 1;
      v_username := left(v_base, 32 - length(r.id::text) - length(v_suffix::text) - 2)
        || '-' || r.id || '-' || v_suffix;
    end loop;
    update public.players set username = v_username where id = r.id;
  end loop;
end;
$$;

alter table public.players
  alter column username set not null,
  add constraint players_username_format
    check (username = trim(username) and username ~ '^[A-Za-z0-9._-]{1,32}$');

create unique index players_username_unique on public.players (lower(trim(username)));

create or replace function public.claim_player_login(p_username text, p_password text)
returns table (player_id bigint, username text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_username text;
  v_saved_password text;
begin
  if p_username is null or trim(p_username) = '' or p_password is null or p_password = '' then
    return;
  end if;

  select p.id, p.username, p.password
    into v_id, v_username, v_saved_password
    from public.players p
   where lower(trim(p.username)) = lower(trim(p_username))
   for update;

  if not found then return; end if;

  if v_saved_password is null then
    update public.players set password = p_password where id = v_id;
  elsif v_saved_password <> p_password then
    return;
  end if;

  return query select v_id, v_username;
end;
$$;

revoke all on function public.claim_player_login(text, text) from public, anon, authenticated;
grant execute on function public.claim_player_login(text, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-profile-images', 'player-profile-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
