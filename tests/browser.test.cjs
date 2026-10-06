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
    await page.locator('#calculate').click();
    await page.locator('#results').waitFor({state:'visible'});
    assert.equal(await page.locator('#matrices article').count(),6);
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
    assert.equal(data[0].rows.find(r => r.grade === 'A*').cells[1].colour,'rgb(255, 218, 135)');
    const out = path.join(__dirname,'../test-results'); await fs.mkdir(out,{recursive:true});
    const resultDownload = page.waitForEvent('download'); await page.locator('#export').click();
    const download = await resultDownload; await download.saveAs(path.join(out,'results.xlsx'));
    const exported = await fs.readFile(path.join(out,'results.xlsx'));
    const sheets = await page.evaluate(async bytes => {
      const book = new ExcelJS.Workbook(); await book.xlsx.load(new Uint8Array(bytes));
      return book.worksheets.map(s => ({name:s.name,rows:s.rowCount}));
    },Array.from(exported));
    assert.equal(sheets.length,12); assert.equal(sheets.find(s => s.name === 'Combined Physics exclusions').rows,3);
    const templateDownload = page.waitForEvent('download'); await page.locator('#template').click();
    assert.equal((await templateDownload).suggestedFilename(),'Science-grades-template.xlsx');
    await page.locator('#Combined-gcse').selectOption(''); await page.locator('#calculate').click();
    assert.equal(await page.locator('#matrices article').count(),3);
    await page.locator('#Physics-alevel').selectOption('1'); await page.locator('#calculate').click();
    assert.match(await page.locator('#status').textContent(),/six different/);
    assert.ok(await page.locator('#results').isHidden());
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors,[]);
    console.log('PASS: Excel import/export, six matrices, fixed rows, colours, optional Combined Science, mapping errors and mobile layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
