-- =====================================================================
--  IndioKnowHow — schema database Supabase
--  Da eseguire UNA volta nel SQL Editor del progetto Supabase.
--  È idempotente: rieseguirlo non rompe nulla.
-- =====================================================================

create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Membri dello studio (chi può leggere e scrivere)
--    Per aggiungere un collega: crealo in Authentication > Users
--    e inserisci la sua email qui.
-- ---------------------------------------------------------------------
create table if not exists public.members (
  email        text primary key,
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- in uno schema non esposto dalle API
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Funzione immutabile per poter usare unaccent nelle espressioni
create or replace function public.f_unaccent(t text)
returns text
language sql immutable parallel safe strict
set search_path = public, extensions
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

-- ---------------------------------------------------------------------
-- 2. Note / articoli (stesso oggetto: cambia solo la cura)
-- ---------------------------------------------------------------------
create table if not exists public.notes (
  id               uuid primary key default gen_random_uuid(),
  title            text not null default '',
  body             text not null default '',
  tags             text[] not null default '{}',
  needs_review     boolean not null default false,
  created_by_email text,
  updated_by_email text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,               -- cestino (soft delete)
  search_vec       tsvector,
  search_text      text
);

create index if not exists notes_search_vec_idx   on public.notes using gin (search_vec);
create index if not exists notes_search_text_trgm on public.notes using gin (search_text extensions.gin_trgm_ops);
create index if not exists notes_tags_idx         on public.notes using gin (tags);
create index if not exists notes_updated_at_idx   on public.notes (updated_at);

-- Normalizza tag, titolo automatico, indicizzazione per la ricerca
create or replace function public.notes_before_write()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  first_line text;
  who text := auth.jwt() ->> 'email';
begin
  -- tag: minuscoli, senza spazi, senza doppioni
  new.tags := coalesce((
    select array_agg(distinct t order by t)
    from (
      select regexp_replace(regexp_replace(lower(trim(x)), '^#', ''), '\s+', '-', 'g') as t
      from unnest(coalesce(new.tags, '{}')) as x
    ) s
    where t <> ''
  ), '{}');

  -- titolo vuoto -> prima riga del testo
  if coalesce(trim(new.title), '') = '' then
    first_line := (
      select regexp_replace(l, '^[#>*\-\s]+', '')
      from regexp_split_to_table(coalesce(new.body, ''), E'\n') as l
      where trim(l) <> '' and l !~ '^\s*!\['
      limit 1
    );
    new.title := coalesce(nullif(left(trim(first_line), 80), ''), 'Nota senza titolo');
  end if;

  if tg_op = 'INSERT' then
    new.created_by_email := coalesce(new.created_by_email, who);
    new.created_at := now();
  else
    new.created_by_email := old.created_by_email;
    new.created_at := old.created_at;
  end if;
  new.updated_by_email := coalesce(who, new.updated_by_email);
  new.updated_at := now();

  -- Ricerca: titolo e tag pesano molto (A), il testo meno (C/D).
  -- 'simple' non tronca le parole: protegge codici tipo BL20-E-GW-EC-20.
  new.search_vec :=
       setweight(to_tsvector('simple',  f_unaccent(coalesce(new.title, ''))), 'A')
    || setweight(to_tsvector('simple',  f_unaccent(array_to_string(new.tags, ' '))), 'A')
    || setweight(to_tsvector('italian', f_unaccent(coalesce(new.body, ''))), 'C')
    || setweight(to_tsvector('simple',  f_unaccent(coalesce(new.body, ''))), 'D');
  new.search_text := lower(f_unaccent(coalesce(new.title, '') || ' ' || array_to_string(new.tags, ' ')));

  return new;
end;
$$;

drop trigger if exists notes_before_write on public.notes;
create trigger notes_before_write
  before insert or update on public.notes
  for each row execute function public.notes_before_write();

-- ---------------------------------------------------------------------
-- 3. Cronologia versioni (ogni modifica salva la versione precedente)
-- ---------------------------------------------------------------------
create table if not exists public.note_versions (
  id              bigint generated always as identity primary key,
  note_id         uuid not null references public.notes(id) on delete cascade,
  title           text,
  body            text,
  tags            text[],
  edited_by_email text,
  created_at      timestamptz not null default now()
);
create index if not exists note_versions_note_idx on public.note_versions (note_id, created_at desc);

create or replace function public.notes_save_version()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.title is distinct from new.title
     or old.body is distinct from new.body
     or old.tags is distinct from new.tags then
    insert into public.note_versions (note_id, title, body, tags, edited_by_email, created_at)
    values (old.id, old.title, old.body, old.tags, old.updated_by_email, old.updated_at);
  end if;
  return new;
end;
$$;

drop trigger if exists notes_save_version on public.notes;
create trigger notes_save_version
  after update on public.notes
  for each row execute function public.notes_save_version();

-- ---------------------------------------------------------------------
-- 4. Ricerca ibrida: parole intere + prefissi + italiano + errori di battitura
-- ---------------------------------------------------------------------
create or replace function public.search_notes(q text, max_results int default 40)
returns table (
  id uuid, title text, tags text[], snippet text,
  updated_at timestamptz, needs_review boolean, rank real
)
language plpgsql stable
set search_path = public, extensions
as $$
declare
  qn text := lower(f_unaccent(trim(coalesce(q, ''))));
  lex text;
  tsq_prefix tsquery;
  tsq_it tsquery;
begin
  if qn = '' then return; end if;

  -- ogni parola digitata diventa "prefisso:*" (trova mentre scrivi)
  for lex in select unnest(tsvector_to_array(to_tsvector('simple', qn))) loop
    if tsq_prefix is null then
      tsq_prefix := to_tsquery('simple', quote_literal(lex) || ':*');
    else
      tsq_prefix := tsq_prefix && to_tsquery('simple', quote_literal(lex) || ':*');
    end if;
  end loop;
  tsq_it := websearch_to_tsquery('italian', qn);

  return query
  select n.id, n.title, n.tags,
         left(regexp_replace(n.body, '!\[[^\]]*\]\([^)]*\)|[#>*`_|]|\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]', '', 'g'), 220) as snippet,
         n.updated_at, n.needs_review,
         ( coalesce(ts_rank(n.search_vec, tsq_prefix), 0)
         + coalesce(ts_rank(n.search_vec, tsq_it), 0)
         + word_similarity(qn, n.search_text) * 0.6
         + case when n.search_text like '%' || qn || '%' then 0.5 else 0 end
         )::real as rank
  from public.notes n
  where n.deleted_at is null
    and (
         (tsq_prefix is not null and n.search_vec @@ tsq_prefix)
      or (tsq_it is not null and numnode(tsq_it) > 0 and n.search_vec @@ tsq_it)
      or word_similarity(qn, n.search_text) > 0.45
    )
  order by rank desc, n.updated_at desc
  limit max_results;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Sicurezza (RLS): solo i membri leggono e scrivono
-- ---------------------------------------------------------------------
alter table public.members       enable row level security;
alter table public.notes         enable row level security;
alter table public.note_versions enable row level security;

drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated using (private.is_member());

drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes
  for select to authenticated using (private.is_member());

drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes
  for insert to authenticated with check (private.is_member());

drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes
  for update to authenticated using (private.is_member()) with check (private.is_member());

drop policy if exists versions_select on public.note_versions;
create policy versions_select on public.note_versions
  for select to authenticated using (private.is_member());

revoke all on public.members, public.notes, public.note_versions from anon;
grant select on public.members to authenticated;
grant select, insert, update on public.notes to authenticated;
grant select on public.note_versions to authenticated;
revoke execute on function public.search_notes(text, int) from public, anon;
grant execute on function public.search_notes(text, int) to authenticated;
revoke execute on function private.is_member() from public, anon;
grant execute on function private.is_member() to authenticated;
revoke execute on function public.notes_save_version() from public, anon, authenticated;
revoke execute on function public.notes_before_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Immagini: bucket PRIVATO, accessibile solo ai membri
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-images', 'note-images', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists note_images_select on storage.objects;
create policy note_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'note-images' and private.is_member());

drop policy if exists note_images_insert on storage.objects;
create policy note_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-images' and private.is_member());

-- ---------------------------------------------------------------------
-- 7. Primo membro
-- ---------------------------------------------------------------------
insert into public.members (email, display_name, is_admin)
values ('marco.strianese@indiotech.com', 'Marco Strianese', true)
on conflict (email) do nothing;

-- ---------------------------------------------------------------------
-- 8. "Ping" per tenere sveglio il progetto gratuito (vedi keepalive.yml)
-- ---------------------------------------------------------------------
create or replace function public.ping()
returns timestamptz language sql stable set search_path = '' as $$ select now() $$;
grant execute on function public.ping() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Nota di benvenuto (solo se l'archivio è vuoto)
-- ---------------------------------------------------------------------
insert into public.notes (title, tags, body)
select 'Come si scrive su IndioKnowHow', array['guida', 'markdown', 'indioknowhow'],
$md$Nessuna regola sulla struttura: scrivi come ti viene. L'unica cosa che conta sono **titolo e tag**, perché sono quello che la ricerca guarda per primo.

## Dal telefono
Tocca **＋**, scrivi due righe, scatta una foto con 📷, aggiungi un paio di tag e salva. Se non metti il titolo, diventa titolo la prima riga. Le note rapide nascono "da rivedere": le ritrovi nella sezione apposita quando sei al PC.

## Dal PC
- **Ctrl+V** incolla uno screenshot direttamente nel testo
- trascina immagini o un file `.md` nell'area di scrittura (insieme alle sue immagini)
- **Ctrl+S** salva, **Ctrl+K** cerca (o inserisce un link mentre scrivi)

## Tag che funzionano
Oltre al tag tecnico (`ethercat`, `fd1`, `turck`) aggiungi **le parole che digiteresti di fretta**: `autostart`, `avvio`, `startup`.

## Riquadri
> [!WARNING]
> Per le cose da NON fare.

> [!TIP]
> Per i trucchi che fanno risparmiare tempo.

> [!NOTE]
> Per le informazioni di contesto.

## Codice
```c
if (in & 0x0001) start_cycle();
```

## Tabelle
| Parametro | Valore |
| --- | --- |
| Baudrate | 115200 |

## Checklist
- [x] scritto subito dopo aver risolto
- [ ] riletto con calma
$md$
where not exists (select 1 from public.notes);
