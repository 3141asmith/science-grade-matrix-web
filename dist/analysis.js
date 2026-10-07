(() => {
const SUBJECTS = ['Physics', 'Biology', 'Chemistry'];
const GCSE = ['9','8','7','6','5','4','3','2','1','A*','A','B','C','D','E','F','G','U'];
const ALEVEL = ['A*','A','B','C','D','E','U'];
const COMBINED = [ ...Array.from({ length: 9 }, (_, i) => 9-i).flatMap(n => n > 1 ? [`${n}-${n}`,`${n}-${n-1}`] : ['1-1']), 'A*-A*','A*-A','A-A','A-B','B-B','B-C','C-C','C-D','D-D','D-E','E-E','E-F','F-F','F-G','G-G','U-U','U'];
function grade(value, level) {
  let text = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/★|\*/g, '*');
  if (['ASTAR','A-STAR','A_STAR','*'].includes(text)) text = 'A*';
  if (!text || ['N/A','NA','-','ABSENT'].includes(text)) return null;
  if (level === 'combined') {
    text = text.replace(/[–—/]/g, '-');
    if (/^[1-9]{2}$/.test(text)) text = `${text[0]}-${text[1]}`;
    if (/^(A\*|[A-GU]){2}$/.test(text)) text = text.match(/A\*|[A-GU]/g).join('-');
    return COMBINED.includes(text) ? text : undefined;
  }
  return (level === 'gcse' ? GCSE : ALEVEL).includes(text) ? text : undefined;
}
function analyse(rows, mapping) {
  const used = [];
  for (const subject of SUBJECTS) {
    const pair = mapping[subject];
    if (!pair || !Number.isInteger(pair.gcse) || !Number.isInteger(pair.alevel) || pair.gcse < 0 || pair.alevel < 0)
      throw new Error(`Select both grade columns for ${subject}.`);
    used.push(pair.gcse, pair.alevel);
    if (pair.gcse === pair.alevel) throw new Error(`Choose different GCSE and A-level columns for ${subject}.`);
  }
  const gcseColumns = SUBJECTS.map(subject => mapping[subject].gcse);
  if (new Set(gcseColumns).size !== 3) throw new Error('Choose different GCSE columns for Physics, Biology and Chemistry.');
  if (SUBJECTS.some(subject => gcseColumns.includes(mapping[subject].alevel))) throw new Error('An A-level column cannot also be used as a GCSE column.');
  const combined = mapping.Combined?.gcse;
  if (combined !== undefined && (!Number.isInteger(combined) || combined < 0 || used.includes(combined)))
    throw new Error('Choose a separate column for Combined Science GCSE.');
  const comparisons = SUBJECTS.map(subject => ({ subject, ...mapping[subject], scale: GCSE, level: 'gcse' }));
  if (combined !== undefined) comparisons.push(...SUBJECTS.map(subject => ({ subject: `Combined Science → ${subject}`, sheetName: `Combined ${subject}`, gcse: combined, alevel: mapping[subject].alevel, scale: COMBINED, level: 'combined' })));
  return comparisons.map(({ subject, sheetName, gcse, alevel, scale, level }) => {
    const counts = Object.fromEntries(scale.map(g => [g, Object.fromEntries(ALEVEL.map(a => [a, 0]))]));
    const students = Object.fromEntries(scale.map(g => [g, Object.fromEntries(ALEVEL.map(a => [a, []]))]));
    let included = 0, missing = 0, invalid = 0;
    const issues = [];
    rows.forEach(({ number, cells }) => {
      const rawG = cells[gcse], rawA = cells[alevel];
      const g = grade(rawG, level), a = grade(rawA, 'alevel');
      if (g === undefined || a === undefined) {
        invalid++;
        issues.push({ row: number, name: String(cells[0] ?? "").trim() || "(No name supplied)", reason: 'Unrecognised grade', gcse: String(rawG ?? ''), alevel: String(rawA ?? '') });
      } else if (g === null || a === null) {
        missing++;
        issues.push({ row: number, name: String(cells[0] ?? "").trim() || "(No name supplied)", reason: 'Missing grade pair', gcse: String(rawG ?? ''), alevel: String(rawA ?? '') });
      } else {
        counts[g][a]++; included++;
        students[g][a].push({ name: String(cells[0] ?? '').trim() || '(No name supplied)', row: number, gcse: String(rawG), alevel: String(rawA) });
      }
    });
    const matrix = scale.map(g => {
      const total = Object.values(counts[g]).reduce((sum, n) => sum + n, 0);
      return { grade: g, total, cells: ALEVEL.map(a => ({ grade: a, count: counts[g][a], percent: total ? counts[g][a] / total * 100 : null, students: students[g][a] })) };
    });
    return { subject, sheetName: sheetName || subject, included, missing, invalid, matrix, issues };
  });
}
window.scienceAnalysis = { SUBJECTS, GCSE, COMBINED, ALEVEL, grade, analyse };

})();
