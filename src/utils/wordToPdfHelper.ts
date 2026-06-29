import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ConvertTextOptions {
  fontSize: number;
  lineHeight: number;
  margin: number;
  title: string;
  author: string;
}

export async function convertTextToPDF(text: string, options: ConvertTextOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // Use Helvetica standard font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // A4 size: 595.27 x 841.89 points
  const pageW = 595.27;
  const pageH = 841.89;
  
  const { fontSize, lineHeight, margin, title, author } = options;
  const contentWidth = pageW - margin * 2;
  const startY = pageH - margin;
  
  let currentPage = pdfDoc.addPage([pageW, pageH]);
  let currentY = startY;
  
  // Draw Document Title if present
  if (title) {
    currentPage.drawText(title, {
      x: margin,
      y: currentY - 10,
      size: fontSize + 8,
      font: boldFont,
      color: rgb(0.12, 0.25, 0.68), // elegant blue
    });
    currentY -= 35;
  }
  
  // Draw Author if present
  if (author) {
    currentPage.drawText(`By: ${author}`, {
      x: margin,
      y: currentY,
      size: fontSize - 2,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    });
    currentY -= 25;
  }

  // Draw thin header rule
  currentPage.drawLine({
    start: { x: margin, y: currentY + 10 },
    end: { x: pageW - margin, y: currentY + 10 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Split content into lines and draw
  const paragraphs = text.split('\n');
  
  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (trimmedPara === '') {
      currentY -= lineHeight; // blank line
      continue;
    }
    
    // Simple line wrap
    const words = trimmedPara.split(/\s+/);
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (testWidth > contentWidth) {
        // Draw current line
        if (currentY < margin + 40) {
          // Page break
          currentPage = pdfDoc.addPage([pageW, pageH]);
          currentY = startY;
        }
        
        currentPage.drawText(currentLine, {
          x: margin,
          y: currentY,
          size: fontSize,
          font: font,
          color: rgb(0.1, 0.1, 0.1),
        });
        
        currentY -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Draw trailing line
    if (currentLine) {
      if (currentY < margin + 40) {
        currentPage = pdfDoc.addPage([pageW, pageH]);
        currentY = startY;
      }
      
      currentPage.drawText(currentLine, {
        x: margin,
        y: currentY,
        size: fontSize,
        font: font,
        color: rgb(0.1, 0.1, 0.1),
      });
      currentY -= lineHeight;
    }
    
    // Add extra padding between paragraphs
    currentY -= lineHeight * 0.5;
  }
  
  // Draw footer with page numbers
  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    page.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: pageW / 2 - 25,
      y: margin - 20,
      size: 9,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    // Draw light top divider for footer
    page.drawLine({
      start: { x: margin, y: margin - 8 },
      end: { x: pageW - margin, y: margin - 8 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });
  });
  
  return await pdfDoc.save();
}
