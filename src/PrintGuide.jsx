import { useEffect, useState } from 'react';
import { LEVELS, RUBRIC } from './data.js';

function readReport() {
  const sheet = document.querySelector('.report-sheet');
  if (!sheet) return null;
  const skills = [...sheet.querySelectorAll('.report-skills section')].map((section) => ({
    title: section.querySelector('h2')?.textContent || '',
    level: section.querySelector('.color-tag')?.textContent || '',
    can: section.querySelector('.report-copy > div:first-child p')?.textContent || '',
    next: section.querySelector('.report-copy > div:last-child p')?.textContent || '',
  }));
  return {
    student: sheet.querySelector('header h1')?.textContent || '',
    meta: sheet.querySelector('header p')?.textContent || 'Rubrics LO',
    activity: sheet.querySelector('header > div:last-child strong')?.textContent || 'KanJam',
    date: sheet.querySelector('header > div:last-child span')?.textContent || '',
    skills,
  };
}

export default function PrintGuide() {
  const [report, setReport] = useState(null);
  useEffect(() => {
    const update = () => setReport(readReport());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.getElementById('root'), { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  if (!report) return null;
  return (
    <article className="print-rubric-matrix ready" aria-hidden="true">
      <header><div><p>{report.meta}</p><h1>{report.student}</h1></div><div><strong>{report.activity}</strong><span>{report.date}</span></div></header>
      <div className="print-current">{report.skills.map((skill) => <section key={skill.title}><div><span>{skill.title}</span><strong>{skill.level}</strong></div><p><b>Dit kan je:</b> {skill.can}</p><p><b>Volgende uitdaging:</b> {skill.next}</p></section>)}</div>
      <div className="print-rubrics">{RUBRIC.map((criterion) => {
        const selected = report.skills.find((skill) => skill.title === criterion.title)?.level;
        return <section key={criterion.key}><div className="print-row-title"><strong>{criterion.title}</strong><span>{criterion.short}</span></div><div className="print-levels">{LEVELS.map((level) => <div key={level.key} className={selected === level.name ? 'current' : ''}><span style={{ background: level.color }}>{level.name}</span><p>{criterion.levels[level.key].summary}</p></div>)}</div></section>;
      })}</div>
    </article>
  );
}
