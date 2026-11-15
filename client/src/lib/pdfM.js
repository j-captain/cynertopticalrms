import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const money = (n) =>
  `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;

const fmtDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/* ------------------------------------------------------------------ */
/* Safe wrapper around autoTable                                       */
/* ------------------------------------------------------------------ */
const runAutoTable = (doc, options, fallbackY) => {
  let finalY = fallbackY;
  const merged = {
    ...options,
    didDrawPage: (data) => {
      if (data && data.cursor && typeof data.cursor.y === 'number') {
        finalY = data.cursor.y;
      }
      if (typeof options.didDrawPage === 'function') {
        try { options.didDrawPage(data); } catch (_) { /* ignore */ }
      }
    },
  };

  let returned;
  try {
    returned = autoTable(doc, merged);
  } catch (err) {
    console.error('autoTable failed:', err);
    return fallbackY;
  }

  if (returned && typeof returned.finalY === 'number' && !isNaN(returned.finalY)) {
    return returned.finalY;
  }
  if (
    doc.lastAutoTable &&
    typeof doc.lastAutoTable.finalY === 'number' &&
    !isNaN(doc.lastAutoTable.finalY)
  ) {
    return doc.lastAutoTable.finalY;
  }
  if (typeof finalY === 'number' && !isNaN(finalY)) {
    return finalY;
  }
  return fallbackY;
};

/* ------------------------------------------------------------------ */
/* Header / Footer                                                     */
/* ------------------------------------------------------------------ */
const drawHeader = (doc, title, subtitle) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 22, pageWidth, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CYNERT OPTICAL', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('RECORDS MANAGEMENT SYSTEM', 14, 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(String(title).toUpperCase(), pageWidth - 14, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(subtitle || '', pageWidth - 14, 19, { align: 'right' });

  doc.setTextColor(30, 41, 59);
  return { startY: 34, pageWidth, pageHeight };
};

const drawFooter = (doc) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, 14, pageHeight - 7);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }
};

/* ------------------------------------------------------------------ */
/* Summary PDF                                                         */
/* ------------------------------------------------------------------ */
export const exportSummaryPdf = ({ title, subtitle, stats, grouped, extraTables }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { startY, pageHeight } = drawHeader(doc, title, subtitle);

  let y = startY;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Summary', 14, y);
  y += 4;

  const cardW = 43;
  const cardH = 16;
  const gap = 4;
  const perRow = 4;
  let cx = 14;

  (stats || []).forEach((s, i) => {
    if (i > 0 && i % perRow === 0) {
      cx = 14;
      y += cardH + gap;
    }
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');

    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(String(s.label).toUpperCase(), cx + 3, y + 5);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(String(s.value), cx + 3, y + 12);

    cx += cardW + gap;
  });

  y += cardH + 8;

  if (grouped && grouped.length) {
    const groupedY = runAutoTable(
      doc,
      {
        startY: y,
        head: [['Metric', 'Value']],
        body: grouped.map((g) => [g.label, String(g.value)]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2.2 },
        headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      },
      y
    );
    y = groupedY + 8;
  }

  if (extraTables && extraTables.length) {
    extraTables.forEach((t) => {
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(t.title || '', 14, y);
      y += 3;

      const headers = Array.isArray(t.headers) ? t.headers : [];
      const body =
        Array.isArray(t.rows) && t.rows.length
          ? t.rows
          : [[{ content: 'No data', colSpan: headers.length || 1 }]];

      const tableY = runAutoTable(
        doc,
        {
          startY: y,
          head: [headers],
          body,
          theme: 'striped',
          styles: { fontSize: 7.5, cellPadding: 2 },
          headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 14, right: 14 },
        },
        y
      );

      y = tableY + 8;
    });
  }

  drawFooter(doc);
  doc.save(`Cynert-Optical-RMS-${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
};

/* ------------------------------------------------------------------ */
/* Table PDF                                                           */
/* ------------------------------------------------------------------ */
export const exportTablePdf = ({ title, subtitle, columns, rows }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const { startY } = drawHeader(doc, title, subtitle);

  // FIX: no fixed-mm widths. AutoTable auto-distributes the available width
  // across all columns (tableWidth: 'auto'), so adding/removing columns can
  // never clip the right-hand side again. We only hint alignment.
  const stylesByHeader = {
    '#':         { halign: 'right' },
    'Total':     { halign: 'right' },
    'Lens Amt':  { halign: 'right' },
    'Frame Amt': { halign: 'right' },
    'Submitted': { halign: 'center' },
    'Pre-Auth':  { halign: 'center' },
    'Status':    { halign: 'center' },
    'Mode':      { halign: 'center' },
    'Emails':    { halign: 'center' },
  };

  const columnStyles = {};
  (columns || []).forEach((col, idx) => {
    if (stylesByHeader[col]) columnStyles[idx] = stylesByHeader[col];
  });

  const body =
    Array.isArray(rows) && rows.length
      ? rows
      : [[{ content: 'No data', colSpan: (columns || []).length || 1 }]];

  runAutoTable(
    doc,
    {
      startY,
      head: [columns || []],
      body,
      theme: 'striped',
      styles: {
        fontSize: 6.5,
        cellPadding: 1.5,
        overflow: 'linebreak',
        textColor: [30, 41, 59],
        lineColor: [241, 245, 249],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [14, 165, 233],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles,
      margin: { left: 6, right: 6 },
      tableWidth: 'auto',
    },
    startY
  );

  drawFooter(doc);
  doc.save(`Cynert-Optical-RMS-${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
};