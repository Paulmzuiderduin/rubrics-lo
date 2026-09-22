set local lock_timeout = '5s';

alter table public.rubrics
  drop column if exists activity_form;
