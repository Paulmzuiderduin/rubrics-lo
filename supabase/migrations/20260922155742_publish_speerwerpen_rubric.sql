-- Publish the Speerwerpen rubric that is already available in the application
-- catalog. Lesson series and assessments reference this catalog through foreign
-- keys, so every selectable rubric needs a matching published database version.

insert into public.rubrics (
  id, slug, title, activity_form, description, status
) values (
  'speerwerpen',
  'speerwerpen',
  'Speerwerpen',
  'Atletiek',
  'Aanloop en afworp verbinden, de speer gericht laten landen en veilig samenwerken.',
  'published'
) on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  activity_form = excluded.activity_form,
  description = excluded.description,
  status = excluded.status,
  updated_at = now();

do $$
declare
  version_id uuid;
  approach_release_id uuid;
  landing_id uuid;
  together_id uuid;
begin
  select id into version_id
  from public.rubric_versions
  where rubric_id = 'speerwerpen'
    and cluster_key is null
    and version_number = 1;

  if version_id is null then
    insert into public.rubric_versions (
      rubric_id, cluster_key, version_number, status, published_at
    ) values (
      'speerwerpen', null, 1, 'published', now()
    ) returning id into version_id;
  else
    update public.rubric_versions
    set status = 'published', published_at = coalesce(published_at, now())
    where id = version_id;
  end if;

  insert into public.rubric_domains (
    rubric_version_id, domain_key, title, short_description, sort_order
  ) values (
    version_id,
    'approach-release',
    'Aanloop & afworp',
    'De aanloop verbinden aan een vloeiende afworp',
    1
  ) on conflict (rubric_version_id, domain_key) do update set
    title = excluded.title,
    short_description = excluded.short_description,
    sort_order = excluded.sort_order
  returning id into approach_release_id;

  insert into public.rubric_domains (
    rubric_version_id, domain_key, title, short_description, sort_order
  ) values (
    version_id,
    'landing',
    'Landing',
    'De speer in het verlengde van de werprichting laten landen',
    2
  ) on conflict (rubric_version_id, domain_key) do update set
    title = excluded.title,
    short_description = excluded.short_description,
    sort_order = excluded.sort_order
  returning id into landing_id;

  insert into public.rubric_domains (
    rubric_version_id, domain_key, title, short_description, sort_order
  ) values (
    version_id,
    'together',
    'Samen bewegen',
    'Rekening houden met anderen en gerichte feedback geven',
    3
  ) on conflict (rubric_version_id, domain_key) do update set
    title = excluded.title,
    short_description = excluded.short_description,
    sort_order = excluded.sort_order
  returning id into together_id;

  insert into public.rubric_levels (
    rubric_domain_id, level_key, sort_order, summary, detail, next_challenge
  ) values
    (approach_release_id, 'green', 1,
      'Ik werp de speer uit stand.',
      'Je werpt de speer uit stand en richt je op een veilige, voorwaartse afworp.',
      'Werp vanuit een driepas en probeer de aanloop met de afworp te verbinden.'),
    (approach_release_id, 'blue', 2,
      'Ik werp de speer vanuit een driepas. De aanloop en afworp zijn nog twee losse elementen.',
      'Je gebruikt een aansluitpas of kruispas, maar onderbreekt de beweging nog vóór de afworp.',
      'Verbind de driepas en afworp tot één natuurlijk vloeiende beweging.'),
    (approach_release_id, 'red', 3,
      'Ik werp de speer in een natuurlijk vloeiende beweging vanuit de driepas.',
      'Je verbindt een aansluitpas of kruispas zonder duidelijke onderbreking aan de afworp.',
      'Behoud deze vloeiende beweging vanuit een langere aanloop.'),
    (approach_release_id, 'purple', 4,
      'Ik werp de speer in een natuurlijk vloeiende beweging vanuit een langere aanloop.',
      'Je bouwt de aanloop uit en houdt de overgang naar de afworp vloeiend.',
      'Gebruik de opgebouwde snelheid uit de aanloop om de speer krachtiger te lanceren.'),
    (approach_release_id, 'black', 5,
      'Ik gebruik de snelheid van mijn aanloop in een natuurlijk vloeiende beweging om de speer te lanceren.',
      'Je zet de snelheid uit de aanloop doelgericht om in een vloeiende en krachtige afworp.',
      'Behoud deze uitvoering bij verschillende aanlooplengtes en onder wisselende omstandigheden.'),
    (landing_id, 'green', 1,
      'De achterkant van mijn speer raakt eerst de grond en de speer ligt niet in het verlengde van de werprichting.',
      'De speer landt met de achterkant eerst en wijkt duidelijk af van de werprichting.',
      'Laat de speer meer in het verlengde van de werprichting landen.'),
    (landing_id, 'blue', 2,
      'De achterkant van mijn speer raakt als eerste de grond.',
      'De speer beweegt al gerichter, maar landt nog met de achterkant eerst.',
      'Laat de speer vlak landen, met voor- en achterkant ongeveer tegelijk.'),
    (landing_id, 'red', 3,
      'Mijn speer komt plat op de grond terecht.',
      'De speer landt vlak, zonder dat de voorkant duidelijk als eerste de grond raakt.',
      'Zorg dat de voorkant van de speer als eerste de grond raakt.'),
    (landing_id, 'purple', 4,
      'De voorkant van mijn speer raakt als eerste de grond, maar de speer ligt uiteindelijk plat.',
      'De punt raakt eerst de grond, maar blijft nog niet in de bodem staan.',
      'Laat de voorkant onder ongeveer 45 graden in de grond steken.'),
    (landing_id, 'black', 5,
      'De voorkant van mijn speer steekt onder een hoek van ongeveer 45 graden in de grond.',
      'De speer landt met de voorkant eerst en blijft onder ongeveer 45 graden in de grond staan.',
      'Behoud deze landing bij verschillende afstanden en worpen.'),
    (together_id, 'green', 1,
      'Ik heb nog te weinig aandacht voor medeleerlingen om rekening met hen te houden en hen te helpen.',
      'Je aandacht ligt vooral bij je eigen uitvoering, waardoor veilig samenwerken en helpen nog weinig zichtbaar zijn.',
      'Let bewust op de veiligheid en ruimte van medeleerlingen.'),
    (together_id, 'blue', 2,
      'Ik houd rekening met medeleerlingen, maar heb nog weinig tips om hen te helpen.',
      'Je houdt voldoende rekening met anderen, maar geeft nog weinig bruikbare feedback.',
      'Geef een medeleerling één concrete tip over de uitvoering.'),
    (together_id, 'red', 3,
      'Ik houd rekening met medeleerlingen en help hen wanneer dat nodig is.',
      'Je werkt veilig samen en biedt hulp wanneer een medeleerling die nodig heeft.',
      'Geef vaker een gerichte tip die een medeleerling direct kan toepassen.'),
    (together_id, 'purple', 4,
      'Ik houd rekening met medeleerlingen en help hen bij verschillende sporten met tips.',
      'Je hebt aandacht voor anderen en geeft bij meerdere activiteiten bruikbare feedback.',
      'Geef zowel een concreet verbeterpunt als een benoemd sterk punt.'),
    (together_id, 'black', 5,
      'Ik houd rekening met medeleerlingen en help hen graag met gerichte tips en tops.',
      'Je werkt veilig en betrokken samen en geeft anderen concrete verbeterpunten en positieve feedback.',
      'Blijf je feedback afstemmen op wat een medeleerling op dat moment nodig heeft.')
  on conflict (rubric_domain_id, level_key) do update set
    sort_order = excluded.sort_order,
    summary = excluded.summary,
    detail = excluded.detail,
    next_challenge = excluded.next_challenge;
end $$;
