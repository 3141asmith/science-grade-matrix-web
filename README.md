# Science Grade Matrix — website

A browser version of the Windows app, with the same grade calculations, Excel import/export, optional Combined Science comparisons, fixed GCSE 9–4 rows and red–amber–green percentage colouring. Zero percentages have no colour.

## Use

Open the website, import an unencrypted `.xlsx` workbook, select the worksheet/header and map the six subject grade columns. Optionally map Combined Science GCSE. Produce the matrices, then export the percentages, counts and exclusion lists to Excel. Save a blank template from the import panel.

One row represents one student. GCSE grades 9–1, A*–G and U are supported; A-level grades are A*–E and U. Combined Science accepts equal/adjacent double grades, including compact `99`, `98`, `A*A*` and `AB`. Missing or unrecognised pairs are excluded separately for each comparison. The screen always shows GCSE 9–4 or Combined Science 9–9 through 4–4, plus other grades with valid pairs. Empty rows show a dash.

Colours blend from red at low positive percentages through amber at 50% to green at 100%; they describe percentage size, not outcome quality. Historical proportions are not individual predictions. Small cohorts are flagged.

Files are processed entirely inside your browser and are never uploaded. There is no server database, analytics or external CDN. Refreshing or closing the page clears imported results. Browser downloads replace the desktop app's Save dialogs.

Import limits match the desktop app: 30 MB per workbook, 100,000 rows and 300 columns per worksheet, with the first 30 nonempty rows available as headers. Formula cells use saved results; recalculate and save them in Excel first. Each spreadsheet row counts once; duplicate students are not removed automatically.

## Run locally

With Node.js installed, run `npm start`, then open http://127.0.0.1:4173. No dependency installation or build is required to serve the website. Alternatively, deploy the contents of `dist/` to a static web host. Keep all files and the `vendor/` folder together.

## Browser verification

Install Playwright for development (`npm install --no-save playwright`) and its Chromium browser (`npx playwright install chromium`), start the local server, then run `npm test`. `BROWSER_EXECUTABLE` can point to an existing Edge/Chrome installation. Tests cover real Excel import, all six matrices, colours, fixed rows, template and result downloads, exclusions, optional Combined Science, error handling and mobile overflow.

Excel support uses the bundled [ExcelJS 4.4.0](https://github.com/exceljs/exceljs) browser build; its MIT licence is included in `dist/vendor/EXCELJS-LICENSE`. No student data or credentials belong in this repository.
