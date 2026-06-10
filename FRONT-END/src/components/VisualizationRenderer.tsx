import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { cn } from '@/lib/utils';

interface PlotlyTrace {
  type?: string;
  x?: (string | number)[];
  y?: (string | number)[];
  z?: number[][];
  name?: string;
  marker?: any;
  [key: string]: any;
}

interface PlotlyLayout {
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

interface PlotlyJSON {
  data: PlotlyTrace[];
  layout: PlotlyLayout;
}

interface VisualizationRendererProps {
  visualization: any;
  className?: string;
}

export function VisualizationRenderer({
  visualization,
  className,
}: VisualizationRendererProps) {
  const plotData = useMemo(() => {
    if (!visualization) return [];

    try {
      const normalize = (value: any): PlotlyJSON | null => {
        if (!value) return null;

        if (typeof value === 'string') {
          return normalize(JSON.parse(value));
        }

        if (
          value &&
          typeof value === 'object' &&
          Array.isArray(value.data) &&
          value.layout &&
          typeof value.layout === 'object'
        ) {
          return value as PlotlyJSON;
        }

        return null;
      };

      // Handle if visualization is a string (JSON)
      if (typeof visualization === 'string') {
        const parsed = JSON.parse(visualization);
        const charts = Array.isArray(parsed) ? parsed : [parsed];
        return charts.map(normalize).filter(Boolean) as PlotlyJSON[];
      }

      if (Array.isArray(visualization)) {
        return visualization.map(normalize).filter(Boolean) as PlotlyJSON[];
      }

      const singleChart = normalize(visualization);
      return singleChart ? [singleChart] : [];
    } catch (error) {
      console.error('Failed to parse visualization data:', error, visualization);
      return [];
    }
  }, [visualization]);

  if (!plotData.length) {
    return null;
  }

  return (
    <div className={cn('w-full my-4 space-y-4', className)}>
      {plotData.map((chart, index) => (
        <div key={index} className="w-full rounded-lg border border-border bg-card p-4">
          <div className="w-full overflow-x-auto">
            <Plot
              data={chart.data}
              layout={{
                ...chart.layout,
                autosize: true,
                margin: { l: 60, r: 40, t: 60, b: 60 },
              }}
              useResizeHandler={true}
              style={{
                width: '100%',
                height: `${chart.layout?.height || 500}px`,
                minHeight: '400px',
              }}
              config={{
                responsive: true,
                displayModeBar: true,
                displaylogo: false,
                modeBarButtonsToRemove: [
                  'lasso2d',
                  'select2d',
                  'autoScale2d',
                  'toggleSpikelines',
                ],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default VisualizationRenderer;
