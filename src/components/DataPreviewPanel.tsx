import { CSVData } from "@/types/csv";
import { DataTable } from "../sql_gpt/components/DataTable";
import { FileSpreadsheet, Info } from "lucide-react";

interface DataPreviewPanelProps {
  data: CSVData | null;
  sourceName: string | null;
}

export function DataPreviewPanel({ data, sourceName }: DataPreviewPanelProps) {
  if (!data) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-card p-6 h-full flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-display font-semibold text-foreground mb-2">No Data Loaded</h3>
        <p className="text-sm text-muted-foreground text-center max-w-[250px]">
          Select a sample dataset or upload your own CSV file to see a preview
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Data Preview</h2>
        </div>
        {sourceName && (
          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
            {sourceName}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.rows.length}</span> rows
          </span>
        </div>
        <span className="text-border">•</span>
        <span className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{data.headers.length}</span> columns
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 p-4 overflow-hidden">
        <DataTable data={data} />
      </div>
    </div>
  );
}
