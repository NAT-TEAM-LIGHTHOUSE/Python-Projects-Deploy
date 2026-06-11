import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const hasTabularData = (content: string): boolean => {
  return /<table[\s\S]*?>[\s\S]*?<\/table>/i.test(content) || 
         content.includes('|') ||
         /\|.*\|.*\|/.test(content);
};

export const getPdfFilename = (question: string): string => {
  const cleanQuestion = question.replace(/[?]/g, '').trim();
  const sanitized = cleanQuestion.replace(/[/\\:*?"<>|]/g, '-');
  return `${sanitized || 'response'}.pdf`;
};

export const downloadAsPdf = async (
  content: string,
  filename: string = 'bot-response.pdf',
  captureElement?: HTMLElement
): Promise<void> => {
  if (!captureElement) {
    console.error('No element provided for PDF capture');
    return;
  }

  // Clone the element to avoid modifying the original
  const clone = captureElement.cloneNode(true) as HTMLElement;
  clone.style.padding = '20px';
  clone.style.fontFamily = 'Arial, sans-serif';
  clone.style.color = '#111';
  clone.style.backgroundColor = '#fff';
  clone.style.width = 'max-content';
  clone.style.minWidth = '100%';
  
  // Find all scrollable containers and expand them
  const viewportElements = clone.querySelectorAll('[data-radix-scroll-area-viewport], .answer-table__viewport, .overflow-auto, .overflow-y-auto');
  
  viewportElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    // Remove height restrictions to show full content
    const computedStyle = window.getComputedStyle(htmlEl);
    if (computedStyle.overflow === 'auto' || computedStyle.overflow === 'hidden' || computedStyle.overflow === 'scroll') {
      htmlEl.style.overflow = 'visible';
    }
    if (computedStyle.maxHeight && computedStyle.maxHeight !== 'none') {
      htmlEl.style.maxHeight = 'none';
      htmlEl.style.height = 'auto';
    }
  });

  // Expand tables to show full content
  const tables = clone.querySelectorAll('table');
  tables.forEach((table) => {
    const htmlTable = table as HTMLElement;
    htmlTable.style.width = 'max-content';
    htmlTable.style.minWidth = '100%';
  });

  // Create a container for the clone
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = 'max-content';
  container.style.background = '#fff';
  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      height: container.scrollHeight,
      width: container.scrollWidth,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210 - 20;
    const pageHeight = 295 - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    let position = 10;
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      pdf.addPage();
      position = heightLeft - imgHeight + 10;
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
};

export const downloadMessageAsPdf = async (
  question: string,
  element?: HTMLElement
): Promise<void> => {
  const filename = getPdfFilename(question);
  return downloadAsPdf('', filename, element);
};