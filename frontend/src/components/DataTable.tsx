import { CSVData } from "@/types/csv";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface DataTableProps {
  data: CSVData;
  maxRows?: number;
}

export function DataTable({ data, maxRows = 100 }: DataTableProps) {
  if (!data.headers.length) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        No data to display
      </div>
    );
  }

  const displayRows = data.rows.slice(0, maxRows);

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="min-w-max">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <TableRow>
                <TableHead className="w-12 text-center font-semibold text-xs text-muted-foreground">#</TableHead>
                {data.headers.map((header, index) => (
                  <TableHead 
                    key={index} 
                    className="font-semibold text-foreground whitespace-nowrap px-4"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row, rowIndex) => (
                <TableRow 
                  key={rowIndex} 
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="text-center text-xs text-muted-foreground font-mono">
                    {rowIndex + 1}
                  </TableCell>
                  {row.map((cell, cellIndex) => (
                    <TableCell 
                      key={cellIndex} 
                      className="whitespace-nowrap px-4 text-sm"
                    >
                      {cell || <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {data.rows.length > maxRows && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
          Showing {maxRows} of {data.rows.length} rows
        </div>
      )}
    </div>
  );
}
