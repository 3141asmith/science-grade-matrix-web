(() => {
  const nameKey = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-GB');
  function merge(target, headerNumber, source, sourceHeader, nameColumn, gradeColumn) {
    const copy = { ...target, rows:target.rows.map(row => ({...row,cells:[...row.cells]})) };
    const header = copy.rows.find(row => row.number === headerNumber);
    if (!header) throw new Error('The original workbook has no selected header.');
    if (![nameColumn,gradeColumn].every(n => Number.isInteger(n) && n >= 0) || nameColumn === gradeColumn) throw new Error('Select different student-name and Maths-grade columns.');
    const sourceHead = source.rows.find(row => row.number === sourceHeader);
    if (!sourceHead || Math.max(nameColumn,gradeColumn) >= sourceHead.cells.length) throw new Error('Select valid columns from the additional spreadsheet.');
    const issues = [], primary = new Map(), incoming = new Map();
    copy.rows.filter(row => row.number > headerNumber).forEach(row => {
      const key = nameKey(row.cells[0]); if (!key) return;
      if (!primary.has(key)) primary.set(key,[]); primary.get(key).push(row);
    });
    source.rows.filter(row => row.number > sourceHeader).forEach(row => {
      const key = nameKey(row.cells[nameColumn]);
      if (!key) { issues.push({name:'(No name supplied)',reason:'Missing student name',row:row.number}); return; }
      if (!incoming.has(key)) incoming.set(key,[]); incoming.get(key).push(row);
    });
    const column = Math.max(9,...copy.rows.map(row => row.cells.length));
    let label = 'GCSE Maths', suffix = 2;
    while (header.cells.includes(label)) label = `GCSE Maths (${suffix++})`;
    while(header.cells.length < column) header.cells.push('');
    header.cells[column] = label;
    let matched = 0;
    incoming.forEach((rows,key) => {
      const matches = primary.get(key) || [];
      const reason = rows.length > 1 ? 'Duplicate name in additional spreadsheet' : matches.length > 1 ? 'Duplicate name in original spreadsheet' : !matches.length ? 'No matching name in original spreadsheet' : null;
      rows.forEach(row => {
        if (reason) { issues.push({name:String(row.cells[nameColumn]),reason,row:row.number}); return; }
        const raw = row.cells[gradeColumn], grade = window.scienceAnalysis.grade(raw,'gcse');
        if (grade == null) { issues.push({name:String(row.cells[nameColumn]),reason:grade === null ? 'Missing Maths grade' : 'Unrecognised Maths grade',row:row.number}); return; }
        matches[0].cells[column] = String(raw); matched++;
      });
    });
    return {sheet:copy,column,label,matched,unmatched:copy.rows.filter(row => row.number > headerNumber).length-matched,issues};
  }
  window.scienceMerge = {merge};
  window.openMathsUpload = async () => {
    if (!workbook) throw new Error('Import the original science workbook first.');
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx';
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      await action($('add-maths'),async () => {
        const sheets = await window.grades.readAdditional(file);
        let bestSheet = 0, bestHeader = 0, bestColumn = -1;
        sheets.forEach((sheet,i) => sheet.rows.forEach(row => {
          const col = row.cells.findIndex(value => /math(?:s|ematics)?/i.test(value));
          if (col >= 0 && bestColumn < 0) { bestSheet = i; bestHeader = row.number; bestColumn = col; }
        }));
        let dialog = $('maths-dialog');
        if (!dialog) { dialog = node('dialog'); dialog.id = 'maths-dialog'; dialog.setAttribute('aria-labelledby','maths-title'); document.body.append(dialog); }
        dialog.replaceChildren(); const title = node('h2','Add GCSE Maths grades'); title.id='maths-title'; dialog.append(title);
        dialog.append(node('p','Names are matched against the first column of the original spreadsheet, ignoring capitalisation and extra spaces. Duplicate or unmatched names are left for review.'));
        const sheetSelect = node('select'); sheetSelect.id = 'maths-sheet';
        sheets.forEach((sheet,i) => { const opt=node('option',sheet.name);opt.value=i;sheetSelect.append(opt); }); sheetSelect.value=bestSheet;
        const headerSelect=node('select'); headerSelect.id='maths-header';
        const names=node('select'); names.id='maths-names'; const grades=node('select'); grades.id='maths-grades';
        for(const [text,select] of [['Additional worksheet',sheetSelect],['Header row',headerSelect],['Student names',names],['GCSE Maths grades',grades]]) { const label=node('label',text);label.append(select);dialog.append(label); }
        const populateColumns = () => {
          const header=sheets[Number(sheetSelect.value)]?.rows.find(row => row.number===Number(headerSelect.value));
          names.replaceChildren();grades.replaceChildren();
          if(!header)return;
          header.cells.forEach((name,i) => {for(const select of [names,grades]){const opt=node('option',`${i+1}. ${name || '(blank header)'}`);opt.value=i;select.append(opt);}});
          names.value='0';const match=header.cells.findIndex(value => /math(?:s|ematics)?/i.test(value));grades.value=String(match >= 0 ? match : Math.min(1,header.cells.length-1));
        };
        const populateHeaders = () => {
          headerSelect.replaceChildren(...sheets[Number(sheetSelect.value)].rows.map(row => {const opt=node('option',`Row ${row.number}: ${row.cells.filter(Boolean).slice(0,3).join(' / ')}`);opt.value=row.number;return opt;}));
          if(Number(sheetSelect.value)===bestSheet&&bestHeader)headerSelect.value=bestHeader;
          populateColumns();
        };
        sheetSelect.onchange=populateHeaders;headerSelect.onchange=populateColumns;populateHeaders();
        const buttons=node('div',undefined,'buttons');const cancel=node('button','Cancel','secondary');cancel.onclick=()=>dialog.close();
        const mergeButton=node('button','Merge Maths grades');mergeButton.id='merge-maths';
        mergeButton.onclick=()=>action(mergeButton,async()=>{
          const merged=await window.grades.mergeMaths({sheet:selectedSheet,header:selectedHeader,additionalSheet:Number(sheetSelect.value),additionalHeader:Number(headerSelect.value),nameColumn:Number(names.value),gradeColumn:Number(grades.value)});
          const current = Object.fromEntries(subjects.map(subject=>[subject,Object.fromEntries(['gcse','alevel'].map(level=>[level,$(`${subject}-${level}`).value]))]));
          workbook.sheets[selectedSheet]=merged.preview;chooseHeader();
          subjects.forEach(subject=>['gcse','alevel'].forEach(level=>{$(`${subject}-${level}`).value=current[subject][level];}));
          await calculate();dialog.close();
          const report=$('merge-report');report.hidden=false;report.replaceChildren(node('summary',`${merged.matched} Maths grades matched; ${merged.unmatched} original students without an added grade; ${merged.issues.length} entries to review`));
          if(merged.issues.length){const table=node('table');const head=node('tr');['Student name','Reason','Additional Excel row'].forEach(text=>head.append(node('th',text)));table.append(head);merged.issues.forEach(issue=>{const row=node('tr');[issue.name,issue.reason,issue.row].forEach(text=>row.append(node('td',text)));table.append(row);});const scroll=node('div',undefined,'scroll');scroll.append(table);report.append(scroll);}
          status(`Added ${merged.label} from ${file.name}. Select it in a GCSE column dropdown to analyse Maths against an A-level subject.`);
        });buttons.append(cancel,mergeButton);dialog.append(buttons);dialog.showModal();
      });
    };input.click();
  };
})();
