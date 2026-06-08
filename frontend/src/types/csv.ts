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
  execution_time_seconds?: number;
  execution_time_ms?: number;
  // Visualization support
  has_visualization?: boolean;
  visualization_spec?: any;
}
