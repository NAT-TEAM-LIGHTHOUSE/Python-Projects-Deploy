import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CSVData } from "@/types/csv";

interface DataTableProps {
  data: CSVData;
  maxRows?: number;
}

export function DataTable({ data, maxRows = 100 }: DataTableProps) {
  if (!data.headers.length) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No data to display
      </div>
    );
  }

  const displayRows = data.rows.slice(0, maxRows);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-card">
      <Table className="w-full min-w-max">
        <TableHeader className="bg-muted/80">
          <TableRow>
            <TableHead className="h-9 w-12 px-3 text-center text-xs font-semibold text-muted-foreground">
              #
            </TableHead>
            {data.headers.map((header, index) => (
              <TableHead
                key={index}
                className="h-9 whitespace-nowrap px-3 text-xs font-semibold text-foreground"
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map((row, rowIndex) => (
            <TableRow key={rowIndex} className="transition-colors hover:bg-muted/50">
              <TableCell className="w-12 px-3 py-2 text-center font-mono text-xs text-muted-foreground">
                {rowIndex + 1}
              </TableCell>
              {data.headers.map((_, cellIndex) => {
                const cell = row[cellIndex];

                return (
                  <TableCell key={cellIndex} className="whitespace-nowrap px-3 py-2 text-sm">
                    {cell === "" || cell == null ? (
                      <span className="italic text-muted-foreground">&mdash;</span>
                    ) : (
                      cell
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.rows.length > maxRows && (
        <div className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Showing {displayRows.length} of {data.rows.length} rows
        </div>
      )}
    </div>
  );
}
