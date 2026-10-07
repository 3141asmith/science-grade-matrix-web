(() => {
  const plain = text => text.replace(/→/g, ' -> ').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  window.saveMatricesPDF = async () => {
    const articles = [...document.querySelectorAll('#matrices article')];
    if (document.getElementById('results').hidden || !articles.length) throw new Error('Produce the matrices before saving a PDF.');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
    pdf.setProperties({title:'Science Grade Matrix',subject:'GCSE to A-level science outcomes',creator:'Science Grade Matrix'});
    pdf.setLineHeightFactor(1);
    articles.forEach((article,index) => {
      if (index) pdf.addPage();
      const table = article.querySelector('.scroll table');
      const rows = [...table.querySelectorAll('tbody tr')];
      const title = plain(article.querySelector('h3').textContent);
      const head = [[...table.querySelectorAll('thead th')].map(cell => plain(cell.textContent))];
      const body = rows.map(row => [...row.children].map((cell,col) => {
        if (col < 2) return {content:plain(cell.textContent),styles:{fillColor:[243,246,250],fontStyle:'bold'}};
        const text = `${cell.querySelector('strong').textContent}\n${cell.querySelector('small').textContent}`;
        const rgb = cell.style.backgroundColor.match(/\d+/g);
        return {content:plain(text),styles:{fillColor:rgb ? rgb.slice(0,3).map(Number) : [255,255,255]}};
      }));
      const fontSize = rows.length > 30 ? 5.5 : rows.length > 22 ? 7 : 9;
      const drawHeading = () => {
        pdf.setFont('helvetica','bold'); pdf.setFontSize(15); pdf.setTextColor(19,40,64);
        pdf.text(pdf.splitTextToSize(title,270),12,14);
        pdf.setFont('helvetica','normal'); pdf.setFontSize(9);
        pdf.text(plain(article.querySelector('.counts').textContent).replace(/·/g,' | '),12,25);
      };
      pdf.autoTable({head,body,startY:30,margin:{top:30,right:12,bottom:23,left:12},theme:'grid',
        styles:{font:'helvetica',fontSize,cellPadding:rows.length > 22 ? 0.25 : 1.5,halign:'center',valign:'middle',textColor:[32,48,75],lineColor:[219,227,236],lineWidth:0.15},
        headStyles:{fillColor:[19,40,64],textColor:[255,255,255],fontStyle:'bold'},
        columnStyles:{0:{cellWidth:24,halign:'left'},1:{cellWidth:22}},rowPageBreak:'avoid',
        willDrawPage:drawHeading,
        didDrawPage:() => {
          pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(70,87,108);
          const note = 'Observed proportions among valid paired results; not individual predictions. Each row has its own colour scale: green = row maximum; amber = half that maximum; red = lower positive values. 0% has no colour.';
          pdf.text(pdf.splitTextToSize(note,270),12,192);
          const small = article.querySelector('.sample-note');
          if (small) pdf.text(plain(small.textContent),12,197);
        }
      });
    });
    const pages = pdf.getNumberOfPages();
    for (let page=1;page<=pages;page++) {
      pdf.setPage(page); pdf.setFontSize(7); pdf.setTextColor(70,87,108);
      pdf.text(`Science Grade Matrix | Page ${page} of ${pages}`,285,204,{align:'right'});
    }
    await pdf.save('Science-grade-matrices.pdf',{returnPromise:true});
  };
})();
