-- Rubrics LO pilot storage.
--
-- The complete versioned teacher workspace is intentionally stored in one row.
-- This keeps the pilot's existing local data model intact, makes each save
-- atomic, and gives the smallest possible RLS attack surface. Before a
-- multi-teacher school rollout, the JSON document can be normalized behind the
-- storage adapter without changing the user interface.

create table public.teacher_workspaces (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  schema_version smallint not null default 2,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_workspaces_schema_version_check
    check (schema_version between 2 and 99),
  constraint teacher_workspaces_data_object_check
    check (jsonb_typeof(data) = 'object')
);

comment on table public.teacher_workspaces is
  'One private, versioned Rubrics LO pilot workspace per authenticated teacher.';
comment on column public.teacher_workspaces.data is
  'Contains classes, students, schedules, lesson series, sessions and assessments.';

alter table public.teacher_workspaces enable row level security;
alter table public.teacher_workspaces force row level security;

-- Data API access is opt-in for this 2026 project. Anonymous visitors receive
-- no table privileges; authenticated teachers only receive the operations the
-- web application needs.
revoke all on table public.teacher_workspaces from anon, authenticated;
grant select, insert, update on table public.teacher_workspaces to authenticated;

create policy teacher_workspaces_select_own
on public.teacher_workspaces
for select
to authenticated
using (
  owner_id = (select auth.uid())
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
);

create policy teacher_workspaces_insert_own
on public.teacher_workspaces
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
);

create policy teacher_workspaces_update_own
on public.teacher_workspaces
for update
to authenticated
using (
  owner_id = (select auth.uid())
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
)
with check (
  owner_id = (select auth.uid())
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
);

-- Deliberately no DELETE grant or policy. Removing an account still cascades
-- from auth.users, while an accidental browser request cannot erase a complete
-- teacher workspace.
