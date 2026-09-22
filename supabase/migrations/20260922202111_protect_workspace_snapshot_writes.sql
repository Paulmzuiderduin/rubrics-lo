-- The browser sends only changed entities. This avoids rebuilding every row
-- after a single edit and keeps assessment rubric-version references stable.
-- A workspace revision check prevents stale tabs from overwriting newer work.

-- Keep the current whole-snapshot RPC during the frontend cutover. The
-- application will switch to apply_personal_workspace_changes first; after
-- real-account verification, a separate cleanup migration can revoke and drop
-- the legacy writer. This preserves a rollback path during deployment.

create function private.apply_workspace_patch(
  target_workspace_id uuid,
  changes jsonb,
  target_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  nested_item jsonb;
  score_key text;
  selected_version_id uuid;
  selected_domain_id uuid;
  selected_settings jsonb;
begin
  -- Delete dependent assessment rows before their students, classes, or series.
  delete from public.assessments assessment
  where assessment.workspace_id = target_workspace_id
    and (
      assessment.id in (
        select jsonb_array_elements_text(coalesce(changes #> '{assessments,delete}', '[]'::jsonb))
      )
      or assessment.class_id in (
        select jsonb_array_elements_text(coalesce(changes #> '{classes,delete}', '[]'::jsonb))
      )
      or assessment.series_id in (
        select jsonb_array_elements_text(coalesce(changes #> '{lessonSeries,delete}', '[]'::jsonb))
      )
      or exists (
        select 1
        from jsonb_to_recordset(coalesce(changes #> '{students,delete}', '[]'::jsonb))
          as removed(class_id text, id text)
        where removed.class_id = assessment.class_id
          and removed.id = assessment.student_id
      )
    );

  delete from public.agenda_exceptions agenda_exception
  where agenda_exception.workspace_id = target_workspace_id
    and agenda_exception.occurrence_key in (
      select jsonb_array_elements_text(coalesce(changes #> '{agendaExceptions,delete}', '[]'::jsonb))
    );

  delete from public.lesson_sessions session
  where session.workspace_id = target_workspace_id
    and session.id in (
      select jsonb_array_elements_text(coalesce(changes #> '{lessonSessions,delete}', '[]'::jsonb))
    );

  delete from public.lesson_series series
  where series.workspace_id = target_workspace_id
    and series.id in (
      select jsonb_array_elements_text(coalesce(changes #> '{lessonSeries,delete}', '[]'::jsonb))
    );

  delete from public.gym_schedule_slots slot
  where slot.workspace_id = target_workspace_id
    and slot.id in (
      select jsonb_array_elements_text(coalesce(changes #> '{gymScheduleSlots,delete}', '[]'::jsonb))
    );

  delete from public.students student
  using jsonb_to_recordset(coalesce(changes #> '{students,delete}', '[]'::jsonb))
    as removed(class_id text, id text)
  where student.workspace_id = target_workspace_id
    and student.class_id = removed.class_id
    and student.id = removed.id;

  delete from public.classes class
  where class.workspace_id = target_workspace_id
    and class.id in (
      select jsonb_array_elements_text(coalesce(changes #> '{classes,delete}', '[]'::jsonb))
    );

  delete from public.lesson_periods period
  where period.workspace_id = target_workspace_id
    and period.period_number in (
      select value::smallint
      from jsonb_array_elements_text(coalesce(changes #> '{lessonPeriods,delete}', '[]'::jsonb)) as removed(value)
    );

  delete from public.report_periods period
  where period.workspace_id = target_workspace_id
    and period.id in (
      select jsonb_array_elements_text(coalesce(changes #> '{reportPeriods,delete}', '[]'::jsonb))
    );

  delete from public.lesson_occurrences occurrence
  where occurrence.workspace_id = target_workspace_id
    and exists (
      select 1
      from jsonb_to_recordset(coalesce(changes #> '{lessonOccurrences,delete}', '[]'::jsonb))
        as removed(series_id text, key text)
      where removed.series_id = occurrence.series_id
        and removed.key = occurrence.occurrence_key
    );

  selected_settings := changes -> 'settings';
  if selected_settings is not null and selected_settings <> 'null'::jsonb then
    insert into public.teacher_settings (
      workspace_id, schema_version, school_year_label, school_year_start, school_year_end, updated_at
    ) values (
      target_workspace_id,
      3,
      coalesce(nullif(selected_settings ->> 'schoolYearLabel', ''), 'Onbekend schooljaar'),
      coalesce(nullif(selected_settings ->> 'schoolYearStart', '')::date, current_date),
      coalesce(nullif(selected_settings ->> 'schoolYearEnd', '')::date, current_date),
      target_updated_at
    )
    on conflict (workspace_id) do update set
      schema_version = excluded.schema_version,
      school_year_label = excluded.school_year_label,
      school_year_start = excluded.school_year_start,
      school_year_end = excluded.school_year_end,
      updated_at = excluded.updated_at;
  else
    update public.teacher_settings
    set updated_at = target_updated_at
    where workspace_id = target_workspace_id;
  end if;

  for item in select value from jsonb_array_elements(coalesce(changes #> '{lessonPeriods,upsert}', '[]'::jsonb))
  loop
    insert into public.lesson_periods (workspace_id, period_number, start_time, end_time)
    values (target_workspace_id, (item ->> 'number')::smallint, (item ->> 'startTime')::time, (item ->> 'endTime')::time)
    on conflict (workspace_id, period_number) do update set
      start_time = excluded.start_time,
      end_time = excluded.end_time;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(changes #> '{classes,upsert}', '[]'::jsonb))
  loop
    insert into public.classes (workspace_id, id, name, cluster_key)
    values (target_workspace_id, item ->> 'id', item ->> 'name', coalesce(nullif(item ->> 'cluster', ''), '3-4'))
    on conflict (workspace_id, id) do update set
      name = excluded.name,
      cluster_key = excluded.cluster_key,
      updated_at = target_updated_at;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(changes #> '{students,upsert}', '[]'::jsonb))
  loop
    insert into public.students (workspace_id, class_id, id, display_name)
    values (target_workspace_id, item ->> 'classId', item ->> 'id', item ->> 'name')
    on conflict (workspace_id, class_id, id) do update set
      display_name = excluded.display_name,
      updated_at = target_updated_at;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(changes #> '{gymScheduleSlots,upsert}', '[]'::jsonb))
  loop
    insert into public.gym_schedule_slots (
      workspace_id, id, class_id, weekday, start_period, end_period
    ) values (
      target_workspace_id, item ->> 'id', item ->> 'classId',
      (item ->> 'weekday')::smallint, (item ->> 'startPeriod')::smallint, (item ->> 'endPeriod')::smallint
    )
    on conflict (workspace_id, id) do update set
      class_id = excluded.class_id,
      weekday = excluded.weekday,
      start_period = excluded.start_period,
      end_period = excluded.end_period;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(changes #> '{lessonSeries,upsert}', '[]'::jsonb))
  loop
    select version.id into selected_version_id
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
    )
    on conflict (workspace_id, id) do update set
      class_id = excluded.class_id,
      rubric_id = excluded.rubric_id,
      rubric_version_id = excluded.rubric_version_id,
      include_together = excluded.include_together,
      assessment_occurrence_key = excluded.assessment_occurrence_key;
  end loop;

  -- The application caps a series at six moments. Move the few affected rows
  -- out of the active sequence range first, so reordering cannot hit the
  -- unique (workspace, series, sequence_number) constraint mid-update.
  update public.lesson_occurrences occurrence
  set sequence_number = occurrence.sequence_number + 1000
  where occurrence.workspace_id = target_workspace_id
    and occurrence.series_id in (
      select jsonb_array_elements_text(coalesce(changes #> '{lessonOccurrences,affectedSeries}', '[]'::jsonb))
    );

  for item in select value from jsonb_array_elements(coalesce(changes #> '{lessonOccurrences,upsert}', '[]'::jsonb))
  loop
    insert into public.lesson_occurrences (
      workspace_id, series_id, occurrence_key, lesson_date, slot_id,
      start_period, end_period, sequence_number
    ) values (
      target_workspace_id,
      item ->> 'seriesId',
      item ->> 'key',
      (item ->> 'date')::date,
      item ->> 'slotId',
      (item ->> 'startPeriod')::smallint,
      (item ->> 'endPeriod')::smallint,
      coalesce(nullif(item ->> 'sequenceNumber', '')::smallint, 1)
    )
    on conflict (workspace_id, series_id, occurrence_key) do update set
      lesson_date = excluded.lesson_date,
      slot_id = excluded.slot_id,
      start_period = excluded.start_period,
      end_period = excluded.end_period,
      sequence_number = excluded.sequence_number;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(changes #> '{agendaExceptions,upsert}', '[]'::jsonb))
  loop
    insert into public.agenda_exceptions (workspace_id, occurrence_key, status)
    values (target_workspace_id, item ->> 'occurrenceKey', item ->> 'status')
    on conflict (workspace_id, occurrence_key) do update set status = excluded.status;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(changes #> '{lessonSessions,upsert}', '[]'::jsonb))
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
        target_workspace_id, item ->> 'id', item ->> 'seriesId', item ->> 'occurrenceKey',
        item ->> 'mode', (item ->> 'startedAt')::timestamptz, nullif(item ->> 'endedAt', '')::timestamptz
      )
      on conflict (workspace_id, id) do update set
        series_id = excluded.series_id,
        occurrence_key = excluded.occurrence_key,
        mode = excluded.mode,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at;
    end if;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(changes #> '{reportPeriods,upsert}', '[]'::jsonb))
  loop
    insert into public.report_periods (workspace_id, id, label, start_date, end_date)
    values (target_workspace_id, item ->> 'id', item ->> 'label', (item ->> 'startDate')::date, (item ->> 'endDate')::date)
    on conflict (workspace_id, id) do update set
      label = excluded.label,
      start_date = excluded.start_date,
      end_date = excluded.end_date;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(changes #> '{assessments,upsert}', '[]'::jsonb))
  loop
    select assessment.rubric_version_id into selected_version_id
    from public.assessments assessment
    where assessment.workspace_id = target_workspace_id and assessment.id = item ->> 'id';

    if selected_version_id is null then
      select version.id into selected_version_id
      from public.rubric_versions version
      join public.classes class
        on class.workspace_id = target_workspace_id
       and class.id = item ->> 'classId'
      where version.rubric_id = coalesce(nullif(item ->> 'rubricId', ''), 'kanjam')
        and version.status = 'published'
        and (version.cluster_key = class.cluster_key or version.cluster_key is null)
      order by (version.cluster_key is null), version.version_number desc
      limit 1;
    end if;

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
        where series.workspace_id = target_workspace_id and series.id = item ->> 'seriesId'
      ) then item ->> 'seriesId' else null end,
      nullif(item ->> 'occurrenceKey', ''),
      coalesce(nullif(item ->> 'rubricId', ''), 'kanjam'),
      selected_version_id,
      (item ->> 'submittedAt')::timestamptz
    )
    on conflict (workspace_id, id) do update set
      series_id = excluded.series_id,
      occurrence_key = excluded.occurrence_key,
      submitted_at = excluded.submitted_at;

    delete from public.assessment_scores score
    where score.workspace_id = target_workspace_id and score.assessment_id = item ->> 'id';

    for score_key in
      select distinct key
      from (
        select jsonb_object_keys(coalesce(item -> 'self', '{}'::jsonb)) as key
        union all
        select jsonb_object_keys(coalesce(item -> 'effective', '{}'::jsonb)) as key
      ) score_keys
    loop
      select domain.id into selected_domain_id
      from public.rubric_domains domain
      where domain.rubric_version_id = selected_version_id and domain.domain_key = score_key;

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
end;
$$;

revoke all on function private.apply_workspace_patch(uuid, jsonb, timestamptz)
  from public, anon, authenticated;

create function private.apply_current_workspace_changes(
  changes jsonb,
  expected_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_workspace_id uuid;
  current_updated_at timestamptz;
  saved_at timestamptz;
begin
  if caller_id is null
     or coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) then
    raise exception 'Authenticatie vereist.' using errcode = '42501';
  end if;

  if changes is null or jsonb_typeof(changes) <> 'object' then
    raise exception 'De wijzigingen moeten een JSON-object zijn.' using errcode = '22023';
  end if;

  if octet_length(changes::text) > 10485760 then
    raise exception 'De wijzigingen zijn groter dan 10 MB.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 64192026)
  );

  select workspace.id, workspace.updated_at
    into target_workspace_id, current_updated_at
  from public.workspaces workspace
  where workspace.owner_user_id = caller_id and workspace.workspace_type = 'personal'
  for update;

  if current_updated_at is distinct from expected_updated_at then
    raise exception 'Deze werkomgeving is ondertussen gewijzigd. De lokale wijzigingen zijn behouden; exporteer ze voordat u de nieuwste versie opnieuw laadt.'
      using errcode = '40001';
  end if;

  saved_at := pg_catalog.clock_timestamp();
  insert into public.workspaces (owner_user_id, name, workspace_type, updated_at)
  values (caller_id, 'Mijn werkomgeving', 'personal', saved_at)
  on conflict (owner_user_id) where workspace_type = 'personal'
  do update set updated_at = excluded.updated_at
  returning id into target_workspace_id;

  perform private.apply_workspace_patch(target_workspace_id, changes, saved_at);
  return saved_at;
end;
$$;

revoke all on function private.apply_current_workspace_changes(jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function private.apply_current_workspace_changes(jsonb, timestamptz)
  to authenticated;

create function public.apply_personal_workspace_changes(
  changes jsonb,
  expected_updated_at timestamptz
)
returns table (updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  saved_at timestamptz;
begin
  if caller_id is null
     or coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) then
    raise exception 'Authenticatie vereist.' using errcode = '42501';
  end if;

  saved_at := private.apply_current_workspace_changes(changes, expected_updated_at);
  return query select saved_at;
end;
$$;

revoke all on function public.apply_personal_workspace_changes(jsonb, timestamptz)
  from public, anon;
grant execute on function public.apply_personal_workspace_changes(jsonb, timestamptz)
  to authenticated;

comment on function public.apply_personal_workspace_changes(jsonb, timestamptz) is
  'Applies only changed personal-workspace entities for the authenticated owner, and rejects stale workspace revisions.';
