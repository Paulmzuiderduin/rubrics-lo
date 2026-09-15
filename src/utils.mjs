export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [';', ',', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(value.trim()); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; value = '';
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function normalizeSheet(rows) {
  if (!rows?.length) return { headers: [], rows: [] };
  const width = Math.max(...rows.map((row) => row.length));
  const headers = Array.from({ length: width }, (_, index) => String(rows[0][index] || `Kolom ${index + 1}`).trim());
  return { headers, rows: rows.slice(1).filter((row) => row.some(Boolean)).map((row) => headers.map((_, index) => String(row[index] ?? '').trim())) };
}

export function guessMapping(headers) {
  const lower = headers.map((header) => header.toLowerCase());
  const find = (...terms) => lower.findIndex((header) => terms.some((term) => header.includes(term)));
  const name = lower.findIndex((header) => ['naam', 'name', 'leerlingnaam', 'volledige naam', 'full name'].includes(header.trim()));
  return { name, firstName: find('voornaam', 'first'), lastName: find('achternaam', 'surname', 'last'), className: find('klas', 'class', 'groep') };
}

export function studentsFromRows(rows, mapping) {
  const seen = new Set();
  return rows.map((row, index) => {
    const full = mapping.name >= 0 ? row[mapping.name] : [row[mapping.firstName], row[mapping.lastName]].filter(Boolean).join(' ');
    const name = String(full || '').replace(/\s+/g, ' ').trim();
    if (!name || seen.has(name.toLocaleLowerCase('nl'))) return null;
    seen.add(name.toLocaleLowerCase('nl'));
    return { id: `student-${Date.now()}-${index}`, name };
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}

export function latestAssessment(assessments, classId, studentId) {
  return assessments.filter((item) => item.classId === classId && item.studentId === studentId).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] ?? null;
}
