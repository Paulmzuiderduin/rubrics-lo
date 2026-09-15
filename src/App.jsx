import { useEffect, useMemo, useState } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import {
  ArrowLeft, BookOpenCheck, Check, ChevronRight, ClipboardList, FileSpreadsheet,
  FileText, GraduationCap, Layers3, Plus, Printer, Search, Settings2, Users, X,
} from 'lucide-react';
import { DEMO_ASSESSMENTS, DEMO_CLASSES, LEVELS, RUBRIC } from './data.js';
import { guessMapping, latestAssessment, normalizeSheet, parseCsv, studentsFromRows } from './utils.mjs';

const STORAGE_KEY = 'rubrics-lo-pilot-v1';
const NAV = [
  { key: 'classes', label: 'Klassen', icon: GraduationCap },
  { key: 'lessons', label: 'Lessen', icon: Layers3 },
  { key: 'results', label: 'Resultaten', icon: ClipboardList },
  { key: 'reports', label: 'Rapporten', icon: FileText },
];

const freshState = () => ({ classes: DEMO_CLASSES, assessments: DEMO_ASSESSMENTS });

function useStoredState() {
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || freshState(); }
    catch { return freshState(); }
  });
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data)), [data]);
  return [data, setData];
}

const levelFor = (key) => LEVELS.find((level) => level.key === key);
const dateLabel = (date) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));

function ColorTag({ value, small = false }) {
  const level = levelFor(value);
  if (!level) return <span className="empty-value">Nog niet ingevuld</span>;
  return <span className={small ? 'color-tag small' : 'color-tag'} style={{ '--level-color': level.color }}>{level.name}</span>;
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small>Kan per les worden aan- of uitgezet.</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle" aria-hidden="true" />
    </label>
  );
}

function Modal({ title, description, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={wide ? 'modal wide' : 'modal'} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Sluiten"><X size={20} /></button></header>
        {children}
      </section>
    </div>
  );
}

function Sidebar({ active, onChange }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onChange('classes')}><BookOpenCheck size={21} /><span>Rubrics LO</span></button>
      <nav aria-label="Hoofdnavigatie">
        {NAV.map(({ key, label, icon: Icon }) => <button key={key} className={active === key ? 'nav-item active' : 'nav-item'} onClick={() => onChange(key)}><Icon size={18} /><span>{label}</span></button>)}
      </nav>
      <div className="sidebar-meta">Pilot · lokaal opgeslagen</div>
    </aside>
  );
}

function EmptyState({ title, children, action }) {
  return <div className="empty-state"><div className="empty-icon"><ClipboardList size={22} /></div><h2>{title}</h2><p>{children}</p>{action}</div>;
}

function AddClassModal({ onClose, onCreate }) {
  const [mode, setMode] = useState('manual');
  const [className, setClassName] = useState('');
  const [names, setNames] = useState('');
  const [sheet, setSheet] = useState(null);
  const [mapping, setMapping] = useState({ name: -1, firstName: -1, lastName: -1, className: -1 });
  const [error, setError] = useState('');

  const importedStudents = sheet ? studentsFromRows(sheet.rows, mapping) : [];
  async function loadFile(file) {
    setError('');
    try {
      const raw = file.name.toLowerCase().endsWith('.csv') ? parseCsv(await file.text()) : await readXlsxFile(file);
      const normalized = normalizeSheet(raw);
      if (!normalized.headers.length || !normalized.rows.length) throw new Error('Geen gegevens gevonden.');
      setSheet(normalized); setMapping(guessMapping(normalized.headers));
    } catch (caught) { setError(caught.message || 'Dit bestand kon niet worden gelezen.'); }
  }
  function submit(event) {
    event.preventDefault();
    const manualStudents = names.split(/\r?\n|,/).map((name) => name.trim()).filter(Boolean).map((name, index) => ({ id: `student-${Date.now()}-${index}`, name }));
    const students = mode === 'manual' ? manualStudents : importedStudents;
    if (!className.trim()) return setError('Vul een klasnaam in.');
    if (!students.length) return setError('Voeg minimaal één leerling toe.');
    onCreate({ id: `class-${Date.now()}`, name: className.trim(), students: students.sort((a, b) => a.name.localeCompare(b.name, 'nl')), lessons: [] });
  }
  return (
    <Modal title="Klas toevoegen" description="Voeg namen handmatig toe of importeer een Excel/CSV-klassenlijst." onClose={onClose} wide>
      <form onSubmit={submit}>
        <label className="field"><span>Klasnaam</span><input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Bijvoorbeeld 2C" autoFocus /></label>
        <div className="segmented"><button type="button" className={mode === 'manual' ? 'selected' : ''} onClick={() => setMode('manual')}>Handmatig</button><button type="button" className={mode === 'import' ? 'selected' : ''} onClick={() => setMode('import')}>Excel of CSV</button></div>
        {mode === 'manual' ? <label className="field"><span>Leerlingen — één naam per regel</span><textarea rows="8" value={names} onChange={(e) => setNames(e.target.value)} placeholder={'Alex de Jong\nSamira Bakker\nRobin Smit'} /></label> : (
          <div className="import-flow">
            <label className="upload-zone"><FileSpreadsheet size={25} /><strong>Kies een Excel- of CSV-bestand</strong><span>Alleen naam en klas worden ingelezen.</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files[0] && loadFile(e.target.files[0])} /></label>
            {sheet && <><div className="mapping"><label>Naamkolom<select value={mapping.name} onChange={(e) => setMapping({ ...mapping, name: Number(e.target.value) })}><option value="-1">Voor- en achternaam apart</option>{sheet.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label>{mapping.name < 0 && <><label>Voornaam<select value={mapping.firstName} onChange={(e) => setMapping({ ...mapping, firstName: Number(e.target.value) })}><option value="-1">Kies kolom</option>{sheet.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label><label>Achternaam<select value={mapping.lastName} onChange={(e) => setMapping({ ...mapping, lastName: Number(e.target.value) })}><option value="-1">Kies kolom</option>{sheet.headers.map((header, index) => <option key={index} value={index}>{header}</option>)}</select></label></>}</div>
            <div className="preview-list"><div><strong>Controlevoorbeeld</strong><span>{importedStudents.length} geldige namen</span></div>{importedStudents.slice(0, 5).map((student) => <p key={student.id}>{student.name}</p>)}{importedStudents.length > 5 && <p>+ {importedStudents.length - 5} meer</p>}</div></>}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <footer className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuleren</button><button className="primary-button">Klas opslaan</button></footer>
      </form>
    </Modal>
  );
}

function AddStudentModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  return <Modal title="Leerling toevoegen" onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onAdd(name.trim()); }}><label className="field"><span>Volledige naam</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label><footer className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Annuleren</button><button className="primary-button">Toevoegen</button></footer></form></Modal>;
}

function StartLessonModal({ onClose, onStart }) {
  const [together, setTogether] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return <Modal title="KanJam-les starten" description="De leerlingmodus neemt het volledige scherm over." onClose={onClose}><div className="lesson-summary"><span>Activiteit</span><strong>KanJam</strong><span>Verschijningsvorm</span><strong>Spel</strong></div><Toggle checked={together} onChange={setTogether} label="Samen bewegen" /><label className="field"><span>Docentcode</span><input inputMode="numeric" maxLength="4" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="Vier cijfers" /><small>Deze code is nodig om de leerlingmodus af te sluiten.</small></label>{error && <p className="form-error">{error}</p>}<footer className="modal-actions"><button className="secondary-button" onClick={onClose}>Annuleren</button><button className="primary-button" onClick={() => pin.length === 4 ? onStart(together, pin) : setError('Kies een docentcode van vier cijfers.')}>Start leerlingmodus</button></footer></Modal>;
}

function LevelPicker({ criterion, value, onChange }) {
  const selected = value && criterion.levels[value];
  return <section className="rubric-section"><header><p>Waar sta je nu?</p><h2>{criterion.title}</h2><span>{criterion.short}</span></header><div className="level-grid">{LEVELS.map((level) => <button key={level.key} className={value === level.key ? 'level-option selected' : 'level-option'} style={{ '--level-color': level.color }} onClick={() => onChange(level.key)}><span className="level-name">{level.name}</span><span className="level-summary">{criterion.levels[level.key].summary}</span>{value === level.key && <Check size={19} aria-hidden="true" />}</button>)}</div>{selected && <div className="level-detail"><div className="detail-marker" style={{ background: levelFor(value).color }} /><div><strong>{levelFor(value).name}</strong><p>{selected.detail}</p><small><b>Volgende uitdaging</b>{selected.next}</small></div></div>}</section>;
}

function StudentMode({ classItem, lesson, pin, onSubmit, onExit }) {
  const [studentId, setStudentId] = useState('');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState('');
  const [showExit, setShowExit] = useState(false);
  const [exitPin, setExitPin] = useState('');
  const criteria = RUBRIC.filter((item) => item.key !== 'together' || lesson.together);
  const student = classItem.students.find((item) => item.id === studentId);
  const visibleStudents = classItem.students.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  function reset() { setStudentId(''); setStep(0); setAnswers({}); setDone(false); setSearch(''); }
  function finish() { onSubmit(studentId, answers); setDone(true); window.setTimeout(reset, 1800); }
  if (done) return <main className="student-mode student-success"><div><span className="success-check"><Check size={34} /></span><h1>Bedankt, {student?.name.split(' ')[0]}.</h1><p>Je antwoorden zijn opgeslagen.</p></div></main>;
  return <main className="student-mode"><header className="student-header"><div className="student-brand"><BookOpenCheck size={21} /><strong>Rubrics LO</strong><span>{classItem.name} · KanJam</span></div><button className="quiet-button" onClick={() => setShowExit(true)}>Docent</button></header>
    {!studentId ? <section className="name-picker"><p className="eyebrow">Zelfbeoordeling</p><h1>Kies je naam</h1><p>Je krijgt alleen je eigen vragen te zien.</p><label className="search-field"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek je naam" /></label><div className="name-list">{visibleStudents.map((item) => <button key={item.id} onClick={() => setStudentId(item.id)}><span>{item.name}</span><ChevronRight size={18} /></button>)}</div></section> : <div className="assessment-shell"><div className="assessment-top"><button className="back-button" onClick={() => step ? setStep(step - 1) : reset()}><ArrowLeft size={18} /> Terug</button><span>{student.name}</span><span>{criteria[step].title}</span></div><LevelPicker criterion={criteria[step]} value={answers[criteria[step].key]} onChange={(value) => setAnswers({ ...answers, [criteria[step].key]: value })} /><footer className="student-actions"><span>{step + 1} van {criteria.length}</span>{step < criteria.length - 1 ? <button className="primary-button" disabled={!answers[criteria[step].key]} onClick={() => setStep(step + 1)}>Verder</button> : <button className="primary-button" disabled={!answers[criteria[step].key]} onClick={finish}>Bevestigen</button>}</footer></div>}
    {showExit && <Modal title="Leerlingmodus afsluiten" description="Vul de docentcode in om terug te gaan." onClose={() => { setShowExit(false); setExitPin(''); }}><label className="field"><span>Docentcode</span><input type="password" inputMode="numeric" maxLength="4" value={exitPin} onChange={(e) => setExitPin(e.target.value.replace(/\D/g, ''))} autoFocus /></label><footer className="modal-actions"><button className="secondary-button" onClick={() => setShowExit(false)}>Annuleren</button><button className="primary-button" disabled={exitPin !== pin} onClick={onExit}>Afsluiten</button></footer></Modal>}
  </main>;
}

function ReviewModal({ assessment, student, onClose, onSave }) {
  const [effective, setEffective] = useState({ ...assessment.effective });
  return <Modal title={`Beoordeling van ${student.name}`} description="Bespreek de zelfbeoordeling en pas alleen aan wanneer dat nodig is." onClose={onClose} wide><div className="review-grid">{RUBRIC.map((criterion) => assessment.self[criterion.key] && <section key={criterion.key}><h3>{criterion.title}</h3><div className="self-value"><span>Zelfbeoordeling</span><ColorTag value={assessment.self[criterion.key]} /></div><label>Effectief resultaat<select value={effective[criterion.key]} onChange={(e) => setEffective({ ...effective, [criterion.key]: e.target.value })}>{LEVELS.map((level) => <option value={level.key} key={level.key}>{level.name}</option>)}</select></label><p>{criterion.levels[effective[criterion.key]].summary}</p></section>)}</div><footer className="modal-actions"><button className="secondary-button" onClick={onClose}>Annuleren</button><button className="primary-button" onClick={() => onSave(effective)}>Opslaan</button></footer></Modal>;
}

function Report({ classItem, assessments, selectedStudentId, onSelectStudent }) {
  const student = classItem.students.find((item) => item.id === selectedStudentId) || classItem.students[0];
  const assessment = student && latestAssessment(assessments, classItem.id, student.id);
  return <div className="report-area"><div className="report-toolbar"><label>Leerling<select value={student?.id || ''} onChange={(e) => onSelectStudent(e.target.value)}>{classItem.students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="secondary-button" disabled={!assessment} onClick={() => window.print()}><Printer size={17} /> Afdrukken</button></div>{assessment ? <article className="report-sheet"><header><div><p>Rubrics LO · {classItem.name}</p><h1>{student.name}</h1></div><div><strong>KanJam</strong><span>{dateLabel(assessment.submittedAt)}</span></div></header><div className="report-skills">{RUBRIC.map((criterion) => assessment.effective[criterion.key] && <section key={criterion.key}><div className="report-skill-head"><div><p>Vaardigheid</p><h2>{criterion.title}</h2></div><ColorTag value={assessment.effective[criterion.key]} /></div><div className="report-copy"><div><strong>Dit kan je</strong><p>{criterion.levels[assessment.effective[criterion.key]].summary}</p></div><div><strong>Volgende uitdaging</strong><p>{criterion.levels[assessment.effective[criterion.key]].next}</p></div></div></section>)}</div></article> : <EmptyState title="Nog geen rapport">Deze leerling heeft KanJam nog niet ingevuld.</EmptyState>}</div>;
}

function ClassDetail({ classItem, assessments, tab, setTab, onBack, onAddStudent, onStartLesson, onReview, reportStudent, setReportStudent }) {
  const tabs = ['Overzicht', 'Leerlingen', 'Lessen', 'Rapport'];
  const submitted = classItem.students.filter((student) => latestAssessment(assessments, classItem.id, student.id)).length;
  return <><button className="back-button page-back" onClick={onBack}><ArrowLeft size={17} /> Alle klassen</button><header className="page-header class-header"><div><p className="eyebrow">Klas</p><h1>{classItem.name}</h1><p>{classItem.students.length} leerlingen</p></div><button className="primary-button" onClick={onStartLesson}>KanJam-les starten</button></header><nav className="tabs" aria-label="Klasnavigatie">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {tab === 'Overzicht' && <div className="overview-grid"><section className="metric"><span>Ingevuld</span><strong>{submitted} van {classItem.students.length}</strong><small>KanJam · laatste les</small></section><section className="lesson-panel"><div><span className="status-dot" /><div><strong>KanJam</strong><p>Zelfbeoordeling voor leren en samen bewegen.</p></div></div><button className="text-button" onClick={onStartLesson}>Leerlingmodus openen</button></section><section className="next-actions"><h2>Snel verder</h2><button onClick={() => setTab('Leerlingen')}><Users size={18} /><span><strong>Leerlingen bekijken</strong><small>Zelfbeoordelingen en aanpassingen</small></span><ChevronRight size={18} /></button><button onClick={() => setTab('Rapport')}><FileText size={18} /><span><strong>Rapport openen</strong><small>Bekijken en afdrukken</small></span><ChevronRight size={18} /></button></section></div>}
    {tab === 'Leerlingen' && <section className="table-section"><div className="section-heading"><div><h2>Leerlingen</h2><span>{classItem.students.length} leerlingen</span></div><button className="secondary-button" onClick={onAddStudent}><Plus size={17} /> Leerling toevoegen</button></div><div className="table-wrap"><table><thead><tr><th>Naam</th><th>Leren bewegen</th><th>Samen bewegen</th><th /></tr></thead><tbody>{classItem.students.map((student) => { const result = latestAssessment(assessments, classItem.id, student.id); return <tr key={student.id}><td><strong>{student.name}</strong></td><td><ColorTag value={result?.effective.movement} small /></td><td><ColorTag value={result?.effective.together} small /></td><td className="action-cell">{result && <button className="text-button" onClick={() => onReview(result, student)}>Bekijken</button>}</td></tr>; })}</tbody></table></div></section>}
    {tab === 'Lessen' && <section className="table-section"><div className="section-heading"><div><h2>Lessen</h2><span>{classItem.lessons.length} lessen</span></div><button className="secondary-button" onClick={onStartLesson}><Plus size={17} /> KanJam-les</button></div>{classItem.lessons.length ? <div className="table-wrap"><table><thead><tr><th>Activiteit</th><th>Datum</th><th>Samen bewegen</th></tr></thead><tbody>{[...classItem.lessons].reverse().map((lesson) => <tr key={lesson.id}><td><strong>{lesson.activity}</strong></td><td>{dateLabel(lesson.date)}</td><td>{lesson.together ? 'Aan' : 'Uit'}</td></tr>)}</tbody></table></div> : <EmptyState title="Nog geen lessen">Start de KanJam-les wanneer de leerlingen klaarstaan.</EmptyState>}</section>}
    {tab === 'Rapport' && <Report classItem={classItem} assessments={assessments} selectedStudentId={reportStudent} onSelectStudent={setReportStudent} />}
  </>;
}

function OverviewPage({ section, data, openClass }) {
  if (section === 'classes') return <><header className="page-header"><div><p className="eyebrow">Schooljaar 2026–2027</p><h1>Klassen</h1></div></header><section className="table-section"><div className="section-heading"><div><h2>Mijn klassen</h2><span>{data.classes.length} klassen</span></div></div><div className="table-wrap"><table><thead><tr><th>Klas</th><th>Leerlingen</th><th>Laatste les</th><th /></tr></thead><tbody>{data.classes.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.students.length}</td><td>{item.lessons.at(-1)?.activity || 'Nog niet gestart'}</td><td className="action-cell"><button className="text-button" onClick={() => openClass(item.id)}>Open klas</button></td></tr>)}</tbody></table></div></section></>;
  if (section === 'lessons') { const lessons = data.classes.flatMap((item) => item.lessons.map((lesson) => ({ ...lesson, className: item.name }))).sort((a, b) => new Date(b.date) - new Date(a.date)); return <><header className="page-header"><div><p className="eyebrow">Onderwijsactiviteit</p><h1>Lessen</h1></div></header>{lessons.length ? <section className="table-section"><div className="table-wrap"><table><thead><tr><th>Activiteit</th><th>Klas</th><th>Datum</th><th>Samen bewegen</th></tr></thead><tbody>{lessons.map((lesson) => <tr key={lesson.id}><td><strong>{lesson.activity}</strong></td><td>{lesson.className}</td><td>{dateLabel(lesson.date)}</td><td>{lesson.together ? 'Aan' : 'Uit'}</td></tr>)}</tbody></table></div></section> : <EmptyState title="Nog geen lessen">Start een les vanuit een klas.</EmptyState>}</>; }
  const entries = data.assessments.map((assessment) => { const classItem = data.classes.find((item) => item.id === assessment.classId); return { ...assessment, classItem, student: classItem?.students.find((item) => item.id === assessment.studentId) }; }).filter((item) => item.classItem && item.student);
  if (section === 'results') return <><header className="page-header"><div><p className="eyebrow">Zelfbeoordeling en overleg</p><h1>Resultaten</h1></div></header><section className="table-section"><div className="table-wrap"><table><thead><tr><th>Leerling</th><th>Klas</th><th>Leren bewegen</th><th>Samen bewegen</th></tr></thead><tbody>{entries.map((item) => <tr key={item.id}><td><strong>{item.student.name}</strong></td><td>{item.classItem.name}</td><td><ColorTag value={item.effective.movement} small /></td><td><ColorTag value={item.effective.together} small /></td></tr>)}</tbody></table></div></section></>;
  return <><header className="page-header"><div><p className="eyebrow">Ontwikkeling zichtbaar maken</p><h1>Rapporten</h1></div></header><div className="class-choice">{data.classes.map((item) => <button key={item.id} onClick={() => openClass(item.id, 'Rapport')}><span><strong>{item.name}</strong><small>{item.students.length} leerlingen</small></span><ChevronRight size={19} /></button>)}</div></>;
}

export default function App() {
  const [data, setData] = useStoredState();
  const [section, setSection] = useState('classes');
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classTab, setClassTab] = useState('Overzicht');
  const [modal, setModal] = useState(null);
  const [studentSession, setStudentSession] = useState(null);
  const [review, setReview] = useState(null);
  const [reportStudent, setReportStudent] = useState('');
  const selectedClass = data.classes.find((item) => item.id === selectedClassId);

  useEffect(() => {
    const api = navigator.modelContext;
    if (!api?.registerTool) return undefined;
    const unregister = [
      api.registerTool({ name: 'list_classes', description: 'Toont de klassen in Rubrics LO.', inputSchema: { type: 'object', properties: {} }, execute: () => ({ content: [{ type: 'text', text: data.classes.map((item) => `${item.name}: ${item.students.length} leerlingen`).join('\n') }] }) }),
      api.registerTool({ name: 'open_class', description: 'Opent een klas in Rubrics LO.', inputSchema: { type: 'object', properties: { className: { type: 'string' } }, required: ['className'] }, execute: ({ className }) => { const item = data.classes.find((candidate) => candidate.name.toLowerCase() === className.toLowerCase()); if (!item) return { content: [{ type: 'text', text: 'Klas niet gevonden.' }] }; setSelectedClassId(item.id); setSection('classes'); return { content: [{ type: 'text', text: `${item.name} is geopend.` }] }; } }),
    ];
    return () => unregister.forEach((value) => typeof value === 'function' && value());
  }, [data.classes]);

  function openClass(id, tab = 'Overzicht') { setSelectedClassId(id); setClassTab(tab); const first = data.classes.find((item) => item.id === id)?.students[0]?.id || ''; setReportStudent(first); }
  function updateClass(id, updater) { setData((current) => ({ ...current, classes: current.classes.map((item) => item.id === id ? updater(item) : item) })); }
  function startLesson(together, pin) { const lesson = { id: `lesson-${Date.now()}`, activity: 'KanJam', together, date: new Date().toISOString() }; updateClass(selectedClass.id, (item) => ({ ...item, lessons: [...item.lessons, lesson] })); setModal(null); setStudentSession({ lesson, pin }); }
  function submitAssessment(studentId, answers) { setData((current) => ({ ...current, assessments: [...current.assessments, { id: `assessment-${Date.now()}`, classId: selectedClass.id, studentId, lessonId: studentSession.lesson.id, submittedAt: new Date().toISOString(), self: answers, effective: { ...answers }, adjusted: {} }] })); }
  function saveReview(effective) { setData((current) => ({ ...current, assessments: current.assessments.map((item) => item.id === review.assessment.id ? { ...item, effective, adjusted: Object.fromEntries(Object.keys(effective).map((key) => [key, effective[key] !== item.self[key]])) } : item) })); setReview(null); }
  if (studentSession && selectedClass) return <StudentMode classItem={selectedClass} lesson={studentSession.lesson} pin={studentSession.pin} onSubmit={submitAssessment} onExit={() => setStudentSession(null)} />;
  return <div className="app-shell"><Sidebar active={section} onChange={(key) => { setSection(key); setSelectedClassId(null); }} /><main className="main-content">{selectedClass ? <ClassDetail classItem={selectedClass} assessments={data.assessments} tab={classTab} setTab={setClassTab} onBack={() => setSelectedClassId(null)} onAddStudent={() => setModal('student')} onStartLesson={() => setModal('lesson')} onReview={(assessment, student) => setReview({ assessment, student })} reportStudent={reportStudent} setReportStudent={setReportStudent} /> : <><OverviewPage section={section} data={data} openClass={openClass} />{section === 'classes' && <button className="floating-primary" onClick={() => setModal('class')}><Plus size={18} /> Klas toevoegen</button>}</>}</main>
    {modal === 'class' && <AddClassModal onClose={() => setModal(null)} onCreate={(newClass) => { setData((current) => ({ ...current, classes: [...current.classes, newClass] })); setModal(null); openClass(newClass.id); }} />}
    {modal === 'student' && <AddStudentModal onClose={() => setModal(null)} onAdd={(name) => { updateClass(selectedClass.id, (item) => ({ ...item, students: [...item.students, { id: `student-${Date.now()}`, name }].sort((a, b) => a.name.localeCompare(b.name, 'nl')) })); setModal(null); }} />}
    {modal === 'lesson' && <StartLessonModal onClose={() => setModal(null)} onStart={startLesson} />}
    {review && <ReviewModal assessment={review.assessment} student={review.student} onClose={() => setReview(null)} onSave={saveReview} />}
  </div>;
}
