import { ChevronLeft, ChevronRight, Download, Expand } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { ParsedAnswerTable, toCsv, downloadCsv } from "@/lib/answerTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import "./AnswerTable.scss";

interface AnswerTableProps {
  table: ParsedAnswerTable;
  fileName?: string;
}

function AnswerTableComponent({
  table,
  fileName = "table-gpt-result.csv",
}: AnswerTableProps) {
  const [maximized, setMaximized] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 100;
  const totalRows = table.rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPageIndex = Math.min(pageIndex, totalPages - 1);
  const startRow = currentPageIndex * pageSize;
  const visibleRows = useMemo(
    () => table.rows.slice(startRow, startRow + pageSize),
    [pageSize, startRow, table.rows]
  );

  useEffect(() => {
    setPageIndex(0);
  }, [table]);

  const handleDownload = () => {
    downloadCsv(fileName, toCsv(table));
  };

  const renderTable = (maxHeightClass: string) => (
    <div className={maxHeightClass}>
      <table className="answer-table__element">
        <thead className="answer-table__head">
          <tr>
            {table.headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className="answer-table__head-cell"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {visibleRows.map((row, rowIndex) => (
            <tr key={startRow + rowIndex} className="answer-table__row">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${startRow + rowIndex}-${cellIndex}`}
                  className="answer-table__cell"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderToolbar = (isFullScreen: boolean = false) => (
    <div className="answer-table__toolbar">
      <div className="answer-table__row-count">
        {totalRows > 0
          ? `${startRow + 1}-${startRow + visibleRows.length} of ${totalRows}`
          : "0 rows"}
      </div>
      {totalPages > 1 ? (
        <div className="answer-table__pager">
          <button
            onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
            disabled={currentPageIndex === 0}
            aria-label="Previous rows"
            title="Previous rows"
            className="answer-table__icon-button"
          >
            <ChevronLeft className="answer-table__icon" />
          </button>
          <button
            onClick={() => setPageIndex((page) => Math.min(totalPages - 1, page + 1))}
            disabled={currentPageIndex >= totalPages - 1}
            aria-label="Next rows"
            title="Next rows"
            className="answer-table__icon-button"
          >
            <ChevronRight className="answer-table__icon" />
          </button>
        </div>
      ) : null}
      {!isFullScreen && (
        <button
          onClick={() => setMaximized(true)}
          aria-label="Maximize table"
          title="Maximize table"
          className="answer-table__icon-button"
        >
          <Expand className="answer-table__icon" />
        </button>
      )}
      <button
        onClick={handleDownload}
        aria-label="Download CSV"
        title="Download CSV"
        className="answer-table__icon-button"
      >
        <Download className="answer-table__icon" />
      </button>
    </div>
  );

  return (
    <>
      <div className="answer-table">
        {renderToolbar(false)}
        {renderTable("answer-table__viewport")}
      </div>

      <Dialog open={maximized} onOpenChange={setMaximized}>
        <DialogContent className="answer-table__dialog">
          <DialogHeader className="answer-table__dialog-header">
            <DialogTitle className="answer-table__dialog-title">Table View</DialogTitle>
          </DialogHeader>

          <div className="answer-table__dialog-body">
            {renderToolbar(true)}
            <div className="answer-table__dialog-frame">
              {renderTable("answer-table__viewport answer-table__viewport--modal")}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const AnswerTable = memo(AnswerTableComponent);
