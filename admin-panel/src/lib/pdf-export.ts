import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ExportMetadata {
  cidade: string;
  estado: string;
  dateRange: string;
  generatedAt: string;
}

export async function exportDashboardPDF(
  elementId: string,
  metadata: ExportMetadata
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Dashboard element not found');

  // Capture the dashboard as canvas
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false, // falha rápido se algum tile não for CORS — melhor que PDF em branco silencioso
    logging: false,
    backgroundColor: '#ffffff',
    // Esconde elementos marcados com data-pdf-hide (fallback se algum widget quebrar).
    ignoreElements: (el) => el.hasAttribute('data-pdf-hide'),
  });

  // Create PDF (A4 landscape for charts)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;

  // Header
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Analise de Risco Criminal', margin, 20);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${metadata.cidade} - ${metadata.estado}`, margin, 28);

  pdf.setFontSize(9);
  pdf.setTextColor(100);
  pdf.text(`Periodo: ${metadata.dateRange}`, margin, 34);
  pdf.text(`Gerado em: ${metadata.generatedAt}`, margin, 39);
  pdf.setTextColor(0);

  // Separator line
  pdf.setDrawColor(200);
  pdf.line(margin, 42, pageWidth - margin, 42);

  // Add captured content as image
  const imgData = canvas.toDataURL('image/png');
  const contentWidth = pageWidth - margin * 2;
  const aspectRatio = canvas.height / canvas.width;
  const contentHeight = contentWidth * aspectRatio;

  const availableHeight = pageHeight - 52 - margin;

  if (contentHeight <= availableHeight) {
    // Fits on one page
    pdf.addImage(imgData, 'PNG', margin, 47, contentWidth, contentHeight);
  } else {
    // Need multiple pages - scale to fit width, split across pages
    let yOffset = 0;
    const sourceHeight = canvas.height;
    const sourceWidth = canvas.width;
    const pixelsPerPage = (availableHeight / contentWidth) * sourceWidth;
    let currentY = 47;
    let isFirstPage = true;

    while (yOffset < sourceHeight) {
      if (!isFirstPage) {
        pdf.addPage();
        currentY = margin;
      }

      const sliceHeight = Math.min(pixelsPerPage, sourceHeight - yOffset);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = sourceWidth;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(
        canvas,
        0, yOffset, sourceWidth, sliceHeight,
        0, 0, sourceWidth, sliceHeight
      );

      const sliceImgData = sliceCanvas.toDataURL('image/png');
      const sliceDisplayHeight = (sliceHeight / sourceWidth) * contentWidth;
      pdf.addImage(sliceImgData, 'PNG', margin, currentY, contentWidth, sliceDisplayHeight);

      yOffset += sliceHeight;
      isFirstPage = false;
    }
  }

  // Footer on last page
  pdf.setFontSize(8);
  pdf.setTextColor(150);
  pdf.text(
    'Gerado por PROGESTAO TECNOLOGIA - SIMEops',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  // Download
  const fileName = `relatorio-${metadata.cidade.toLowerCase().replace(/\s+/g, '-')}-${metadata.dateRange.replace(/\//g, '-')}.pdf`;
  pdf.save(fileName);
}
