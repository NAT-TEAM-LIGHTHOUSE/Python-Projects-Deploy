// Frontend Data Structure Reference for Visualization
// TypeScript types only - React components are in separate files

export interface ChatResponse {
  final_answer: string;
  status: string;
  chat_history: ChatMessage[];
  current_stage: string;
  current_stage_label: string;
  has_visualization: boolean;
  visualization_spec: PlotlyJSON;
}

export interface PlotlyJSON {
  data: PlotlyTrace[];
  layout: PlotlyLayout;
}

export interface PlotlyTrace {
  type?: ChartType;
  x?: (string | number)[];
  y?: (string | number)[];
  z?: number[][];
  name?: string;
  marker?: {
    color?: string | number[];
    colorscale?: string;
  };
  [key: string]: any;
}

export interface PlotlyLayout {
  title?: {
    text?: string;
  } | string;
  xaxis?: {
    title?: string;
  };
  yaxis?: {
    title?: string;
  };
  hovermode?: string;
  template?: string;
  height?: number;
  [key: string]: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap' | 'box' | 'histogram' | 'area';

export interface VisualizationRequest {
  needs_visualization: boolean;
  chart_type: ChartType;
  title: string;
  x_axis: string;
  y_axis: string;
  color_by?: string;
  reasoning: string;
}

export interface TableGPTResponse {
  session_id: string;
  final_answer: string;
  status: 'completed' | 'error' | 'running';
  chat_history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  current_stage: string;
  has_visualization: boolean;
  visualization_spec: PlotlyJSON | null;
  execution_output?: string;
  execution_error?: string;
}
