import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Image, Search, Video, X } from 'lucide-react';
import { criteriaForRubric, LEARNING_LINES, LEVELS } from './data.js';
import { sortStudentsByLastName } from './utils.mjs';

export const levelFor = (key) => LEVELS.find((level) => level.key === key);

export function ColorTag({ value, small = false }) {
  const level = levelFor(value);
  if (!level) return <span className="empty-value">Nog niet ingevuld</span>;
  return <span className={small ? 'color-tag small' : 'color-tag'} style={{ '--level-color': level.color }}>{level.name}</span>;
}

export function MediaPlaceholders() {
  return <div className="media-placeholders"><div><Image size={25} /><strong>Afbeelding volgt</strong><span>Hier komt een gecontroleerd voorbeeldbeeld.</span></div><div><Video size={25} /><strong>Video volgt</strong><span>Hier komt een korte bewegingsdemonstratie.</span></div></div>;
}

export function RubricMatrix({ rubric, activeKeys, compact = false }) {
  const criteria = activeKeys ? rubric.criteria.filter((criterion) => activeKeys.includes(criterion.key)) : rubric.criteria;
  return <div className={compact ? 'rubric-matrix compact' : 'rubric-matrix'}>{criteria.map((criterion) => <section key={criterion.key} className="matrix-row"><header>{criterion.domainLabel && criterion.domainLabel !== criterion.title && <span className="matrix-domain">{criterion.domainLabel}</span>}<h2>{criterion.title}</h2><p>{criterion.short}</p></header><div className="matrix-levels">{LEVELS.map((level) => <div key={level.key} className="matrix-level" style={{ '--level-color': level.color }}><strong>{level.name}</strong><p>{criterion.levels[level.key].summary}</p></div>)}</div></section>)}</div>;
}

export function PresentationMode({ rubric, activeKeys, includeTogether = true, sessionLabel }) {
  const visibleKeys = activeKeys || criteriaForRubric(rubric, includeTogether).map((criterion) => criterion.key);
  const learningLine = LEARNING_LINES.find((item) => item.key === rubric.learningLine);
  return <main className="presentation-mode"><header><div><p>Rubrics LO</p><h1>{rubric.title}</h1></div><div><strong>{learningLine?.name}</strong>{sessionLabel && <span>{sessionLabel}</span>}</div></header><RubricMatrix rubric={rubric} activeKeys={visibleKeys} /><MediaPlaceholders /></main>;
}

function ExitConfirm({ onCancel, onConfirm }) {
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const message = await onConfirm(password);
    setBusy(false);
    if (message) setError(message);
  }
  return <div className="modal-backdrop"><section className="modal teacher-unlock"><header><div><h2>Terug naar docentmodus</h2><p>Vul het wachtwoord van het docentenaccount in. Zo kunnen leerlingen niet bij resultaten of leerlinggegevens.</p></div><button className="icon-button" onClick={onCancel} aria-label="Sluiten"><X size={20} /></button></header><form onSubmit={submit}><label className="field"><span>Wachtwoord</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus required /></label>{error && <p className="form-error" role="alert">{error}</p>}<footer className="modal-actions"><button type="button" className="secondary-button" onClick={onCancel}>Annuleren</button><button className="primary-button" disabled={busy}>{busy ? 'Controleren…' : 'Docentmodus openen'}</button></footer></form></section></div>;
}

function LevelPicker({ criterion, value, onChange }) {
  const selected = value && criterion.levels[value];
  return <section className="assessment-rubric"><header><p>{criterion.domainLabel || 'Waar sta je nu?'}</p><h2>{criterion.title}</h2><span>{criterion.short}</span></header><div className="level-grid">{LEVELS.map((level) => <button key={level.key} className={value === level.key ? 'level-option selected' : 'level-option'} style={{ '--level-color': level.color }} onClick={() => onChange(level.key)}><span className="level-name">{level.name}</span><span className="level-summary">{criterion.levels[level.key].summary}</span>{value === level.key && <Check size={18} />}</button>)}</div>{selected && <div className="level-detail" style={{ '--level-color': levelFor(value).color }}><div /><p><strong>{levelFor(value).name}</strong>{selected.detail}<small><b>Volgende uitdaging</b>{selected.next}</small></p></div>}</section>;
}

export function SessionScreen({ rubric, classItem, series, mode, onSubmit, onExit }) {
  const criteria = criteriaForRubric(rubric, series.includeTogether);
  const activeKeys = criteria.map((criterion) => criterion.key);
  const [studentId, setStudentId] = useState('');
  const [search, setSearch] = useState('');
  const [answers, setAnswers] = useState({});
  const [doneName, setDoneName] = useState('');
  const [exitConfirm, setExitConfirm] = useState(false);
  const student = classItem.students.find((item) => item.id === studentId);
  const students = useMemo(() => sortStudentsByLastName(classItem.students.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))), [classItem.students, search]);
  function reset() { setStudentId(''); setSearch(''); setAnswers({}); setDoneName(''); }
  function finish() { onSubmit(studentId, answers); setDoneName(student.name.split(' ')[0]); window.setTimeout(reset, 1800); }

  if (mode === 'display') return <main className="student-session display-session"><div className="student-session-header"><div><strong>Rubrics LO</strong><span>{classItem.name} · {rubric.title} · Oefenen</span></div><button className="quiet-button" onClick={() => setExitConfirm(true)}>Docentmodus</button></div><PresentationMode rubric={rubric} activeKeys={activeKeys} />{exitConfirm && <ExitConfirm onCancel={() => setExitConfirm(false)} onConfirm={onExit} />}</main>;
  if (doneName) return <main className="student-success"><div><span><Check size={32} /></span><h1>Bedankt, {doneName}.</h1><p>Je antwoorden zijn opgeslagen.</p></div></main>;
  if (studentId) {
    const completed = criteria.filter((criterion) => answers[criterion.key]).length;
    const complete = completed === criteria.length;
    return <main className="student-session"><div className="student-session-header"><button className="back-button" onClick={reset}><ArrowLeft size={17} /> Andere leerling</button><span>{student.name}</span><button className="quiet-button" onClick={() => setExitConfirm(true)}>Docentmodus</button></div><div className="assessment-shell assessment-all-criteria"><header className="assessment-intro"><p className="eyebrow">Zelfbeoordeling</p><h1>Kies bij ieder onderdeel de kleur die bij je past</h1><p>Vul alle onderdelen in en verstuur daarna je beoordeling één keer.</p></header><div className="assessment-criteria-list">{criteria.map((criterion) => <LevelPicker key={criterion.key} criterion={criterion} value={answers[criterion.key]} onChange={(value) => setAnswers({ ...answers, [criterion.key]: value })} />)}</div><footer className="student-actions"><span>{completed} van {criteria.length} onderdelen ingevuld</span><button className="primary-button" disabled={!complete} onClick={finish}>Beoordeling indienen</button></footer></div>{exitConfirm && <ExitConfirm onCancel={() => setExitConfirm(false)} onConfirm={onExit} />}</main>;
  }
  return <main className="student-session assessment-home"><div className="student-session-header"><div><strong>Rubrics LO</strong><span>{classItem.name} · {rubric.title} · Beoordelen</span></div><button className="quiet-button" onClick={() => setExitConfirm(true)}>Docentmodus</button></div><div className="assessment-home-grid"><section className="assessment-reference"><RubricMatrix rubric={rubric} activeKeys={activeKeys} compact /></section><aside className="student-picker"><p className="eyebrow">Zelfbeoordeling</p><h1>Kies je naam</h1><label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek je naam" /></label><div className="name-list">{students.map((item) => <button key={item.id} onClick={() => setStudentId(item.id)}>{item.name}</button>)}</div></aside></div>{exitConfirm && <ExitConfirm onCancel={() => setExitConfirm(false)} onConfirm={onExit} />}</main>;
}
