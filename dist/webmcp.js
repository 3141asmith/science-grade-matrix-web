(() => {
  if (!document.modelContext?.registerTool) return;
  const lifecycle = new AbortController();
  window.addEventListener('pagehide', () => lifecycle.abort(), { once:true });
  try {
    Promise.resolve(document.modelContext.registerTool({
      name:'produce_science_grade_matrices',
      title:'Produce science grade matrices',
      description:'Calculate and display matrices using the workbook, worksheet and columns already selected in the page. Import and configure a workbook first.',
      inputSchema:{type:'object',properties:{},additionalProperties:false},
      annotations:{readOnlyHint:false,untrustedContentHint:true},
      async execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty options object.');
        if (!workbook) throw new Error('Import a workbook first.');
        const data = await calculate();
        return { rows:data.rows, comparisons:data.results.map(r => ({subject:r.subject,included:r.included,missing:r.missing,invalid:r.invalid})) };
      }
    },{signal:lifecycle.signal})).catch(() => {});
  } catch (_) { /* Standard browsers without this optional API still work. */ }
})();
