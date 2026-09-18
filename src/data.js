export const CLASS_CLUSTERS = [
  { key: '1-2', name: 'Onderbouw' },
  { key: '3-4', name: 'Middenbouw' },
  { key: '5-6', name: 'Bovenbouw' },
];

export const LEVELS = [
  { key: 'green', name: 'Groen', color: '#2f7d56' },
  { key: 'blue', name: 'Blauw', color: '#2f6f9f' },
  { key: 'red', name: 'Rood', color: '#b84242' },
  { key: 'purple', name: 'Paars', color: '#72508f' },
  { key: 'black', name: 'Zwart', color: '#202a33' },
];

export const RUBRICS = [{
  id: 'kanjam',
  title: 'KanJam',
  form: 'Spel',
  description: 'Gericht werpen, tactiek afspreken en samen spelen.',
  criteria: [
    {
      key: 'movement', title: 'Leren bewegen', short: 'Backhandworp richting de KanJam',
      levels: {
        green: { summary: 'Ik krijg de frisbee vooruit met een backhandworp.', detail: 'Je staat zijwaarts en zwaait de frisbee met een rustige beweging vooruit. De frisbee komt in de speelrichting terecht.', next: 'Oefen een vlakke worp die op borsthoogte bij je medespeler aankomt.' },
        blue: { summary: 'Ik werp de frisbee meestal vlak en in de richting van mijn medespeler.', detail: 'Je gebruikt een backhandworp die meestal horizontaal blijft. Je medespeler kan de frisbee regelmatig verwerken.', next: 'Richt nauwkeuriger en pas de kracht aan verschillende afstanden aan.' },
        red: { summary: 'Ik werp gericht en pas mijn worp aan de afstand aan.', detail: 'Je kiest passende kracht en richting. Daardoor komt de frisbee vaak bruikbaar bij de KanJam of je medespeler.', next: 'Pas richting, hoogte en snelheid bewust aan de spelsituatie aan.' },
        purple: { summary: 'Ik pas mijn worp bewust aan de positie van de KanJam en mijn medespeler aan.', detail: 'Je kijkt vóór de worp, kiest een haalbare lijn en varieert gericht in kracht, hoogte en snelheid.', next: 'Maak onder tijdsdruk doelgerichte keuzes en blijf technisch stabiel.' },
        black: { summary: 'Ik werp onder druk nauwkeurig en kies effectief voor de spelsituatie.', detail: 'Je uitvoering blijft stabiel en je kiest zelfstandig de worp die de grootste kans op een score geeft.', next: 'Behoud dit niveau in wisselende situaties en help een ander met gerichte feedback.' },
      },
    },
    {
      key: 'together', title: 'Samen bewegen', short: 'Afspreken, samenspelen en feedback geven',
      levels: {
        green: { summary: 'Ik speel mee en houd me aan de basisafspraken.', detail: 'Je wacht op je beurt, blijft betrokken en volgt de afspraken die vooraf zijn gemaakt.', next: 'Maak samen één eenvoudige afspraak over richten of positie kiezen.' },
        blue: { summary: 'Ik maak eenvoudige afspraken en help mijn medespeler tijdens het spel.', detail: 'Je overlegt kort, moedigt aan en zorgt dat jullie allebei actief mee kunnen doen.', next: 'Geef na een worp één concrete tip die je medespeler direct kan gebruiken.' },
        red: { summary: 'Ik stem tactiek af en geef bruikbare feedback.', detail: 'Je bespreekt een plan, kijkt of het werkt en geeft specifieke feedback over de volgende poging.', next: 'Pas jullie afspraak tijdens het spel aan op wat je bij de tegenstander ziet.' },
        purple: { summary: 'Ik pas onze tactiek aan en help het team gerichter spelen.', detail: 'Je herkent wat het spel nodig heeft, verdeelt rollen en gebruikt feedback om de volgende actie te verbeteren.', next: 'Coach kort en duidelijk, zodat je medespeler zelfstandig betere keuzes maakt.' },
        black: { summary: 'Ik versterk het samenspel met passende tactiek en gerichte coaching.', detail: 'Je zorgt voor gezamenlijk eigenaarschap, past afspraken effectief aan en geeft feedback die zichtbaar tot beter spel leidt.', next: 'Blijf dit gedrag in nieuwe teams inzetten en geef ruimte aan ideeën van anderen.' },
      },
    },
  ],
  media: { image: null, video: null },
}];

export const RUBRIC = RUBRICS[0].criteria;

export const DEMO_CLASSES = [
  { id: 'class-2a', name: '2A', cluster: '1-2', students: [
    { id: 's-amine', name: 'Amine El Idrissi' }, { id: 's-bo', name: 'Bo de Wit' },
    { id: 's-isa', name: 'Isa Jansen' }, { id: 's-lina', name: 'Lina Vermeer' },
    { id: 's-noud', name: 'Noud Bakker' },
  ] },
  { id: 'class-3b', name: '3B', cluster: '3-4', students: [
    { id: 's-aylin', name: 'Aylin Smit' }, { id: 's-daan', name: 'Daan Mulder' },
    { id: 's-jules', name: 'Jules Vos' }, { id: 's-mila', name: 'Mila Bos' },
  ] },
];

export const DEFAULT_PERIODS = [
  { number: 1, startTime: '08:30', endTime: '09:20' },
  { number: 2, startTime: '09:20', endTime: '10:10' },
  { number: 3, startTime: '10:25', endTime: '11:15' },
  { number: 4, startTime: '11:15', endTime: '12:05' },
  { number: 5, startTime: '12:35', endTime: '13:25' },
  { number: 6, startTime: '13:25', endTime: '14:15' },
  { number: 7, startTime: '14:15', endTime: '15:05' },
  { number: 8, startTime: '15:05', endTime: '15:55' },
];

export function createInitialData() {
  return {
    version: 2,
    settings: { schoolYearLabel: '2026–2027', schoolYearStart: '2026-08-01', schoolYearEnd: '2027-07-31' },
    classes: DEMO_CLASSES,
    lessonPeriods: DEFAULT_PERIODS,
    gymScheduleSlots: [
      { id: 'slot-2a-tue', classId: 'class-2a', weekday: 2, startPeriod: 3, endPeriod: 4 },
      { id: 'slot-2a-fri', classId: 'class-2a', weekday: 5, startPeriod: 5, endPeriod: 5 },
      { id: 'slot-3b-thu', classId: 'class-3b', weekday: 4, startPeriod: 4, endPeriod: 5 },
    ],
    lessonSeries: [{
      id: 'series-demo', classId: 'class-2a', rubricId: 'kanjam', includeTogether: true,
      occurrences: [
        { key: '2026-09-08|slot-2a-tue', date: '2026-09-08', slotId: 'slot-2a-tue', startPeriod: 3, endPeriod: 4 },
        { key: '2026-09-11|slot-2a-fri', date: '2026-09-11', slotId: 'slot-2a-fri', startPeriod: 5, endPeriod: 5 },
        { key: '2026-09-15|slot-2a-tue', date: '2026-09-15', slotId: 'slot-2a-tue', startPeriod: 3, endPeriod: 4 },
      ],
      assessmentOccurrenceKey: '2026-09-15|slot-2a-tue', createdAt: '2026-09-01T10:00:00.000Z',
    }],
    lessonSessions: [
      { id: 'session-demo-1', seriesId: 'series-demo', occurrenceKey: '2026-09-08|slot-2a-tue', mode: 'display', startedAt: '2026-09-08T08:25:00.000Z', endedAt: '2026-09-08T09:55:00.000Z' },
      { id: 'session-demo-2', seriesId: 'series-demo', occurrenceKey: '2026-09-11|slot-2a-fri', mode: 'display', startedAt: '2026-09-11T10:35:00.000Z', endedAt: '2026-09-11T11:25:00.000Z' },
      { id: 'session-demo-3', seriesId: 'series-demo', occurrenceKey: '2026-09-15|slot-2a-tue', mode: 'assessment', startedAt: '2026-09-15T08:25:00.000Z', endedAt: '2026-09-15T09:55:00.000Z' },
    ],
    agendaExceptions: [],
    reportPeriods: [],
    assessments: [
      { id: 'assessment-demo-1', classId: 'class-2a', studentId: 's-amine', rubricId: 'kanjam', seriesId: 'series-demo', occurrenceKey: '2026-09-15|slot-2a-tue', submittedAt: '2026-09-15T08:35:00.000Z', self: { movement: 'red', together: 'blue' }, effective: { movement: 'red', together: 'blue' }, adjusted: {} },
      { id: 'assessment-demo-2', classId: 'class-2a', studentId: 's-bo', rubricId: 'kanjam', seriesId: 'series-demo', occurrenceKey: '2026-09-15|slot-2a-tue', submittedAt: '2026-09-15T08:42:00.000Z', self: { movement: 'blue', together: 'red' }, effective: { movement: 'red', together: 'red' }, adjusted: { movement: true } },
    ],
  };
}

export function createEmptyData() {
  const base = createInitialData();
  return {
    ...base,
    classes: [],
    gymScheduleSlots: [],
    lessonSeries: [],
    lessonSessions: [],
    agendaExceptions: [],
    reportPeriods: [],
    assessments: [],
  };
}
