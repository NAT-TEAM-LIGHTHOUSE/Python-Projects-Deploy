export type ParsedAnswerTable = {
  headers: string[];
  rows: string[][];
};

const getCellText = (cell: Element) => (cell.textContent || "").trim();

const parseTableElement = (table: HTMLTableElement): ParsedAnswerTable | null => {
  const tableRows = Array.from(table.querySelectorAll("tr"));
  if (!tableRows.length) return null;

  let headers: string[] = [];
  let dataRows: string[][] = [];

  const theadHeaders = Array.from(table.querySelectorAll("thead th"))
    .map(getCellText)
    .filter(Boolean);

  if (theadHeaders.length > 0) {
    headers = theadHeaders;
    dataRows = tableRows
      .filter((tr) => !tr.closest("thead"))
      .map((tr) => Array.from(tr.querySelectorAll("td, th")).map(getCellText))
      .filter((row) => row.length > 0 && row.some(Boolean));
  } else {
    const firstRowCells = Array.from(tableRows[0].querySelectorAll("th, td"));
    const firstRowIsHeader = firstRowCells.length > 0 && firstRowCells.every((cell) => cell.tagName === "TH");

    if (firstRowIsHeader) {
      headers = firstRowCells.map(getCellText).filter(Boolean);
      dataRows = tableRows
        .slice(1)
        .map((tr) => Array.from(tr.querySelectorAll("td, th")).map(getCellText))
        .filter((row) => row.length > 0 && row.some(Boolean));
    } else {
      dataRows = tableRows
        .map((tr) => Array.from(tr.querySelectorAll("td, th")).map(getCellText))
        .filter((row) => row.length > 0 && row.some(Boolean));

      if (dataRows.length > 0) {
        headers = dataRows[0].map((_, index) => `Column ${index + 1}`);
      }
    }
  }

  if (!headers.length && !dataRows.length) return null;

  return { headers, rows: dataRows };
};

export const isHtmlTable = (content: string) => {
  if (!content) return false;
  return /<table[\s\S]*?>[\s\S]*?<\/table>/i.test(content);
};

export const parseAllHtmlTables = (content: string): ParsedAnswerTable[] => {
  const tables: ParsedAnswerTable[] = [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const tableElements = doc.querySelectorAll("table");
    
    tableElements.forEach((table) => {
      const parsed = parseTableElement(table);
      if (parsed) {
        tables.push(parsed);
      }
    });
  } catch {
    // Return empty array on error
  }
  
  return tables;
};

export const parseHtmlTable = (html: string): ParsedAnswerTable | null => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const table = doc.querySelector("table");
    if (!table) return null;

    return parseTableElement(table);
  } catch {
    return null;
  }
};

export const toCsv = (table: ParsedAnswerTable) => {
  const escapeCell = (value: string) => {
    const cell = value ?? "";
    return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  };

  const headerLine = table.headers.map(escapeCell).join(",");
  const rowLines = table.rows.map((row) => row.map(escapeCell).join(","));
  return [headerLine, ...rowLines].join("\n");
};

export const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
};

export interface ContentSection {
  type: "text" | "table";
  content: string;
  table?: ParsedAnswerTable;
}

export const parseContentWithTables = (content: string): ContentSection[] => {
  const sections: ContentSection[] = [];
  
  // Pattern to match text before/after tables and the table itself
  const tableRegex = /([\s\S]*?)(<table[\s\S]*?<\/table>)([\s\S]*)/gi;
  let lastIndex = 0;
  let match;
  let hasMatches = false;

  while ((match = tableRegex.exec(content)) !== null) {
    hasMatches = true;
    const textBefore = match[1];
    const tableHtml = match[2];
    const textAfter = match[3];
    
    // Add text before table as a section
    if (textBefore.trim()) {
      sections.push({ type: "text", content: textBefore.trim() });
    }
    
    // Add the table
    const parsed = parseHtmlTable(tableHtml);
    if (parsed) {
      sections.push({ type: "table", content: tableHtml, table: parsed });
    }
    
    // Update lastIndex to continue searching
    lastIndex = match.index + match[0].length;
    
    // If there's text after the table, we'll handle it in the next iteration
    // or at the end
    if (!textAfter.includes("<table")) {
      // No more tables in the remaining text
      if (textAfter.trim()) {
        sections.push({ type: "text", content: textAfter.trim() });
      }
      break;
    } else {
      // Put remaining text back for next iteration
      content = textAfter;
      tableRegex.lastIndex = 0;
    }
  }

  // If no tables found, treat the whole content as text
  if (!hasMatches) {
    sections.push({ type: "text", content });
  }

  return sections;
};
