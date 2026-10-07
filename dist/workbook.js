(() => {

function cellText(value) {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value);
  if ('formula' in value || 'sharedFormula' in value) return cellText(value.result);
  if (value.richText) return value.richText.map(t => t.text).join('');
  if (value.text) return value.text;
  if (value.error) return value.error;
  return String(value);
}
async function readWorkbook(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  return workbook.worksheets.map(sheet => {
    if (sheet.rowCount > 100000 || sheet.columnCount > 300) throw new Error('A worksheet exceeds the supported limit of 100,000 rows or 300 columns.');
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, row => {
      const cells = Array.from({ length: sheet.columnCount }, (_, i) => cellText(row.getCell(i + 1).value));
      if (cells.some(c => c.trim())) rows.push({ number: row.number, cells });
    });
    return { name: sheet.name, rows };
  });
}
async function writeResults(file, results) {
  const book = new ExcelJS.Workbook();
  for (const result of results) {
    const sheet = book.addWorksheet(result.sheetName || result.subject);
    sheet.addRow([`${result.comparison || result.subject}: observed A-level outcomes given GCSE grade`]);
    sheet.addRow(['Percentages use valid paired results only; historical proportions are not individual predictions.']);
    sheet.addRow(['Included', result.included, 'Missing', result.missing, 'Invalid', result.invalid]);
    sheet.addRow(['GCSE grade', 'Paired students', ...result.matrix[0].cells.map(c => `${c.grade} %`), ...result.matrix[0].cells.map(c => `${c.grade} count`)]);
    for (const row of result.matrix) sheet.addRow([row.grade, row.total, ...row.cells.map(c => c.percent === null ? null : c.percent / 100), ...row.cells.map(c => c.count)]);
    for (let col = 3; col <= 9; col++) sheet.getColumn(col).numFmt = '0.0%';
    sheet.columns.forEach(col => { col.width = 18; });
    sheet.getRow(4).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 4, xSplit: 2 }];
    const issues = book.addWorksheet(`${result.sheetName || result.subject} exclusions`);
    issues.addRow(['Student name', 'Reason', 'GCSE value', 'A-level value']);
    result.issues.forEach(i => issues.addRow([i.name, i.reason, i.gcse, i.alevel]));
    issues.columns.forEach(col => { col.width = 26; });
  }
  downloadWorkbook(await book.xlsx.writeBuffer(), file);
}
window.scienceWorkbook = { readWorkbook, writeResults };

})();
