import { Download, Expand } from "lucide-react";
import { useState } from "react";
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

export function AnswerTable({
  table,
  fileName = "table-gpt-result.csv",
}: AnswerTableProps) {
  const [maximized, setMaximized] = useState(false);

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
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="answer-table__row">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
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

  return (
    <>
      <div className="answer-table">
        <div className="answer-table__toolbar">
          <button
            onClick={() => setMaximized(true)}
            aria-label="Maximize table"
            title="Maximize table"
            className="answer-table__icon-button"
          >
            <Expand className="answer-table__icon" />
          </button>
          <button
            onClick={handleDownload}
            aria-label="Download CSV"
            title="Download CSV"
            className="answer-table__icon-button"
          >
            <Download className="answer-table__icon" />
          </button>
        </div>

        {renderTable("answer-table__viewport")}
      </div>

      <Dialog open={maximized} onOpenChange={setMaximized}>
        <DialogContent className="answer-table__dialog">
          <DialogHeader className="answer-table__dialog-header">
            <DialogTitle className="answer-table__dialog-title">Table View</DialogTitle>
          </DialogHeader>

          <div className="answer-table__dialog-body">
            <div className="answer-table__dialog-frame">
              {renderTable("answer-table__viewport answer-table__viewport--modal")}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
