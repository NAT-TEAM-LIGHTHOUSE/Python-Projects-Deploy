import { SampleDataset } from "@/types/csv";

// Import CSV files as raw strings
import salesDataRaw from '../../csv_files/sales_data_sample.csv?raw';
import employeeDataRaw from '../../csv_files/Employee Master.csv?raw';

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const parseCSV = (content: string): { headers: string[], rows: string[][] } => {
  const lines = content.trim().split('\n');
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => parseCSVLine(line));
  
  return { headers, rows };
};

export const sampleDatasets: SampleDataset[] = [
  {
    id: "sales",
    name: "Sales Data",
    description: "Quarterly sales records with revenue and regions",
    data: {
      ...parseCSV(salesDataRaw),
      rawContent: salesDataRaw
    }
  },
  {
    id: "employees",
    name: "Employee Directory",
    description: "Company employees with department and salary info",
    data: {
      ...parseCSV(employeeDataRaw),
      rawContent: employeeDataRaw
    }
  }
];
