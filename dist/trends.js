(() => {
  const grades = ['A*','A','B','C','D','E','U'];
  const colours = ['#126a54','#369c72','#86be75','#d5bd43','#e29a45','#c65e50','#895368'];
  const gcseColours = ['#126a54','#27845d','#419d69','#74b473','#a8c576','#d5bd43','#e5a44e','#d47b4b','#c65e50','#126a54','#27845d','#74b473','#a8c576','#d5bd43','#e5a44e','#d47b4b','#c65e50','#895368'];
  function aggregate(rows, columns, level = 'alevel', combinedColumn = -1) {
    const scale = level === 'gcse' ? window.scienceAnalysis.GCSE : grades;
    return ['Biology','Chemistry','Physics'].map(subject => {
      const years = new Map(); let missingYear = 0, invalidYear = 0, missingGrade = 0, invalidGrade = 0;
      const column = columns[subject];
      if (!Number.isInteger(column) || column < 0) throw new Error(`Select a ${level === 'gcse' ? 'GCSE' : 'A-level'} column for ${subject} first.`);
      for (const row of rows) {
        const year = String(row.cells[8] ?? '').trim().replace(/[–—]/g,'-');
        if (!year) { missingYear++; continue; }
        if (!/^\d{4}(?:[/-](?:\d{2}|\d{4}))?$/.test(year)) { invalidYear++; continue; }
        let grade = window.scienceAnalysis.grade(row.cells[column],level);
        if (level === 'gcse' && grade == null && combinedColumn >= 0) {
          const fallback = window.scienceAnalysis.combinedGrade(row.cells[combinedColumn]);
          if (fallback != null || (grade === null && fallback === undefined)) grade = fallback;
        }
        if (grade === null) { missingGrade++; continue; }
        if (grade === undefined) { invalidGrade++; continue; }
        if (!years.has(year)) years.set(year,{year,total:0,counts:Object.fromEntries(scale.map(g => [g,0]))});
        const group = years.get(year); group.total++; group.counts[grade]++;
      }
      return {subject,level,grades:scale,colours:level === 'gcse' ? gcseColours : colours,years:[...years.values()].sort((a,b) => a.year.localeCompare(b.year,undefined,{numeric:true})),missingYear,invalidYear,missingGrade,invalidGrade};
    });
  }
  const svgNode = (tag, attrs, text) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg',tag);
    for (const [name,value] of Object.entries(attrs)) el.setAttribute(name,value);
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function chart(result) {
    const width = Math.max(680,result.years.length * 95 + 90), height = 310, plotHeight = 215;
    const svg = svgNode('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':`${result.subject} ${result.level === 'gcse' ? 'GCSE' : 'A-level'} grade distributions by year. Each bar totals 100 percent.`});
    for (const value of [0,25,50,75,100]) {
      const y = 240-value/100*plotHeight;
      svg.append(svgNode('line',{x1:50,x2:width-15,y1:y,y2:y,stroke:'#dbe3ec'}),svgNode('text',{x:43,y:y+4,'text-anchor':'end','font-size':12,fill:'#52647a'},`${value}%`));
    }
    const slot = (width-75)/result.years.length;
    result.years.forEach((year,i) => {
      const x = 55+i*slot+slot*.18, barWidth = slot*.64; let bottom = 240;
      result.grades.forEach((grade,index) => {
        const count = year.counts[grade], percent = count/year.total*100, h = percent/100*plotHeight;
        if (!count) return;
        bottom -= h;
        const rect = svgNode('rect',{x,y:bottom,width:barWidth,height:h,fill:result.colours[index]});
        rect.append(svgNode('title',{},`${year.year}: ${grade} — ${percent.toFixed(1)}% (${count} of ${year.total})`)); svg.append(rect);
        // Use an opaque badge so every grade colour has the same readable label contrast.
        if (h >= 30 && barWidth >= 48) {
          const label = percent.toFixed(0) + '%';
          const badgeWidth = Math.min(barWidth - 6, label.length * 7.5 + 14);
          const centreX = x + barWidth/2, centreY = bottom + h/2;
          svg.append(svgNode('rect',{x:centreX-badgeWidth/2,y:centreY-11,width:badgeWidth,height:22,rx:4,fill:'#132840'}));
          svg.append(svgNode('text',{x:centreX,y:centreY+5,'text-anchor':'middle','font-size':14,'font-weight':600,fill:'#ffffff'},label));
        }
      });
      svg.append(svgNode('text',{x:x+barWidth/2,y:262,'text-anchor':'middle','font-size':13,fill:'#20304b'},year.year),svgNode('text',{x:x+barWidth/2,y:282,'text-anchor':'middle','font-size':12,fill:'#52647a'},`n = ${year.total}`));
    });
    return svg;
  }
  window.scienceTrends = {aggregate};
  window.showTrends = async () => {
    if (!workbook) throw new Error('Import a workbook before viewing trends.');
    const columns = Object.fromEntries(subjects.map(subject => [subject, $(`${subject}-alevel`)?.value === '' ? -1 : Number($(`${subject}-alevel`)?.value)]));
    const gcseColumns = Object.fromEntries(subjects.map(subject => [subject, $(`${subject}-gcse`)?.value === '' ? -1 : Number($(`${subject}-gcse`)?.value)]));
    const results = await window.grades.trends({sheet:selectedSheet,header:selectedHeader,columns,gcseColumns,combinedColumn});
    let dialog = $('trends-dialog');
    if (!dialog) { dialog = node('dialog'); dialog.id = 'trends-dialog'; dialog.setAttribute('aria-labelledby','trends-title'); document.body.append(dialog); }
    dialog.replaceChildren();
    const header = node('div',undefined,'section-title'); const heading = node('h2','Grade distributions by year'); heading.id = 'trends-title';
    const close = node('button','Close','secondary'); close.type = 'button'; close.autofocus = true; close.onclick = () => dialog.close(); header.append(heading,close); dialog.append(header);
    dialog.append(node('p','Three A-level and three GCSE distributions using the currently selected columns. Years come from spreadsheet column 9. Each bar totals 100% of valid grades for that year, independently for each subject and qualification. GCSE graphs use the rounded Combined Science average when a valid subject GCSE grade is unavailable; A-level results are not required. Numeric and letter GCSE grades stay separate.'));
    const pairs = new Map();
    ['Biology','Chemistry','Physics'].forEach(subject => {
      const pair = node('div',undefined,'trends-pair'); pair.setAttribute('aria-label',subject + ' trends'); pairs.set(subject,pair); dialog.append(pair);
    });
    results.forEach(result => {
      const qualification = result.level === 'gcse' ? 'GCSE' : 'A level';
      const section = node('section',undefined,'trends-subject'); section.append(node('h3',`${result.subject} ${qualification} — ${$(`${result.subject}-${result.level}`).selectedOptions[0].textContent.replace(/^\d+\. /,'')}`));
      const legend = node('div',undefined,'trends-legend');
      result.grades.forEach((grade,i) => { if (result.level === 'gcse' && !/^[1-9]$/.test(grade)) return; const label = node('span',grade); const swatch = node('i'); swatch.style.backgroundColor = result.colours[i]; label.prepend(swatch); legend.append(label); }); section.append(legend);
      if (!result.years.length) section.append(node('p',`No valid year and ${qualification} grade pairs. Add years to column 9 (for example 2024 or 2024/25).`));
      else {
        const scroll = node('div',undefined,'scroll'); scroll.append(chart(result)); section.append(scroll);
        const details = node('details'); details.append(node('summary','View counts and percentages'));
        const table = node('table'); const head = node('tr'); ['Year','Students',...result.grades].forEach(g => head.append(node('th',g))); table.append(head);
        result.years.forEach(year => { const tr = node('tr'); tr.append(node('td',year.year),node('td',year.total)); result.grades.forEach(g => tr.append(node('td',`${(year.counts[g]/year.total*100).toFixed(1)}% (${year.counts[g]})`))); table.append(tr); });
        const wrap = node('div',undefined,'scroll'); wrap.append(table); details.append(wrap); section.append(details);
      }
      section.append(node('p',`Excluded: ${result.missingYear} missing year, ${result.invalidYear} invalid year, ${result.missingGrade} missing ${qualification} grade, ${result.invalidGrade} invalid ${qualification} grade.`)); pairs.get(result.subject).append(section);
    });
    dialog.showModal();
  };
})();
