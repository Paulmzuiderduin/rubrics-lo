-- Normalized product architecture for Rubrics LO.
--
-- The first release remains intentionally single-user: every authenticated
-- teacher gets one personal workspace and the UI exposes no sharing features.
-- Domain data belongs to a workspace rather than directly to a user, so a
-- later school/team membership model does not require changing every table.
--
-- During the transition teacher_workspaces remains the frontend write target.
-- This migration is intentionally additive: it does not copy, rewrite or
-- delete existing teacher data. Data migration and frontend cutover happen in
-- a separately reviewed migration after backups and verification queries.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Mijn werkomgeving',
  workspace_type text not null default 'personal'
    check (workspace_type in ('personal', 'school')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index workspaces_one_personal_per_owner_idx
  on public.workspaces (owner_user_id)
  where workspace_type = 'personal';

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'teacher', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create unique index workspace_members_one_owner_idx
  on public.workspace_members (workspace_id)
  where role = 'owner';
create index workspace_members_user_id_idx
  on public.workspace_members (user_id, workspace_id);

create table public.teacher_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  schema_version smallint not null default 3 check (schema_version between 3 and 99),
  school_year_label text not null,
  school_year_start date not null,
  school_year_end date not null,
  updated_at timestamptz not null default now(),
  check (school_year_end >= school_year_start)
);

create table public.lesson_periods (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period_number smallint not null check (period_number between 1 and 20),
  start_time time not null,
  end_time time not null,
  primary key (workspace_id, period_number),
  check (end_time > start_time)
);

create table public.classes (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  id text not null check (length(id) between 1 and 120),
  name text not null check (length(btrim(name)) between 1 and 120),
  cluster_key text not null check (cluster_key in ('1-2', '3-4', '5-6')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.students (
  workspace_id uuid not null,
  class_id text not null,
  id text not null check (length(id) between 1 and 120),
  display_name text not null check (length(btrim(display_name)) between 1 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, class_id, id),
  foreign key (workspace_id, class_id)
    references public.classes (workspace_id, id) on delete cascade
);

create index students_workspace_name_idx
  on public.students (workspace_id, display_name);

create table public.gym_schedule_slots (
  workspace_id uuid not null,
  id text not null check (length(id) between 1 and 120),
  class_id text not null,
  weekday smallint not null check (weekday between 1 and 7),
  start_period smallint not null check (start_period between 1 and 20),
  end_period smallint not null check (end_period between 1 and 20),
  primary key (workspace_id, id),
  foreign key (workspace_id, class_id)
    references public.classes (workspace_id, id) on delete cascade,
  check (end_period >= start_period)
);

create index gym_schedule_slots_class_idx
  on public.gym_schedule_slots (workspace_id, class_id, weekday, start_period);

-- Rubric content is versioned independently from assessments. System rubrics
-- have workspace_id null; future teacher-owned rubrics can belong to a
-- workspace without changing lessons or results.
create table public.rubrics (
  id text primary key check (length(id) between 1 and 120),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  slug text not null check (length(slug) between 1 and 120),
  title text not null check (length(btrim(title)) between 1 and 180),
  activity_form text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index rubrics_global_slug_idx
  on public.rubrics (slug) where workspace_id is null;
create unique index rubrics_workspace_slug_idx
  on public.rubrics (workspace_id, slug) where workspace_id is not null;

create table public.rubric_versions (
  id uuid primary key default gen_random_uuid(),
  rubric_id text not null references public.rubrics (id) on delete cascade,
  cluster_key text check (cluster_key in ('1-2', '3-4', '5-6')),
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index rubric_versions_identity_idx
  on public.rubric_versions (rubric_id, version_number, coalesce(cluster_key, 'all'));

create table public.rubric_domains (
  id uuid primary key default gen_random_uuid(),
  rubric_version_id uuid not null references public.rubric_versions (id) on delete cascade,
  domain_key text not null check (length(domain_key) between 1 and 80),
  title text not null,
  short_description text not null default '',
  sort_order smallint not null check (sort_order > 0),
  unique (rubric_version_id, domain_key),
  unique (rubric_version_id, sort_order)
);

create table public.rubric_levels (
  id uuid primary key default gen_random_uuid(),
  rubric_domain_id uuid not null references public.rubric_domains (id) on delete cascade,
  level_key text not null check (level_key in ('green', 'blue', 'red', 'purple', 'black')),
  sort_order smallint not null check (sort_order between 1 and 5),
  summary text not null,
  detail text not null,
  next_challenge text not null,
  unique (rubric_domain_id, level_key),
  unique (rubric_domain_id, sort_order)
);

create table public.lesson_series (
  workspace_id uuid not null,
  id text not null check (length(id) between 1 and 120),
  class_id text not null,
  rubric_id text not null references public.rubrics (id),
  rubric_version_id uuid references public.rubric_versions (id),
  include_together boolean not null default true,
  assessment_occurrence_key text,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, class_id)
    references public.classes (workspace_id, id) on delete cascade
);

create index lesson_series_class_idx
  on public.lesson_series (workspace_id, class_id, created_at desc);

create table public.lesson_occurrences (
  workspace_id uuid not null,
  series_id text not null,
  occurrence_key text not null,
  lesson_date date not null,
  slot_id text not null,
  start_period smallint not null check (start_period between 1 and 20),
  end_period smallint not null check (end_period between 1 and 20),
  sequence_number smallint not null check (sequence_number > 0),
  primary key (workspace_id, series_id, occurrence_key),
  foreign key (workspace_id, series_id)
    references public.lesson_series (workspace_id, id) on delete cascade,
  check (end_period >= start_period),
  unique (workspace_id, series_id, sequence_number)
);

create index lesson_occurrences_date_idx
  on public.lesson_occurrences (workspace_id, lesson_date, start_period);

create table public.lesson_sessions (
  workspace_id uuid not null,
  id text not null check (length(id) between 1 and 120),
  series_id text not null,
  occurrence_key text not null,
  mode text not null check (mode in ('display', 'assessment')),
  started_at timestamptz not null,
  ended_at timestamptz,
  primary key (workspace_id, id),
  foreign key (workspace_id, series_id, occurrence_key)
    references public.lesson_occurrences (workspace_id, series_id, occurrence_key)
    on delete cascade,
  check (ended_at is null or ended_at >= started_at)
);

create index lesson_sessions_occurrence_idx
  on public.lesson_sessions (workspace_id, series_id, occurrence_key, started_at desc);

create table public.agenda_exceptions (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  occurrence_key text not null,
  status text not null check (status in ('cancelled')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, occurrence_key)
);

create table public.report_periods (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  id text not null check (length(id) between 1 and 120),
  label text not null check (length(btrim(label)) between 1 and 120),
  start_date date not null,
  end_date date not null,
  primary key (workspace_id, id),
  check (end_date >= start_date)
);

create table public.assessments (
  workspace_id uuid not null,
  id text not null check (length(id) between 1 and 120),
  class_id text not null,
  student_id text not null,
  series_id text,
  occurrence_key text,
  rubric_id text not null references public.rubrics (id),
  rubric_version_id uuid references public.rubric_versions (id),
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, class_id, student_id)
    references public.students (workspace_id, class_id, id) on delete cascade,
  foreign key (workspace_id, series_id)
    references public.lesson_series (workspace_id, id) on delete restrict
);

create index assessments_student_timeline_idx
  on public.assessments (workspace_id, class_id, student_id, submitted_at desc);
create index assessments_rubric_timeline_idx
  on public.assessments (workspace_id, rubric_id, submitted_at desc);

create table public.assessment_scores (
  workspace_id uuid not null,
  assessment_id text not null,
  domain_key text not null check (length(domain_key) between 1 and 80),
  rubric_domain_id uuid references public.rubric_domains (id),
  self_level text check (self_level in ('green', 'blue', 'red', 'purple', 'black')),
  effective_level text check (effective_level in ('green', 'blue', 'red', 'purple', 'black')),
  was_adjusted boolean not null default false,
  primary key (workspace_id, assessment_id, domain_key),
  foreign key (workspace_id, assessment_id)
    references public.assessments (workspace_id, id) on delete cascade,
  check (self_level is not null or effective_level is not null)
);

-- Seed the currently published KanJam rubric as an immutable first version.
insert into public.rubrics (id, slug, title, activity_form, description, status)
values ('kanjam', 'kanjam', 'KanJam', 'Spel',
  'Gericht werpen, tactiek afspreken en samen spelen.', 'published');

do $$
declare
  version_id uuid;
  movement_id uuid;
  together_id uuid;
begin
  insert into public.rubric_versions
    (rubric_id, cluster_key, version_number, status, published_at)
  values ('kanjam', null, 1, 'published', now())
  returning id into version_id;

  insert into public.rubric_domains
    (rubric_version_id, domain_key, title, short_description, sort_order)
  values (version_id, 'movement', 'Leren bewegen',
    'Backhandworp richting de KanJam', 1)
  returning id into movement_id;

  insert into public.rubric_domains
    (rubric_version_id, domain_key, title, short_description, sort_order)
  values (version_id, 'together', 'Samen bewegen',
    'Afspreken, samenspelen en feedback geven', 2)
  returning id into together_id;

  insert into public.rubric_levels
    (rubric_domain_id, level_key, sort_order, summary, detail, next_challenge)
  values
    (movement_id, 'green', 1, 'Ik krijg de frisbee vooruit met een backhandworp.', 'Je staat zijwaarts en zwaait de frisbee met een rustige beweging vooruit. De frisbee komt in de speelrichting terecht.', 'Oefen een vlakke worp die op borsthoogte bij je medespeler aankomt.'),
    (movement_id, 'blue', 2, 'Ik werp de frisbee meestal vlak en in de richting van mijn medespeler.', 'Je gebruikt een backhandworp die meestal horizontaal blijft. Je medespeler kan de frisbee regelmatig verwerken.', 'Richt nauwkeuriger en pas de kracht aan verschillende afstanden aan.'),
    (movement_id, 'red', 3, 'Ik werp gericht en pas mijn worp aan de afstand aan.', 'Je kiest passende kracht en richting. Daardoor komt de frisbee vaak bruikbaar bij de KanJam of je medespeler.', 'Pas richting, hoogte en snelheid bewust aan de spelsituatie aan.'),
    (movement_id, 'purple', 4, 'Ik pas mijn worp bewust aan de positie van de KanJam en mijn medespeler aan.', 'Je kijkt vóór de worp, kiest een haalbare lijn en varieert gericht in kracht, hoogte en snelheid.', 'Maak onder tijdsdruk doelgerichte keuzes en blijf technisch stabiel.'),
    (movement_id, 'black', 5, 'Ik werp onder druk nauwkeurig en kies effectief voor de spelsituatie.', 'Je uitvoering blijft stabiel en je kiest zelfstandig de worp die de grootste kans op een score geeft.', 'Behoud dit niveau in wisselende situaties en help een ander met gerichte feedback.'),
    (together_id, 'green', 1, 'Ik speel mee en houd me aan de basisafspraken.', 'Je wacht op je beurt, blijft betrokken en volgt de afspraken die vooraf zijn gemaakt.', 'Maak samen één eenvoudige afspraak over richten of positie kiezen.'),
    (together_id, 'blue', 2, 'Ik maak eenvoudige afspraken en help mijn medespeler tijdens het spel.', 'Je overlegt kort, moedigt aan en zorgt dat jullie allebei actief mee kunnen doen.', 'Geef na een worp één concrete tip die je medespeler direct kan gebruiken.'),
    (together_id, 'red', 3, 'Ik stem tactiek af en geef bruikbare feedback.', 'Je bespreekt een plan, kijkt of het werkt en geeft specifieke feedback over de volgende poging.', 'Pas jullie afspraak tijdens het spel aan op wat je bij de tegenstander ziet.'),
    (together_id, 'purple', 4, 'Ik pas onze tactiek aan en help het team gerichter spelen.', 'Je herkent wat het spel nodig heeft, verdeelt rollen en gebruikt feedback om de volgende actie te verbeteren.', 'Coach kort en duidelijk, zodat je medespeler zelfstandig betere keuzes maakt.'),
    (together_id, 'black', 5, 'Ik versterk het samenspel met passende tactiek en gerichte coaching.', 'Je zorgt voor gezamenlijk eigenaarschap, past afspraken effectief aan en geeft feedback die zichtbaar tot beter spel leidt.', 'Blijf dit gedrag in nieuwe teams inzetten en geef ruimte aan ideeën van anderen.');
end $$;

create function private.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
    and exists (
      select 1
      from public.workspace_members member
      where member.workspace_id = target_workspace_id
        and member.user_id = (select auth.uid())
        and member.role = any (allowed_roles)
    );
$$;

create function private.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger workspaces_add_owner
after insert on public.workspaces
for each row execute function private.add_workspace_owner();

revoke all on function private.has_workspace_role(uuid, text[]) from public, anon;
revoke all on function private.add_workspace_owner() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;

revoke all on table public.workspaces, public.workspace_members from anon, authenticated;
grant select, insert on table public.workspaces to authenticated;
grant select on table public.workspace_members to authenticated;

create policy workspaces_select_member
on public.workspaces for select to authenticated
using (private.has_workspace_role(id, array['owner', 'admin', 'teacher', 'viewer']));

create policy workspaces_insert_personal
on public.workspaces for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and workspace_type = 'personal'
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
);

create policy workspace_members_select_self
on public.workspace_members for select to authenticated
using (
  user_id = (select auth.uid())
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
);

-- Apply the same least-privilege policies to all owner-managed product tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'teacher_settings', 'lesson_periods', 'classes', 'students',
    'gym_schedule_slots', 'lesson_series', 'lesson_occurrences',
    'lesson_sessions', 'agenda_exceptions', 'report_periods',
    'assessments', 'assessment_scores'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_workspace_role(workspace_id, array[''owner'', ''admin'', ''teacher'', ''viewer'']))',
      table_name || '_select_member', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.has_workspace_role(workspace_id, array[''owner'', ''admin'', ''teacher'']))',
      table_name || '_insert_editor', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.has_workspace_role(workspace_id, array[''owner'', ''admin'', ''teacher''])) with check (private.has_workspace_role(workspace_id, array[''owner'', ''admin'', ''teacher'']))',
      table_name || '_update_editor', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.has_workspace_role(workspace_id, array[''owner'', ''admin'', ''teacher'']))',
      table_name || '_delete_editor', table_name
    );
  end loop;
end $$;

-- Rubric tables are read-only from the browser in this iteration. A later
-- rubric importer can add write grants and owner policies deliberately.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'rubrics', 'rubric_versions', 'rubric_domains', 'rubric_levels'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
  end loop;
end $$;

create policy rubrics_select_available
on public.rubrics for select to authenticated
using (
  workspace_id is null
  or private.has_workspace_role(workspace_id, array['owner', 'admin', 'teacher', 'viewer'])
);

create policy rubric_versions_select_available
on public.rubric_versions for select to authenticated
using (exists (
  select 1 from public.rubrics rubric
  where rubric.id = rubric_versions.rubric_id
    and (
      rubric.workspace_id is null
      or private.has_workspace_role(rubric.workspace_id, array['owner', 'admin', 'teacher', 'viewer'])
    )
));

create policy rubric_domains_select_available
on public.rubric_domains for select to authenticated
using (exists (
  select 1
  from public.rubric_versions version
  join public.rubrics rubric on rubric.id = version.rubric_id
  where version.id = rubric_domains.rubric_version_id
    and (
      rubric.workspace_id is null
      or private.has_workspace_role(rubric.workspace_id, array['owner', 'admin', 'teacher', 'viewer'])
    )
));

create policy rubric_levels_select_available
on public.rubric_levels for select to authenticated
using (exists (
  select 1
  from public.rubric_domains domain
  join public.rubric_versions version on version.id = domain.rubric_version_id
  join public.rubrics rubric on rubric.id = version.rubric_id
  where domain.id = rubric_levels.rubric_domain_id
    and (
      rubric.workspace_id is null
      or private.has_workspace_role(rubric.workspace_id, array['owner', 'admin', 'teacher', 'viewer'])
    )
));

comment on schema private is
  'Internal helper functions only; this schema is not exposed through the Data API.';
