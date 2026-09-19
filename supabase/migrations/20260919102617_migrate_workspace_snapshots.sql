-- Transactional bridge from the legacy per-user JSON document to the
-- normalized workspace model. The browser switches to the RPCs below before
-- teacher_workspaces is removed in a later migration.

create function private.replace_workspace_snapshot(
  target_owner uuid,
  payload jsonb,
  target_updated_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  item jsonb;
  nested_item jsonb;
  score_key text;
  selected_version_id uuid;
  selected_domain_id uuid;
  occurrence_order integer;
begin
  if target_owner is null then
    raise exception 'Een eigenaar is verplicht.' using errcode = '22023';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'De werkomgeving moet een JSON-object zijn.' using errcode = '22023';
  end if;

  insert into public.workspaces (owner_user_id, name, workspace_type, updated_at)
  values (target_owner, 'Mijn werkomgeving', 'personal', target_updated_at)
  on conflict (owner_user_id) where workspace_type = 'personal'
  do update set updated_at = excluded.updated_at
  returning id into target_workspace_id;

  -- Delete dependent rows first. The whole replacement runs in one database
  -- transaction, so readers never observe a half-written workspace.
  delete from public.assessments where workspace_id = target_workspace_id;
  delete from public.classes where workspace_id = target_workspace_id;
  delete from public.lesson_periods where workspace_id = target_workspace_id;
  delete from public.agenda_exceptions where workspace_id = target_workspace_id;
  delete from public.report_periods where workspace_id = target_workspace_id;
  delete from public.teacher_settings where workspace_id = target_workspace_id;

  insert into public.teacher_settings (
    workspace_id,
    schema_version,
    school_year_label,
    school_year_start,
    school_year_end,
    updated_at
  ) values (
    target_workspace_id,
    3,
    coalesce(nullif(payload #>> '{settings,schoolYearLabel}', ''), 'Onbekend schooljaar'),
    coalesce(nullif(payload #>> '{settings,schoolYearStart}', '')::date, current_date),
    coalesce(nullif(payload #>> '{settings,schoolYearEnd}', '')::date, current_date),
    target_updated_at
  );

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'lessonPeriods', '[]'::jsonb))
  loop
    insert into public.lesson_periods (workspace_id, period_number, start_time, end_time)
    values (
      target_workspace_id,
      (item ->> 'number')::smallint,
      (item ->> 'startTime')::time,
      (item ->> 'endTime')::time
    );
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'classes', '[]'::jsonb))
  loop
    insert into public.classes (workspace_id, id, name, cluster_key)
    values (
      target_workspace_id,
      item ->> 'id',
      item ->> 'name',
      coalesce(nullif(item ->> 'cluster', ''), '3-4')
    );

    for nested_item in
      select value from jsonb_array_elements(coalesce(item -> 'students', '[]'::jsonb))
    loop
      insert into public.students (workspace_id, class_id, id, display_name)
      values (
        target_workspace_id,
        item ->> 'id',
        nested_item ->> 'id',
        nested_item ->> 'name'
      );
    end loop;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'gymScheduleSlots', '[]'::jsonb))
  loop
    insert into public.gym_schedule_slots (
      workspace_id, id, class_id, weekday, start_period, end_period
    ) values (
      target_workspace_id,
      item ->> 'id',
      item ->> 'classId',
      (item ->> 'weekday')::smallint,
      (item ->> 'startPeriod')::smallint,
      (item ->> 'endPeriod')::smallint
    );
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'lessonSeries', '[]'::jsonb))
  loop
    select version.id
      into selected_version_id
    from public.rubric_versions version
    join public.classes class
      on class.workspace_id = target_workspace_id
     and class.id = item ->> 'classId'
    where version.rubric_id = coalesce(nullif(item ->> 'rubricId', ''), 'kanjam')
      and version.status = 'published'
      and (version.cluster_key = class.cluster_key or version.cluster_key is null)
    order by (version.cluster_key is null), version.version_number desc
    limit 1;

    insert into public.lesson_series (
      workspace_id, id, class_id, rubric_id, rubric_version_id,
      include_together, assessment_occurrence_key, created_at
    ) values (
      target_workspace_id,
      item ->> 'id',
      item ->> 'classId',
      coalesce(nullif(item ->> 'rubricId', ''), 'kanjam'),
      selected_version_id,
      coalesce((item ->> 'includeTogether')::boolean, true),
      nullif(item ->> 'assessmentOccurrenceKey', ''),
      coalesce(nullif(item ->> 'createdAt', '')::timestamptz, target_updated_at)
    );

    occurrence_order := 0;
    for nested_item in
      select value from jsonb_array_elements(coalesce(item -> 'occurrences', '[]'::jsonb))
    loop
      occurrence_order := occurrence_order + 1;
      insert into public.lesson_occurrences (
        workspace_id, series_id, occurrence_key, lesson_date, slot_id,
        start_period, end_period, sequence_number
      ) values (
        target_workspace_id,
        item ->> 'id',
        nested_item ->> 'key',
        (nested_item ->> 'date')::date,
        nested_item ->> 'slotId',
        (nested_item ->> 'startPeriod')::smallint,
        (nested_item ->> 'endPeriod')::smallint,
        occurrence_order
      );
    end loop;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'lessonSessions', '[]'::jsonb))
  loop
    if exists (
      select 1 from public.lesson_occurrences occurrence
      where occurrence.workspace_id = target_workspace_id
        and occurrence.series_id = item ->> 'seriesId'
        and occurrence.occurrence_key = item ->> 'occurrenceKey'
    ) then
      insert into public.lesson_sessions (
        workspace_id, id, series_id, occurrence_key, mode, started_at, ended_at
      ) values (
        target_workspace_id,
        item ->> 'id',
        item ->> 'seriesId',
        item ->> 'occurrenceKey',
        item ->> 'mode',
        (item ->> 'startedAt')::timestamptz,
        nullif(item ->> 'endedAt', '')::timestamptz
      );
    end if;
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'agendaExceptions', '[]'::jsonb))
  loop
    insert into public.agenda_exceptions (workspace_id, occurrence_key, status)
    values (target_workspace_id, item ->> 'occurrenceKey', item ->> 'status');
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'reportPeriods', '[]'::jsonb))
  loop
    insert into public.report_periods (
      workspace_id, id, label, start_date, end_date
    ) values (
      target_workspace_id,
      item ->> 'id',
      item ->> 'label',
      (item ->> 'startDate')::date,
      (item ->> 'endDate')::date
    );
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'assessments', '[]'::jsonb))
  loop
    select version.id
      into selected_version_id
    from public.rubric_versions version
    join public.classes class
      on class.workspace_id = target_workspace_id
     and class.id = item ->> 'classId'
    where version.rubric_id = coalesce(nullif(item ->> 'rubricId', ''), 'kanjam')
      and version.status = 'published'
      and (version.cluster_key = class.cluster_key or version.cluster_key is null)
    order by (version.cluster_key is null), version.version_number desc
    limit 1;

    insert into public.assessments (
      workspace_id, id, class_id, student_id, series_id, occurrence_key,
      rubric_id, rubric_version_id, submitted_at
    ) values (
      target_workspace_id,
      item ->> 'id',
      item ->> 'classId',
      item ->> 'studentId',
      case when exists (
        select 1 from public.lesson_series series
        where series.workspace_id = target_workspace_id
          and series.id = item ->> 'seriesId'
      ) then item ->> 'seriesId' else null end,
      nullif(item ->> 'occurrenceKey', ''),
      coalesce(nullif(item ->> 'rubricId', ''), 'kanjam'),
      selected_version_id,
      (item ->> 'submittedAt')::timestamptz
    );

    for score_key in
      select distinct key
      from (
        select jsonb_object_keys(coalesce(item -> 'self', '{}'::jsonb)) as key
        union all
        select jsonb_object_keys(coalesce(item -> 'effective', '{}'::jsonb)) as key
      ) score_keys
    loop
      select domain.id
        into selected_domain_id
      from public.rubric_domains domain
      where domain.rubric_version_id = selected_version_id
        and domain.domain_key = score_key;

      if nullif(item #>> array['self', score_key], '') is not null
         or nullif(item #>> array['effective', score_key], '') is not null then
        insert into public.assessment_scores (
          workspace_id, assessment_id, domain_key, rubric_domain_id,
          self_level, effective_level, was_adjusted
        ) values (
          target_workspace_id,
          item ->> 'id',
          score_key,
          selected_domain_id,
          nullif(item #>> array['self', score_key], ''),
          nullif(item #>> array['effective', score_key], ''),
          coalesce((item #>> array['adjusted', score_key])::boolean, false)
        );
      end if;
    end loop;
  end loop;

  return target_workspace_id;
end;
$$;

revoke all on function private.replace_workspace_snapshot(uuid, jsonb, timestamptz)
  from public, anon, authenticated;

create function public.save_personal_workspace_snapshot(payload jsonb)
returns table (updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  saved_at timestamptz := now();
begin
  if caller_id is null
     or coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) then
    raise exception 'Authenticatie vereist.' using errcode = '42501';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'De werkomgeving moet een JSON-object zijn.' using errcode = '22023';
  end if;

  if octet_length(payload::text) > 10485760 then
    raise exception 'De werkomgeving is groter dan 10 MB.' using errcode = '22023';
  end if;

  perform private.replace_workspace_snapshot(caller_id, payload, saved_at);
  return query select saved_at;
end;
$$;

revoke all on function public.save_personal_workspace_snapshot(jsonb)
  from public, anon, authenticated;
grant execute on function public.save_personal_workspace_snapshot(jsonb)
  to authenticated;

create function public.load_personal_workspace_snapshot()
returns table (data jsonb, schema_version smallint, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with current_workspace as (
    select workspace.id
    from public.workspaces workspace
    join public.workspace_members member
      on member.workspace_id = workspace.id
    where member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin', 'teacher', 'viewer')
      and workspace.workspace_type = 'personal'
    order by workspace.created_at
    limit 1
  )
  select
    jsonb_build_object(
      'version', 3,
      'settings', jsonb_build_object(
        'schoolYearLabel', settings.school_year_label,
        'schoolYearStart', settings.school_year_start,
        'schoolYearEnd', settings.school_year_end
      ),
      'classes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', class.id,
          'name', class.name,
          'cluster', class.cluster_key,
          'students', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', student.id,
              'name', student.display_name
            ) order by student.display_name, student.id)
            from public.students student
            where student.workspace_id = class.workspace_id
              and student.class_id = class.id
          ), '[]'::jsonb)
        ) order by class.name, class.id)
        from public.classes class
        where class.workspace_id = workspace.id
      ), '[]'::jsonb),
      'lessonPeriods', coalesce((
        select jsonb_agg(jsonb_build_object(
          'number', period.period_number,
          'startTime', to_char(period.start_time, 'HH24:MI'),
          'endTime', to_char(period.end_time, 'HH24:MI')
        ) order by period.period_number)
        from public.lesson_periods period
        where period.workspace_id = workspace.id
      ), '[]'::jsonb),
      'gymScheduleSlots', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', slot.id,
          'classId', slot.class_id,
          'weekday', slot.weekday,
          'startPeriod', slot.start_period,
          'endPeriod', slot.end_period
        ) order by slot.weekday, slot.start_period, slot.id)
        from public.gym_schedule_slots slot
        where slot.workspace_id = workspace.id
      ), '[]'::jsonb),
      'lessonSeries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', series.id,
          'classId', series.class_id,
          'rubricId', series.rubric_id,
          'includeTogether', series.include_together,
          'assessmentOccurrenceKey', series.assessment_occurrence_key,
          'createdAt', series.created_at,
          'occurrences', coalesce((
            select jsonb_agg(jsonb_build_object(
              'key', occurrence.occurrence_key,
              'date', occurrence.lesson_date,
              'slotId', occurrence.slot_id,
              'startPeriod', occurrence.start_period,
              'endPeriod', occurrence.end_period
            ) order by occurrence.sequence_number)
            from public.lesson_occurrences occurrence
            where occurrence.workspace_id = series.workspace_id
              and occurrence.series_id = series.id
          ), '[]'::jsonb)
        ) order by series.created_at, series.id)
        from public.lesson_series series
        where series.workspace_id = workspace.id
      ), '[]'::jsonb),
      'lessonSessions', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', session.id,
          'seriesId', session.series_id,
          'occurrenceKey', session.occurrence_key,
          'mode', session.mode,
          'startedAt', session.started_at,
          'endedAt', session.ended_at
        )) order by session.started_at, session.id)
        from public.lesson_sessions session
        where session.workspace_id = workspace.id
      ), '[]'::jsonb),
      'agendaExceptions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'occurrenceKey', exception.occurrence_key,
          'status', exception.status
        ) order by exception.occurrence_key)
        from public.agenda_exceptions exception
        where exception.workspace_id = workspace.id
      ), '[]'::jsonb),
      'reportPeriods', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', period.id,
          'label', period.label,
          'startDate', period.start_date,
          'endDate', period.end_date
        ) order by period.start_date, period.id)
        from public.report_periods period
        where period.workspace_id = workspace.id
      ), '[]'::jsonb),
      'assessments', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', assessment.id,
          'classId', assessment.class_id,
          'studentId', assessment.student_id,
          'rubricId', assessment.rubric_id,
          'seriesId', assessment.series_id,
          'occurrenceKey', assessment.occurrence_key,
          'submittedAt', assessment.submitted_at,
          'self', coalesce((
            select jsonb_object_agg(score.domain_key, score.self_level)
            from public.assessment_scores score
            where score.workspace_id = assessment.workspace_id
              and score.assessment_id = assessment.id
              and score.self_level is not null
          ), '{}'::jsonb),
          'effective', coalesce((
            select jsonb_object_agg(score.domain_key, score.effective_level)
            from public.assessment_scores score
            where score.workspace_id = assessment.workspace_id
              and score.assessment_id = assessment.id
              and score.effective_level is not null
          ), '{}'::jsonb),
          'adjusted', coalesce((
            select jsonb_object_agg(score.domain_key, true)
            from public.assessment_scores score
            where score.workspace_id = assessment.workspace_id
              and score.assessment_id = assessment.id
              and score.was_adjusted
          ), '{}'::jsonb)
        )) order by assessment.submitted_at, assessment.id)
        from public.assessments assessment
        where assessment.workspace_id = workspace.id
      ), '[]'::jsonb)
    ) as data,
    settings.schema_version,
    settings.updated_at
  from current_workspace workspace
  join public.teacher_settings settings on settings.workspace_id = workspace.id;
$$;

revoke all on function public.load_personal_workspace_snapshot()
  from public, anon, authenticated;
grant execute on function public.load_personal_workspace_snapshot()
  to authenticated;

-- Keep production writes from the currently deployed JSON client synchronized
-- until the RPC-based client has been deployed and verified.
create function private.sync_legacy_teacher_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.replace_workspace_snapshot(new.owner_id, new.data, new.updated_at);
  return new;
end;
$$;

revoke all on function private.sync_legacy_teacher_workspace()
  from public, anon, authenticated;

create trigger teacher_workspaces_sync_normalized
after insert or update of data, updated_at on public.teacher_workspaces
for each row execute function private.sync_legacy_teacher_workspace();

-- Migrate every existing owner inside this same transaction. Any invalid row
-- aborts the migration instead of leaving a partially converted workspace.
do $$
declare
  legacy_row record;
begin
  for legacy_row in
    select owner_id, data, updated_at
    from public.teacher_workspaces
  loop
    perform private.replace_workspace_snapshot(
      legacy_row.owner_id,
      legacy_row.data,
      legacy_row.updated_at
    );
  end loop;
end $$;

comment on function public.save_personal_workspace_snapshot(jsonb) is
  'Transitional atomic API for the single-user pilot. Ownership is always derived from auth.uid().';
comment on function public.load_personal_workspace_snapshot() is
  'Builds the current client shape from normalized relational rows.';
