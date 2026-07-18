import { PDFDocument } from 'pdf-lib';

export interface ConvertTextOptions {
  fontSize: number;
  lineHeight: number;
  margin: number;
  title: string;
  author: string;
}

export async function convertTextToPDF(text: string, options: ConvertTextOptions): Promise<Uint8Array> {
  const { StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595.27;
  const pageH = 841.89;
  const { fontSize, lineHeight, margin, title, author } = options;
  const contentWidth = pageW - margin * 2;
  const startY = pageH - margin;

  let currentPage = pdfDoc.addPage([pageW, pageH]);
  let currentY = startY;

  if (title) {
    currentPage.drawText(title, { x: margin, y: currentY - 10, size: fontSize + 8, font: boldFont, color: rgb(0.12, 0.25, 0.68) });
    currentY -= 35;
  }
  if (author) {
    currentPage.drawText(`By: ${author}`, { x: margin, y: currentY, size: fontSize - 2, font, color: rgb(0.4, 0.4, 0.4) });
    currentY -= 25;
  }
  currentPage.drawLine({ start: { x: margin, y: currentY + 10 }, end: { x: pageW - margin, y: currentY + 10 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (trimmedPara === '') { currentY -= lineHeight; continue; }
    const words = trimmedPara.split(/\s+/);
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > contentWidth) {
        if (currentY < margin + 40) { currentPage = pdfDoc.addPage([pageW, pageH]); currentY = startY; }
        currentPage.drawText(currentLine, { x: margin, y: currentY, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
        currentY -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      if (currentY < margin + 40) { currentPage = pdfDoc.addPage([pageW, pageH]); currentY = startY; }
      currentPage.drawText(currentLine, { x: margin, y: currentY, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
      currentY -= lineHeight;
    }
    currentY -= lineHeight * 0.5;
  }

  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    page.drawText(`Page ${index + 1} of ${pages.length}`, { x: pageW / 2 - 25, y: margin - 20, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
    page.drawLine({ start: { x: margin, y: margin - 8 }, end: { x: pageW - margin, y: margin - 8 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
  });

  return await pdfDoc.save();
}

// NEW: Renders real HTML (with embedded images/formatting from mammoth) onto PDF pages
export async function convertHtmlToPDF(html: string, title: string): Promise<Uint8Array> {
  const A4_WIDTH_PX = 794;
  const A4_HEIGHT_PX = 1123;
  const SCALE = 2;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = `${A4_WIDTH_PX}px`;
  container.style.padding = '60px 50px';
  container.style.background = '#ffffff';
  container.style.fontFamily = 'Georgia, "Times New Roman", serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.6';
  container.style.color = '#111827';
  container.style.boxSizing = 'border-box';

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    .docx-render h1 { font-size: 24px; font-weight: 700; margin: 20px 0 10px; }
    .docx-render h2 { font-size: 20px; font-weight: 700; margin: 18px 0 8px; }
    .docx-render h3 { font-size: 16px; font-weight: 700; margin: 14px 0 6px; }
    .docx-render p { margin: 0 0 10px; }
    .docx-render img { max-width: 100%; height: auto; margin: 10px 0; display: block; }
    .docx-render table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    .docx-render td, .docx-render th { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 13px; }
    .docx-render ul, .docx-render ol { margin: 0 0 10px 20px; }
    .docx-render strong { font-weight: 700; }
    .docx-render em { font-style: italic; }
  `;
  document.head.appendChild(styleTag);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'docx-render';
  contentDiv.innerHTML = html;
  container.appendChild(contentDiv);
  document.body.appendChild(container);

  try {
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }));

    const html2canvas = (await import('html2canvas')).default;
    const fullCanvas = await html2canvas(container, {
      scale: SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: A4_WIDTH_PX,
    });

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(title || 'Document');

    const pageHeightPx = A4_HEIGHT_PX * SCALE;
    const totalHeightPx = fullCanvas.height;
    const pageWidthPx = fullCanvas.width;
    const numPages = Math.max(1, Math.ceil(totalHeightPx / pageHeightPx));
    const pageWidthPt = 595.27;
    const scaleFactor = pageWidthPt / pageWidthPx;

    for (let i = 0; i < numPages; i++) {
      const remainingHeight = totalHeightPx - i * pageHeightPx;
      const sliceHeight = Math.min(pageHeightPx, remainingHeight);

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = pageWidthPx;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(fullCanvas, 0, i * pageHeightPx, pageWidthPx, sliceHeight, 0, 0, pageWidthPx, sliceHeight);

      const jpegUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const jpegBytes = await fetch(jpegUrl).then(res => res.arrayBuffer());
      const embeddedImg = await pdfDoc.embedJpg(jpegBytes);

      const pageHeightPtFinal = sliceHeight * scaleFactor;
      const pdfPage = pdfDoc.addPage([pageWidthPt, pageHeightPtFinal]);
      pdfPage.drawImage(embeddedImg, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPtFinal });
    }

    return await pdfDoc.save();
  } finally {
    document.body.removeChild(container);
    document.head.removeChild(styleTag);
  }
}
