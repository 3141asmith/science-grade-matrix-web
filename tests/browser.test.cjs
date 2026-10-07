const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('../../.runtime/tools/node_modules/playwright')); }
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE || undefined});
  const page = await browser.newPage({acceptDownloads:true});
  const errors = []; page.on('pageerror',error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:4173');
    const bytes = await page.evaluate(async () => {
      const original = window.downloadWorkbook;
      let buffer;
      window.downloadWorkbook = data => { buffer = data; };
      await window.createSample('example.xlsx',true);
      window.downloadWorkbook = original;
      return Array.from(new Uint8Array(buffer));
    });
    const chooser = page.waitForEvent('filechooser'); await page.locator('#open').click();
    await (await chooser).setFiles({name:'example.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bytes)});
    await page.locator('#setup').waitFor({state:'visible'});
    await page.locator('#results').waitFor({state:'visible'});
    assert.equal(await page.locator('#matrices article').count(),3);
    const exclusions = page.locator('#matrices article').first().locator('details');
    await exclusions.locator('summary').click();
    assert.equal(await exclusions.locator('th').first().textContent(),'Student name');
    assert.deepEqual(await exclusions.locator('tr td:first-child').allTextContents(),['Example 11','Example 12']);
    assert.match(await exclusions.textContent(),/Missing grade pair/);
    assert.match(await exclusions.textContent(),/Unrecognised grade/);
    await exclusions.locator('summary').click();
    assert.deepEqual(await page.locator('#matrices h3').allTextContents(),['Physics GCSE → Physics A Level','Biology GCSE → Biology A Level','Chemistry GCSE → Chemistry A Level']);
    const data = await page.evaluate(() => {
      const tables = [...document.querySelectorAll('#matrices article .scroll table')];
      return tables.map(t => ({headers:[...t.querySelectorAll('thead th')].slice(2).map(n => n.textContent),rows:[...t.querySelectorAll('tbody tr')].map(r => ({grade:r.querySelector('th').textContent,cells:[...r.querySelectorAll('td')].slice(1).map(td => ({text:td.querySelector('strong').textContent,colour:td.style.backgroundColor}))}))}));
    });
    for (const [i, table] of data.entries()) {
      assert.deepEqual(table.headers,['A*','A','B','C','D','E','U']);
      for (const grade of i < 3 ? ['9','8','7','6','5','4'] : ['9-9','9-8','8-8','8-7','7-7','7-6','6-6','6-5','5-5','5-4','4-4']) assert.ok(table.rows.some(r => r.grade === grade));
      for (const row of table.rows) for (const cell of row.cells) assert.equal(Boolean(cell.colour), !['0.0%','—'].includes(cell.text));
    }
    assert.deepEqual(data[0].rows.find(r => r.grade === 'A*').cells.slice(0,3).map(c => c.text),['25.0%','50.0%','25.0%']);
    assert.equal(data[0].rows.find(r => r.grade === 'A*').cells[1].colour,'rgb(135, 207, 163)');
    assert.equal(data[0].rows.find(r => r.grade === 'A*').cells[0].colour,'rgb(255, 218, 135)');
    for (const table of data) for (const row of table.rows) {
      const maximum = Math.max(...row.cells.map(cell => parseFloat(cell.text) || 0));
      if (maximum > 0) for (const cell of row.cells.filter(cell => parseFloat(cell.text) === maximum)) assert.equal(cell.colour,'rgb(135, 207, 163)');
    }
    const physicsStar = page.locator('#matrices article').nth(0).locator('tbody tr').filter({has:page.locator('th', {hasText:/^A\*$/})});
    await physicsStar.locator('button').nth(1).click();
    await page.locator('#student-dialog').waitFor({state:'visible'});
    assert.deepEqual(await page.locator('#student-dialog tbody tr').allTextContents(),['Example 2A*A3','Example 3A*A4']);
    await page.keyboard.press('Escape'); assert.ok(await page.locator('#student-dialog').isHidden());
    await physicsStar.locator('button').nth(3).click();
    assert.match(await page.locator('#student-dialog').textContent(),/No students have this grade combination/);
    await page.locator('#student-dialog button', {hasText:'Close'}).click();
    const out = path.join(__dirname,'../test-results'); await fs.mkdir(out,{recursive:true});
    await page.evaluate(() => { window.printCalls = 0; window.print = () => { window.printCalls++; }; });
    const pdfDownload = page.waitForEvent('download');
    await page.getByRole('button', {name:'Save as PDF',exact:true}).click();
    const pdfFile = await pdfDownload;
    assert.equal(pdfFile.suggestedFilename(),'Science-grade-matrices.pdf');
    await pdfFile.saveAs(path.join(out,'matrices.pdf'));
    assert.equal(await page.evaluate(() => window.printCalls),0);
    const pdf = await fs.readFile(path.join(out,'matrices.pdf'));
    assert.equal(pdf.subarray(0,4).toString(),'%PDF');
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,3);
    const resultDownload = page.waitForEvent('download'); await page.evaluate(() => window.grades.export());
    const download = await resultDownload; await download.saveAs(path.join(out,'results.xlsx'));
    const exported = await fs.readFile(path.join(out,'results.xlsx'));
    const sheets = await page.evaluate(async bytes => {
      const book = new ExcelJS.Workbook(); await book.xlsx.load(new Uint8Array(bytes));
      return book.worksheets.map(s => ({name:s.name,rows:s.rowCount}));
    },Array.from(exported));
    assert.equal(sheets.length,6); assert.equal(sheets.find(s => s.name === 'Physics exclusions').rows,3);
    const templateDownload = page.waitForEvent('download'); await page.locator('#template').click();
    assert.equal((await templateDownload).suggestedFilename(),'Science-grades-template.xlsx');
    assert.equal(await page.locator('#Combined-gcse').count(),0); await page.locator('#calculate').click();
    assert.equal(await page.locator('#matrices article').count(),3);
    await page.locator('#Biology-alevel').selectOption('2');
    await page.locator('#Chemistry-alevel').selectOption('2');
    await page.locator('#calculate').click();
    assert.equal(await page.locator('#matrices article').count(),3);
    assert.deepEqual(await page.locator('#matrices h3').allTextContents(),['Physics GCSE → Physics A Level','Biology GCSE → Physics A Level','Chemistry GCSE → Physics A Level']);
    const shared = await page.evaluate(() => window.scienceAnalysis.analyse([
      {number:2,cells:['9','A*','8','U','7','B']},
      {number:3,cells:['8','A','8','U','7','C']}
    ],{Physics:{gcse:0,alevel:1},Biology:{gcse:2,alevel:1},Chemistry:{gcse:4,alevel:1}}));
    assert.equal(shared[1].matrix.find(r => r.grade === '8').cells[0].percent,50);
    assert.equal(shared[2].matrix.find(r => r.grade === '7').cells[1].percent,50);
    await page.locator('#calculate').click();
    assert.equal(await page.locator('#matrices article').count(),3);
    assert.ok((await page.locator('#matrices h3').allTextContents()).every(title => title.endsWith('Physics A Level')));
    await page.locator('#Physics-alevel').selectOption('1'); await page.locator('#calculate').click();
    assert.match(await page.locator('#status').textContent(),/different GCSE and A-level/);
    assert.ok(await page.locator('#results').isHidden());
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const unlabelled = await page.evaluate(async bytes => {
      const book = new ExcelJS.Workbook(); await book.xlsx.load(new Uint8Array(bytes));
      book.worksheets[0].getCell('C1').value = 'Unlabelled result';
      return Array.from(new Uint8Array(await book.xlsx.writeBuffer()));
    }, bytes);
    const secondChooser = page.waitForEvent('filechooser'); await page.locator('#open').click();
    await (await secondChooser).setFiles({name:'unlabelled.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(unlabelled)});
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Select the missing grade columns'));
    assert.ok(await page.locator('#results').isHidden());
    await page.locator('#Physics-alevel').selectOption('2'); await page.locator('#calculate').click();
    await page.locator('#results').waitFor({state:'visible'});
    assert.equal(await page.locator('#matrices article').count(),3);
    const merged = await page.evaluate(() => window.scienceAnalysis.analyse([
      {number:2,cells:['Combined pupil','','A*','','B','','C','8-7']},
      {number:3,cells:['Separate pupil','7','A','6','A','5','B','9-9']},
      {number:4,cells:['Lower pupil','','B','','A','','B','5-4']},
      {number:5,cells:['Invalid pupil','','A','','A','','A','9-7']}
    ],{Physics:{gcse:1,alevel:2},Biology:{gcse:3,alevel:4},Chemistry:{gcse:5,alevel:6},Combined:{gcse:7}}));
    assert.equal(merged.length,3);
    assert.equal(merged[0].included,3); assert.equal(merged[0].combinedIncluded,2); assert.equal(merged[0].invalid,1);
    assert.equal(merged[0].matrix.find(r => r.grade === '8').cells[0].students[0].gcse,'8-7');
    assert.equal(merged[0].matrix.find(r => r.grade === '7').cells[1].count,1);
    assert.equal(merged[0].matrix.find(r => r.grade === '5').cells[2].count,1);
    assert.equal(merged[1].matrix.find(r => r.grade === '6').cells[1].count,1);
    assert.equal(await page.evaluate(() => window.scienceAnalysis.combinedGrade('A*-A')),'A*');
    assert.deepEqual(errors,[]);
    console.log('PASS: Excel import/export, six matrices, fixed rows, colours, optional Combined Science, mapping errors and mobile layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
