import { ChatMessage as ChatMessageType } from "@/types/csv";
import { cn } from "@/lib/utils";
import { User, Bot, Clock3, Download } from "lucide-react";
import { DataTable } from "./DataTable";
import { CSVData } from "@/types/csv";
import { AnswerTable } from "./AnswerTable";
import { VisualizationRenderer } from "./VisualizationRenderer";
import { isHtmlTable, parseContentWithTables } from "@/lib/answerTable";
import { downloadMessageAsPdf, hasTabularData } from "@/lib/pdfUtils";
import { renderFormattedContent, needsSpecialRendering, parseInlineStyles } from "@/lib/formatUtils";
import { useRef } from "react";

// ////////////////// COnfig for setting to show and hide execution time in the UI.
const SHOW_EXECUTION_TIME = true;
//  This is useful for debugging and can be turned off in production if desired. ////////////////
  
function ExecutionTime({
  seconds,
  milliseconds,
}: {
  seconds?: number;
  milliseconds?: number;
}) {
  if (!SHOW_EXECUTION_TIME) return null;

  const value = seconds !== undefined
    ? `${seconds.toFixed(2)} s`
    : milliseconds !== undefined
      ? `${milliseconds} ms`
      : null;

  if (!value) return null;

  return (
    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
      <Clock3 className="h-3 w-3" aria-hidden="true" />
      <span>Execution time: {value}</span>
    </div>
  );
}

interface ChatMessageProps {
  message: ChatMessageType;
  tableData?: CSVData;
  question?: string;
}

export function ChatMessage({ message, tableData, question }: ChatMessageProps) {
  const isUser = message.role === "user";
  const containsRenderedTable = !isUser && (isHtmlTable(message.content) || message.content.includes("|"));
  const hasVisualization = !isUser && message.has_visualization && message.visualization_spec;
  const hasTabular = !isUser && hasTabularData(message.content);
  const contentRef = useRef<HTMLDivElement>(null);
  const messageWidthClass = isUser
    ? "max-w-[88%] sm:max-w-[85%]"
    : hasVisualization
      ? "w-full max-w-[100%] sm:max-w-[98%] md:max-w-[96%] xl:max-w-[94%]"
      : containsRenderedTable
        ? "w-full max-w-[100%] sm:max-w-[98%] md:max-w-[94%] xl:max-w-[92%]"
        : "max-w-[88%] sm:max-w-[85%]";

  const renderMarkdownTable = () => {
    if (!message.content.includes("|")) return null;

    const lines = message.content.split("\n");
    const tableLines: string[] = [];
    const textBefore: string[] = [];
    const textAfter: string[] = [];
    let inTable = false;
    let pastTable = false;

    lines.forEach((line) => {
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        inTable = true;
        tableLines.push(line);
      } else if (inTable && !line.trim().startsWith("|")) {
        pastTable = true;
        inTable = false;
      }

      if (!inTable && !pastTable) {
        textBefore.push(line);
      } else if (pastTable) {
        textAfter.push(line);
      }
    });

    if (tableLines.length <= 2) return null;

    const headers = tableLines[0]
      .split("|")
      .filter((h) => h.trim())
      .map((h) => h.trim());

    const rows = tableLines.slice(2).map((row) =>
      row
        .split("|")
        .filter((c) => c.trim())
        .map((c) => c.trim())
    );

    const parsedTable: CSVData = {
      headers,
      rows,
      rawContent: "",
    };

    return (
      <div className="space-y-3">
        {textBefore.join("\n").trim() && (
          <p className="text-sm w-full overflow-hidden text-ellipsis whitespace-pre-wrap">{textBefore.join("\n").trim()}</p>
        )}
        <div className="max-w-full overflow-x-auto">
          <DataTable data={parsedTable} maxRows={20} />
        </div>
        {textAfter.join("\n").trim() && (
          <p className="text-sm w-full overflow-hidden text-ellipsis whitespace-pre-wrap">{textAfter.join("\n").trim()}</p>
        )}
      </div>
    );
  };

  const renderContent = () => {
    // Check if content contains HTML tables
    if (!isUser && isHtmlTable(message.content)) {
      // Parse all tables and text sections
      const sections = parseContentWithTables(message.content);
      
      return (
        <div className="space-y-3">
          {sections.map((section, index) => {
            if (section.type === "table" && section.table) {
              return <AnswerTable key={index} table={section.table} />;
            } else if (section.type === "text") {
              // Check if text contains special elements (headings, lists)
              if (needsSpecialRendering(section.content)) {
                return <div key={index}>{renderFormattedContent(section.content)}</div>;
              }
              return (
                <p key={index} className="text-sm w-full overflow-hidden text-ellipsis whitespace-pre-wrap">
                  {parseInlineStyles(section.content)}
                </p>
              );
            }
            return null;
          })}
        </div>
      );
    }

    // Check for markdown tables
    if (!isUser) {
      const markdownTable = renderMarkdownTable();
      if (markdownTable) return markdownTable;
    }

    // Check if content needs special rendering (lists, bold text, headings)
    if (!isUser && needsSpecialRendering(message.content)) {
      return renderFormattedContent(message.content);
    }

    return (
      <p className="text-sm w-full overflow-hidden text-ellipsis whitespace-pre-wrap">
        {parseInlineStyles(message.content)}
      </p>
    );
  };

  const handleDownloadPdf = async () => {
    const questionText = question || message.content;
    await downloadMessageAsPdf(questionText, contentRef.current || undefined);
  };

  return (
    <div
      className={cn(
        "flex gap-2 sm:gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center",
          isUser ? "gradient-primary-soft" : "bg-muted"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary-foreground" />
        ) : (
          <Bot className="w-4 h-4 text-foreground" />
        )}
      </div>

      <div className={cn("min-w-0", messageWidthClass)}>
        <div
          className={cn(
            "rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 group",
            isUser
              ? "gradient-primary-soft text-primary-foreground rounded-tr-sm"
              : "bg-card border border-border shadow-card rounded-tl-sm"
          )}
          ref={contentRef}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {renderContent()}
              {hasVisualization && (
                <VisualizationRenderer visualization={message.visualization_spec} className="mt-4" />
              )}
            </div>
            {!isUser && (
              <button
                onClick={handleDownloadPdf}
                aria-label="Download as PDF"
                title="Download as PDF"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {!isUser && hasTabular && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              Note: This response contains tabular data. Use the download button above for the text version, or use the table's download button for CSV format.
            </p>
          )}
        </div>
        {!isUser && (
          <ExecutionTime
            seconds={message.execution_time_seconds}
            milliseconds={message.execution_time_ms}
          />
        )}
      </div>
    </div>
  );
}
