(() => {

async function createSample(file, withData = true) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Student grades');
  sheet.addRow(['Student ID', 'Physics GCSE', 'Physics A Level', 'Biology GCSE', 'Biology A Level', 'Chemistry GCSE', 'Chemistry A Level', 'Combined Science GCSE']);
  if (withData) {
    [['A*','A*'],['A*','A'],['A*','A'],['A*','B'],['9','A*'],['9','A'],['8','B'],['7','C'],['A','B'],['B','D'],['6',''],['5','X']].forEach(([g,a], i) => sheet.addRow([`Example ${i + 1}`,g,a,g,a,g,a,i < 4 ? '9-9' : '8-7']));
  }
  sheet.columns.forEach(col => { col.width = 23; });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  downloadWorkbook(await book.xlsx.writeBuffer(), file);
}
window.createSample = createSample;

})();