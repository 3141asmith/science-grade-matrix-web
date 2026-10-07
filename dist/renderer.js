const subjects = ['Physics', 'Biology', 'Chemistry'];
const $ = id => document.getElementById(id);
let workbook;
function node(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; }
function percentageColour(percent) {
  if (percent === null || percent <= 0) return '';
  const value = Math.min(100, percent);
  const red = [248, 171, 166], amber = [255, 218, 135], green = [135, 207, 163];
  const [start, end, blend] = value <= 50 ? [red, amber, value / 50] : [amber, green, (value - 50) / 50];
  return `rgb(${start.map((channel, i) => Math.round(channel + (end[i] - channel) * blend)).join(', ')})`;
}
function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : ''; }
async function action(button, fn) {
  button.disabled = true;
  try { await fn(); } catch (error) { status(error.message.replace(/^Error invoking remote method '[^']+': Error: /, ''), true); }
  finally { button.disabled = false; }
}
function invalidate() { $('results').hidden = true; if ($('student-dialog')?.open) $('student-dialog').close(); }
function showStudents(result, row, cell) {
  let dialog = $('student-dialog');
  if (!dialog) {
    dialog = node('dialog'); dialog.id = 'student-dialog';
    dialog.setAttribute('aria-labelledby', 'student-dialog-title');
    document.body.append(dialog);
  }
  dialog.replaceChildren();
  const header = node('div', undefined, 'section-title');
  const title = node('h2', result.comparison || result.subject); title.id = 'student-dialog-title';
  const close = node('button', 'Close', 'secondary'); close.type = 'button'; close.autofocus = true;
  close.onclick = () => dialog.close(); header.append(title, close); dialog.append(header);
  dialog.append(node('p', `GCSE ${row.grade} → A level ${cell.grade}: ${cell.percent.toFixed(1)}% (${cell.count} of ${row.total} students with this GCSE grade).`));
  if (!cell.students.length) dialog.append(node('p', 'No students have this grade combination.'));
  else {
    const table = node('table'); const thead = node('thead'); const headings = node('tr');
    ['Student name (first column)', 'GCSE grade', 'A-level grade', 'Excel row'].forEach(text => headings.append(node('th', text))); thead.append(headings); table.append(thead);
    const body = node('tbody');
    for (const student of cell.students) {
      const tr = node('tr'); [student.name, student.gcse, student.alevel, student.row].forEach(value => tr.append(node('td', value))); body.append(tr);
    }
    table.append(body); const scroll = node('div', undefined, 'scroll'); scroll.append(table); dialog.append(scroll);
  }
  dialog.showModal();
}
async function chooseWorkbook(data) {
  workbook = data; invalidate(); $('setup').hidden = false;
  $('sheet').replaceChildren(...data.sheets.map((s,i) => { const o = node('option', s.name); o.value = i; return o; }));
  status(`Imported ${data.name}. Select the worksheet, header and grade columns.`);
  chooseSheet();
  const defaultsReady = subjects.every(subject => ['gcse','alevel'].every(level => $(`${subject}-${level}`)?.value !== '' && $(`${subject}-${level}`)?.value !== undefined));
  if (defaultsReady) await calculate();
  else if (!$('calculate').disabled) status(`Imported ${data.name}. Select the missing grade columns, then choose Produce percentage matrices.`);
}
function chooseSheet() {
  invalidate();
  const sheet = workbook.sheets[Number($('sheet').value)];
  $('header').replaceChildren(...sheet.rows.map(r => { const o = node('option', `Row ${r.number}: ${r.cells.filter(Boolean).slice(0,3).join(' · ').slice(0,90)}`); o.value = r.number; return o; }));
  chooseHeader();
}
function chooseHeader() {
  invalidate();
  const sheet = workbook.sheets[Number($('sheet').value)];
  const header = sheet.rows.find(r => r.number === Number($('header').value));
  $('mapping').replaceChildren(); $('preview').replaceChildren();
  if (!header) { status('This worksheet is empty. Choose another worksheet.', true); $('calculate').disabled = true; return; }
  $('calculate').disabled = false;
  for (const subject of subjects) {
    const row = node('div', undefined, 'mapping-row'); row.append(node('strong', subject));
    for (const level of ['gcse','alevel']) {
      const label = node('label', level === 'gcse' ? 'GCSE column' : 'A-level column');
      const select = node('select'); select.id = `${subject}-${level}`; select.setAttribute('aria-label', `${subject} ${level} column`);
      const blank = node('option', 'Choose a column…'); blank.value = ''; select.append(blank);
      header.cells.forEach((name, i) => { const o = node('option', `${i+1}. ${name || '(blank header)'}`); o.value = i; select.append(o); });
      const match = header.cells.findIndex(name => {
        const normal = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normal.includes(subject.toLowerCase()) && (level === 'gcse' ? normal.includes('gcse') : /alevel|a2/.test(normal));
      });
      if (match >= 0) select.value = match;
      select.addEventListener('change', invalidate); label.append(select); row.append(label);
    }
    $('mapping').append(row);
  }
  const combinedRow = node('div', undefined, 'mapping-row');
  combinedRow.append(node('strong', 'Combined Science'));
  const combinedLabel = node('label', 'GCSE column (optional)');
  const combinedSelect = node('select'); combinedSelect.id = 'Combined-gcse';
  const none = node('option', 'Do not include Combined Science'); none.value = ''; combinedSelect.append(none);
  header.cells.forEach((name,i) => { const option = node('option', `${i+1}. ${name || '(blank header)'}`); option.value = i; combinedSelect.append(option); });
  const combinedMatch = header.cells.findIndex(name => /combined|double\s*award/i.test(name));
  if (combinedMatch >= 0) combinedSelect.value = combinedMatch;
  combinedSelect.addEventListener('change', invalidate);
  combinedLabel.append(combinedSelect); combinedRow.append(combinedLabel, node('p', 'Compared separately with Physics, Biology and Chemistry A level.')); $('mapping').append(combinedRow);
  const table = node('table'); const head = node('tr'); head.append(node('th','Excel row'), ...header.cells.map((h,i) => node('th',h || `Column ${i+1}`))); table.append(head);
  sheet.rows.filter(r => r.number > header.number).slice(0,5).forEach(r => { const tr = node('tr'); tr.append(node('td',r.number), ...r.cells.map(c => node('td',c))); table.append(tr); });
  $('preview').append(table);
}
async function calculate() {
  invalidate();
  const mapping = Object.fromEntries(subjects.map(s => [s, Object.fromEntries(['gcse','alevel'].map(l => [l, $(`${s}-${l}`).value === '' ? -1 : Number($(`${s}-${l}`).value)]))]));
  if ($('Combined-gcse').value !== '') mapping.Combined = { gcse: Number($('Combined-gcse').value) };
  const data = await window.grades.analyse({ sheet: Number($('sheet').value), header: Number($('header').value), mapping });
  render(data.results); $('results').hidden = false;
  status(`Analysed ${data.rows} student rows from ${workbook.name}. Each subject uses its own valid paired results.`);
  return data;
}
function render(results) {
  $('matrices').replaceChildren();
  for (const result of results) {
    const card = node('article', undefined, 'card');
    const title = node('div', undefined, 'subject-header'); title.append(node('h3', result.comparison || result.subject), node('span', `${result.included} paired · ${result.missing} missing · ${result.invalid} invalid`, 'counts')); card.append(title);
    card.append(node('p', `Source: ${workbook.name}. Percentages describe observed outcomes among valid paired results. Colours represent percentage size: red for low positive values, amber at 50%, green at 100%; 0% has no colour.`, 'pdf-context'));
    if (!result.included) card.append(node('p', 'No valid grade pairs for this subject. Check your mapping and grades.'));
    const table = node('table'); const thead = node('thead'); const heading = node('tr');
    ['GCSE grade','Students', ...result.matrix[0].cells.map(c => c.grade)].forEach(t => heading.append(node('th', t))); thead.append(heading); table.append(thead);
    const body = node('tbody');
    const fixedGrades = result.subject.startsWith('Combined Science')
      ? ['9-9','9-8','8-8','8-7','7-7','7-6','6-6','6-5','5-5','5-4','4-4']
      : ['9','8','7','6','5','4'];
    for (const row of result.matrix.filter(r => r.total || fixedGrades.includes(r.grade))) {
      const tr = node('tr'); const label = node('th',row.grade); label.scope = 'row'; tr.append(label, node('td',row.total));
      for (const cell of row.cells) {
        const td = node('td', undefined, row.total ? undefined : 'empty');
        td.style.backgroundColor = percentageColour(cell.percent);
        if (cell.percent === null) td.append(node('strong', '—'), node('small', `${cell.count} of ${row.total}`));
        else {
          const button = node('button', undefined, 'percentage-button'); button.type = 'button';
          button.setAttribute('aria-label', `Show ${cell.count} students: ${result.comparison || result.subject}, GCSE ${row.grade}, A level ${cell.grade}, ${cell.percent.toFixed(1)} percent`);
          button.append(node('strong', `${cell.percent.toFixed(1)}%`), node('small', `${cell.count} of ${row.total}`));
          button.onclick = () => showStudents(result, row, cell); td.append(button);
        }
        td.title = row.total ? `${result.subject}: ${cell.count} of ${row.total} students with GCSE ${row.grade} achieved A level ${cell.grade}.` : `No valid paired results for GCSE ${row.grade}; a percentage cannot be calculated.`;
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(body); const scroll = node('div', undefined, 'scroll'); scroll.append(table); card.append(scroll);
    if (result.matrix.some(r => r.total > 0 && r.total < 10)) card.append(node('p','Small cohorts: some rows contain fewer than 10 students, so percentages can change substantially with one result.','sample-note'));
    card.append(node('p','GCSE grades 9–4 (double grades 9–9 to 4–4 for Combined Science) are always displayed, along with other grades that have valid pairs. A dash means no paired results. Percentages are rounded to one decimal place.'));
    if (result.issues.length) {
      const details = node('details'); details.append(node('summary', `Review ${result.issues.length} excluded pairs`));
      const issues = node('table', undefined, 'issue-table'); const head = node('tr'); ['Student name','Reason','GCSE value','A-level value'].forEach(h => head.append(node('th',h))); issues.append(head);
      result.issues.slice(0,100).forEach(i => { const row = node('tr'); [i.name,i.reason,i.gcse,i.alevel].forEach(v => row.append(node('td',v))); issues.append(row); });
      details.append(issues); if (result.issues.length > 100) details.append(node('p','Showing the first 100 exclusions. Export to Excel for the complete list.')); card.append(details);
    }
    $('matrices').append(card);
  }
}
$('open').onclick = () => action($('open'), async () => { const data = await window.grades.open(); if (data) await chooseWorkbook(data); });
$('sheet').onchange = chooseSheet;
$('header').onchange = chooseHeader;
$('calculate').onclick = () => action($('calculate'), calculate);
$('save-pdf').onclick = () => action($('save-pdf'), async () => { await window.saveMatricesPDF(); status('PDF generated and sent to your browser downloads.'); });
$('template').onclick = () => action($('template'), async () => { if (await window.grades.template()) status('Saved a blank Excel template. Add one row per student, then import it.'); });
window.runSmoke = async data => {
  await chooseWorkbook(data);
  const analysed = await calculate();
  const aStar = analysed.results[0].matrix.find(r => r.grade === 'A*');
  const combined = analysed.results[3]?.matrix.find(r => r.grade === '9-9');
  const tables = [...document.querySelectorAll('#matrices article .scroll table')];
  const displayOk = tables.every((table,i) => {
    const labels = [...table.querySelectorAll('tbody th')].map(th => th.textContent);
    const required = i < 3 ? ['9','8','7','6','5','4'] : ['9-9','9-8','8-8','8-7','7-7','7-6','6-6','6-5','5-5','5-4','4-4'];
    return required.every(g => labels.includes(g)) && [...table.querySelectorAll('thead th')].slice(2).map(th => th.textContent).join(',') === 'A*,A,B,C,D,E,U' && table.textContent.includes('—');
  });
  const coloursOk = percentageColour(0) === '' && percentageColour(null) === '' && percentageColour(50) === 'rgb(255, 218, 135)' && percentageColour(100) === 'rgb(135, 207, 163)' && percentageColour(25) !== percentageColour(26) && tables.every(table => [...table.querySelectorAll('tbody td')].filter(td => td.querySelector('strong')).every(td => {
    const value = td.querySelector('strong').textContent;
    return value === '0.0%' || value === '—' ? td.style.backgroundColor === '' : getComputedStyle(td).backgroundColor !== 'rgba(0, 0, 0, 0)';
  }));
  return { ok: coloursOk && displayOk && document.querySelectorAll('#matrices article').length === 6 && aStar.cells[0].percent === 25 && aStar.total === 4 && analysed.results[0].missing === 1 && analysed.results[0].invalid === 1 && combined?.total === 4 && combined.cells[0].percent === 25, coloursOk, displayOk, subjects: analysed.results.map(r => r.subject), aStar, combined };
};
