function downloadWorkbook(buffer, filename) {
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
(() => {
  let imported, results;
  const input = document.getElementById('workbook-file');
  window.grades = {
    open() {
      return new Promise((resolve, reject) => {
        input.value = '';
        input.oncancel = () => resolve(null);
        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return resolve(null);
          try {
            if (!/\.xlsx$/i.test(file.name)) throw new Error('Choose an .xlsx workbook.');
            if (file.size > 30 * 1024 * 1024) throw new Error('Please use a workbook smaller than 30 MB.');
            const sheets = await window.scienceWorkbook.readWorkbook(file);
            imported = sheets; results = null;
            resolve({ name: file.name, sheets: sheets.map(s => ({ name:s.name, rows:s.rows.slice(0,30), total:s.rows.length })) });
          } catch (error) { reject(new Error(`Could not read workbook. ${error.message} Use an unencrypted .xlsx file.`)); }
        };
        input.click();
      });
    },
    async analyse(options) {
      if (!imported) throw new Error('Import a workbook first.');
      results = null;
      const sheet = imported[options.sheet];
      if (!sheet || !Number.isInteger(options.header)) throw new Error('Choose a worksheet and header row.');
      const header = sheet.rows.find(r => r.number === options.header);
      if (!header || Object.values(options.mapping).some(pair => Object.values(pair).some(n => n >= header.cells.length))) throw new Error('Choose valid columns.');
      const rows = sheet.rows.filter(r => r.number > options.header);
      if (!rows.length) throw new Error('There are no student rows after this header.');
      const mapping=Object.fromEntries(Object.entries(options.mapping).map(([key,pair])=>[key,{...pair,...(key==='Combined'?{}:{allowCombined:! /math/i.test(header.cells[pair.gcse] || '')})}]));
      results = window.scienceAnalysis.analyse(rows,mapping);
      results.forEach((result, index) => {
        const subject = window.scienceAnalysis.SUBJECTS[index % 3];
        const pair = options.mapping[subject];
        const gcse = index < 3 ? pair.gcse : options.mapping.Combined.gcse;
        result.comparison = `${header.cells[gcse] || 'GCSE'} → ${header.cells[pair.alevel] || 'A level'}`;
      });
      return { results, rows:rows.length };
    },
    async trends(options) {
      if (!imported) throw new Error('Import a workbook first.');
      const sheet = imported[options.sheet];
      if (!sheet || !sheet.rows.some(row => row.number === options.header)) throw new Error('Import a workbook with grade headers first.');
      const rows = sheet.rows.filter(row => row.number > options.header);
      const header=sheet.rows.find(row=>row.number===options.header);
      let yearColumn=header.cells.findIndex(name=>/^(?:academic|exam|cohort)?year$/i.test(String(name).replace(/[^a-z]/gi,'')));
      if(yearColumn<0)yearColumn=/math/i.test(header.cells[8] || '') ? 9 : 8;
      const combined=Object.fromEntries(Object.entries(options.gcseColumns).map(([subject,column])=>[subject,/math/i.test(header.cells[column] || '') ? -1 : options.combinedColumn]));
      return [...window.scienceTrends.aggregate(rows, options.columns, 'alevel', -1, yearColumn), ...window.scienceTrends.aggregate(rows, options.gcseColumns, 'gcse', combined, yearColumn)];
    },
    async export() {
      if (!results) throw new Error('Produce a matrix first.');
      await window.scienceWorkbook.writeResults('Science-grade-matrices.xlsx',results); return true;
    },
    async template() { await window.createSample('Science-grades-template.xlsx',false); return true; }
  };
})();
