export interface CSVData {
  headers: string[];
  rows: string[][];
  rawContent: string;
}

export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  data: CSVData;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  executionTimeMs?: number;
  // Visualization support
  has_visualization?: boolean;
  visualization_spec?: any;
  sql?: string;
  analysis?: string;
  result_kpis?: Array<{
    label: string;
    value: string | number;
    section?: string;
  }>;
  result_table?: {
    title?: string;
    headers: string[];
    rows: string[][];
  };
  result_tables?: Array<{
    title?: string;
    headers: string[];
    rows: string[][];
  }>;
  debug_payload?: {
    status: 'success' | 'error' | 'aborted';
    request?: unknown;
    response_status?: number;
    events?: Array<{
      event: string;
      data: unknown;
    }>;
    final?: unknown;
    error?: unknown;
  };
}
