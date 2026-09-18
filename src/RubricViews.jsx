import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Image, Search, Video, X } from 'lucide-react';
import { LEVELS } from './data.js';

export const levelFor = (key) => LEVELS.find((level) => level.key === key);

export function ColorTag({ value, small = false }) {
  const level = levelFor(value);
  if (!level) return <span className="empty-value">Nog niet ingevuld</span>;
  return <span className={small ? 'color-tag small' : 'color-tag'} style={{ '--level-color': level.color }}>{level.name}</span>;
}

export function MediaPlaceholders() {
  return <div className="media-placeholders"><div><Image size={25} /><strong>Afbeelding volgt</strong><span>Hier komt een gecontroleerd voorbeeldbeeld.</span></div><div><Video size={25} /><strong>Video volgt</strong><span>Hier komt een korte bewegingsdemonstratie.</span></div></div>;
}

export function RubricMatrix({ rubric, activeKeys = ['movement', 'together'], compact = false }) {
  return <div className={compact ? 'rubric-matrix compact' : 'rubric-matrix'}>{rubric.criteria.filter((criterion) => activeKeys.includes(criterion.key)).map((criterion) => <section key={criterion.key} className="matrix-row"><header><h2>{criterion.title}</h2><p>{criterion.short}</p></header><div className="matrix-levels">{LEVELS.map((level) => <div key={level.key} className="matrix-level" style={{ '--level-color': level.color }}><strong>{level.name}</strong><p>{criterion.levels[level.key].summary}</p></div>)}</div></section>)}</div>;
}

export function PresentationMode({ rubric, activeKeys = ['movement', 'together'], sessionLabel }) {
  return <main className="presentation-mode"><header><div><p>Rubrics LO</p><h1>{rubric.title}</h1></div><div><strong>{rubric.form}</strong>{sessionLabel && <span>{sessionLabel}</span>}</div></header><RubricMatrix rubric={rubric} activeKeys={activeKeys} /><MediaPlaceholders /></main>;
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
  return <section className="assessment-rubric"><header><p>Waar sta je nu?</p><h2>{criterion.title}</h2><span>{criterion.short}</span></header><div className="level-grid">{LEVELS.map((level) => <button key={level.key} className={value === level.key ? 'level-option selected' : 'level-option'} style={{ '--level-color': level.color }} onClick={() => onChange(level.key)}><span className="level-name">{level.name}</span><span className="level-summary">{criterion.levels[level.key].summary}</span>{value === level.key && <Check size={18} />}</button>)}</div>{selected && <div className="level-detail" style={{ '--level-color': levelFor(value).color }}><div /><p><strong>{levelFor(value).name}</strong>{selected.detail}<small><b>Volgende uitdaging</b>{selected.next}</small></p></div>}</section>;
}

export function SessionScreen({ rubric, classItem, series, mode, onSubmit, onExit }) {
  const activeKeys = series.includeTogether ? ['movement', 'together'] : ['movement'];
  const criteria = rubric.criteria.filter((item) => activeKeys.includes(item.key));
  const [studentId, setStudentId] = useState('');
  const [search, setSearch] = useState('');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [doneName, setDoneName] = useState('');
  const [exitConfirm, setExitConfirm] = useState(false);
  const student = classItem.students.find((item) => item.id === studentId);
  const students = useMemo(() => classItem.students.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'nl')), [classItem.students, search]);
  function reset() { setStudentId(''); setSearch(''); setStep(0); setAnswers({}); setDoneName(''); }
  function finish() { onSubmit(studentId, answers); setDoneName(student.name.split(' ')[0]); window.setTimeout(reset, 1800); }

  if (mode === 'display') return <main className="student-session display-session"><div className="student-session-header"><div><strong>Rubrics LO</strong><span>{classItem.name} · {rubric.title} · Oefenen</span></div><button className="quiet-button" onClick={() => setExitConfirm(true)}>Docentmodus</button></div><PresentationMode rubric={rubric} activeKeys={activeKeys} />{exitConfirm && <ExitConfirm onCancel={() => setExitConfirm(false)} onConfirm={onExit} />}</main>;
  if (doneName) return <main className="student-success"><div><span><Check size={32} /></span><h1>Bedankt, {doneName}.</h1><p>Je antwoorden zijn opgeslagen.</p></div></main>;
  if (studentId) return <main className="student-session"><div className="student-session-header"><button className="back-button" onClick={() => step ? setStep(step - 1) : reset()}><ArrowLeft size={17} /> Terug</button><span>{student.name}</span><button className="quiet-button" onClick={() => setExitConfirm(true)}>Docentmodus</button></div><div className="assessment-shell"><LevelPicker criterion={criteria[step]} value={answers[criteria[step].key]} onChange={(value) => setAnswers({ ...answers, [criteria[step].key]: value })} /><footer className="student-actions"><span>{step + 1} van {criteria.length}</span>{step < criteria.length - 1 ? <button className="primary-button" disabled={!answers[criteria[step].key]} onClick={() => setStep(step + 1)}>Verder</button> : <button className="primary-button" disabled={!answers[criteria[step].key]} onClick={finish}>Bevestigen</button>}</footer></div>{exitConfirm && <ExitConfirm onCancel={() => setExitConfirm(false)} onConfirm={onExit} />}</main>;
  return <main className="student-session assessment-home"><div className="student-session-header"><div><strong>Rubrics LO</strong><span>{classItem.name} · {rubric.title} · Beoordelen</span></div><button className="quiet-button" onClick={() => setExitConfirm(true)}>Docentmodus</button></div><div className="assessment-home-grid"><section className="assessment-reference"><RubricMatrix rubric={rubric} activeKeys={activeKeys} compact /></section><aside className="student-picker"><p className="eyebrow">Zelfbeoordeling</p><h1>Kies je naam</h1><label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek je naam" /></label><div className="name-list">{students.map((item) => <button key={item.id} onClick={() => setStudentId(item.id)}>{item.name}</button>)}</div></aside></div>{exitConfirm && <ExitConfirm onCancel={() => setExitConfirm(false)} onConfirm={onExit} />}</main>;
}
