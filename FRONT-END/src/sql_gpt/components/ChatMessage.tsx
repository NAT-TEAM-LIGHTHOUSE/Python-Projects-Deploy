import { ChatMessage as ChatMessageType } from "@/types/csv";
import { cn } from "@/lib/utils";
import { User, Bot, Download, Eye, Copy, Check, Pencil, Send, Info, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "./DataTable";
import { CSVData } from "@/types/csv";
import { AnswerTable } from "../../components/AnswerTable";
import { VisualizationRenderer } from "../../components/VisualizationRenderer";
import { isHtmlTable, parseContentWithTables } from "@/lib/answerTable";
import { downloadMessageAsPdf } from "@/lib/pdfUtils";
import { renderFormattedContent, needsSpecialRendering, parseInlineStyles } from "@/lib/formatUtils";
import { memo, useRef, useState } from "react";

interface ChatMessageProps {
  message: ChatMessageType;
  tableData?: CSVData;
  question?: string;
  onSendSql?: (sql: string) => void;
  sendDisabled?: boolean;
  showDebugInfo?: boolean;
}

const hasMarkdownTable = (content: string) => {
  const lines = content.split("\n").map((line) => line.trim());

  return lines.some((line, index) => {
    if (!line.startsWith("|") || !line.endsWith("|")) return false;

    const separator = lines[index + 1];
    return Boolean(
      separator &&
      separator.startsWith("|") &&
      separator.endsWith("|") &&
      separator
        .split("|")
        .filter((cell) => cell.trim())
        .every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
    );
  });
};

const hasCsvContent = (content: string) => {
  if (/```csv\s+[\s\S]+?```/i.test(content)) return true;

  const rows = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 3) return false;

  const columnCounts = rows.slice(0, 5).map((row) => row.split(",").length);
  return columnCounts[0] > 1 && columnCounts.every((count) => count === columnCounts[0]);
};

const hasGeneratedReport = (content: string) =>
  content.split("\n").some((line) => {
    const trimmedLine = line.trim();
    return (
      /^=+\s*[A-Z][A-Z\s]+\s*=+$/.test(trimmedLine) ||
      /^#{1,6}\s+.*\breport\b/i.test(trimmedLine)
    );
  });

function ChatMessageComponent({ 
  message, 
  tableData, 
  question,
  onSendSql,
  sendDisabled = false,
  showDebugInfo = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const containsRenderedTable = !isUser && (
    Boolean(message.result_kpis?.length) ||
    Boolean(message.result_tables?.length || message.result_table) ||
    isHtmlTable(message.content) ||
    message.content.includes("|") ||
    hasMarkdownTable(message.content)
  );
  const hasVisualization = !isUser && Boolean(message.visualization_spec);
  const hasDownloadableContent =
    !isUser &&
    Boolean(
      message.sql?.trim() ||
      containsRenderedTable ||
      hasCsvContent(message.content) ||
      hasVisualization ||
      hasGeneratedReport(message.content)
    );
  const contentRef = useRef<HTMLDivElement>(null);
  const sqlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingSql, setIsEditingSql] = useState(false);
  const [editedSql, setEditedSql] = useState(message.sql || "");
  const [showDebug, setShowDebug] = useState(false);
  const hasSqlChanged = editedSql.trim() !== (message.sql || "").trim();
  const hasDebugPayload = !isUser && showDebugInfo && Boolean(message.debug_payload);
  const finalDebugPayload = message.debug_payload?.final as Record<string, unknown> | undefined;
  const completeOpenAiResponse =
    finalDebugPayload?.openai_response ??
    message.debug_payload?.final ??
    message.debug_payload?.error ??
    message.debug_payload;
  const completeOpenAiResponseText =
    typeof completeOpenAiResponse === "string"
      ? completeOpenAiResponse
      : JSON.stringify(completeOpenAiResponse, null, 2);
  const debugRequestText = message.debug_payload?.request
    ? JSON.stringify(message.debug_payload.request, null, 2)
    : "";
  const debugGeneratedQuery =
    message.sql ||
    (typeof finalDebugPayload?.sql === "string" ? finalDebugPayload.sql : "") ||
    (typeof finalDebugPayload?.query === "string" ? finalDebugPayload.query : "");

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
    const kpiCards = !isUser && message.result_kpis?.length ? (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {message.result_kpis.map((kpi, index) => (
          <div key={`${kpi.label}-${index}`} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">
              {kpi.label}
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
            </div>
            {kpi.section ? (
              <div className="mt-1 truncate text-[11px] text-muted-foreground" title={kpi.section}>
                {kpi.section}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    ) : null;

    if (!isUser && message.result_tables?.length) {
      return (
        <div className="space-y-4">
          {message.content.trim() ? (
            <p className="text-sm w-full overflow-hidden text-ellipsis whitespace-pre-wrap">
              {parseInlineStyles(message.content)}
            </p>
          ) : null}
          {kpiCards}
          {message.result_tables.map((table, index) => (
            <div key={`${table.title || "section"}-${index}`} className="space-y-2">
              {table.title ? (
                <h3 className="text-sm font-semibold text-foreground">{table.title}</h3>
              ) : null}
              <AnswerTable table={table} />
            </div>
          ))}
        </div>
      );
    }

    if (!isUser && message.result_table) {
      let displayContent = message.content;
      if (displayContent.includes("|") && hasMarkdownTable(displayContent)) {
        displayContent = displayContent
          .split("\n")
          .filter((line) => !(line.trim().startsWith("|") && line.trim().endsWith("|")))
          .join("\n");
      }

      return (
        <div className="space-y-3">
          {displayContent.trim() ? (
            <p className="text-sm w-full overflow-hidden text-ellipsis whitespace-pre-wrap">
              {parseInlineStyles(displayContent)}
            </p>
          ) : null}
          {kpiCards}
          <AnswerTable table={message.result_table} />
        </div>
      );
    }

    if (kpiCards) {
      return (
        <div className="space-y-3">
          {message.content.trim() ? (
            <p className="text-sm w-full overflow-hidden text-ellipsis whitespace-pre-wrap">
              {parseInlineStyles(message.content)}
            </p>
          ) : null}
          {kpiCards}
        </div>
      );
    }

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

  const formattedExecutionTime = message.executionTimeMs !== undefined
    ? `${(message.executionTimeMs / 1000).toFixed(2)} seconds`
    : null;
  const handleCopySql = () => {
    const sql = editedSql;
    const textarea = sqlTextareaRef.current;
    if (!sql || !textarea) return;

    setCopied(false);

    // Start the modern clipboard write while the click still has user activation.
    let clipboardWrite: Promise<void> | null = null;
    try {
      clipboardWrite = navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(sql)
        : null;
    } catch (error) {
      console.error("Clipboard API unavailable", error);
    }

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let legacyCopySucceeded = false;
    try {
      legacyCopySucceeded = document.execCommand("copy");
    } catch (error) {
      console.error("Legacy SQL copy failed", error);
    }

    const showCopiedState = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    };

    if (legacyCopySucceeded) {
      showCopiedState();
    }

    if (clipboardWrite) {
      void clipboardWrite
        .then(() => {
          if (!legacyCopySucceeded) showCopiedState();
        })
        .catch((error) => {
          if (!legacyCopySucceeded) {
            setCopied(false);
            console.error("Failed to copy SQL query", error);
          }
        });
    }
  };

  const handleSqlDialogChange = (open: boolean) => {
    setShowSql(open);
    if (open) {
      setEditedSql(message.sql || "");
      setIsEditingSql(false);
      setCopied(false);
    }
  };

  const handleSendSql = () => {
    const sql = editedSql.trim();
    if (!sql || !hasSqlChanged || !onSendSql || sendDisabled) return;
    onSendSql(sql);
    setShowSql(false);
    setIsEditingSql(false);
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

      <div
        className={cn(
          "min-w-0 rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 group",
          isUser
            ? "max-w-[88%] sm:max-w-[85%] gradient-primary-soft text-primary-foreground rounded-tr-sm"
            : hasVisualization
              ? "w-full max-w-[100%] sm:max-w-[98%] md:max-w-[96%] xl:max-w-[94%] bg-card border border-border shadow-card rounded-tl-sm"
              : containsRenderedTable
                ? "w-full max-w-[100%] sm:max-w-[98%] md:max-w-[94%] xl:max-w-[92%] bg-card border border-border shadow-card rounded-tl-sm"
                : "max-w-[88%] sm:max-w-[85%] bg-card border border-border shadow-card rounded-tl-sm"
        )}
        ref={contentRef}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {renderContent()}
            {hasVisualization && (
              <VisualizationRenderer visualization={message.visualization_spec} className="mt-4" />
            )}
          </div>
          {!isUser && (message.sql || hasDownloadableContent || hasDebugPayload) && (
            <div className="flex items-center gap-1">
              {hasDebugPayload ? (
                <button
                  onClick={() => setShowDebug(true)}
                  aria-label="View debug response"
                  title="View debug response"
                  className="p-1 rounded hover:bg-muted"
                >
                  <Info className="w-4 h-4 text-muted-foreground" />
                </button>
              ) : null}
              {message.sql ? (
                <button
                  onClick={() => setShowSql(true)}
                  aria-label="View Query"
                  title="View Query"
                  className="p-1 rounded hover:bg-muted"
                >
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </button>
              ) : null}
              {hasDownloadableContent ? (
                <button
                  onClick={handleDownloadPdf}
                  aria-label="Download as PDF"
                  title="Download as PDF"
                  className="p-1 rounded hover:bg-muted"
                >
                  <Download className="w-4 h-4 text-muted-foreground" />
                </button>
              ) : null}
            </div>
          )}
        </div>
        {!isUser && formattedExecutionTime && (
          <div className="mt-3 text-right text-xs font-medium text-muted-foreground">
            Execution Time: {formattedExecutionTime}
          </div>
        )}
      </div>
      <Dialog open={showSql} onOpenChange={handleSqlDialogChange}>
        <DialogContent
          hideCloseButton
          className="flex h-[min(88vh,900px)] w-[min(96vw,1180px)] max-w-none flex-col gap-0 overflow-hidden p-0"
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
            <DialogHeader className="min-w-0 flex-1 space-y-1 text-left">
              <DialogTitle>Executed SQL Query</DialogTitle>
              {message.analysis ? (
                <DialogDescription>Query explanation</DialogDescription>
              ) : null}
            </DialogHeader>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCopySql}
                aria-label="Copy SQL"
                title="Copy SQL"
                className="inline-flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-muted-foreground" />
                    Copy
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingSql((current) => !current)}
                className="inline-flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
              >
                <Pencil className="w-4 h-4 text-muted-foreground" />
                {isEditingSql ? "Done" : "Edit"}
              </button>
              <button
                type="button"
                onClick={handleSendSql}
                disabled={!editedSql.trim() || !hasSqlChanged || !onSendSql || sendDisabled}
                className="inline-flex h-9 min-w-20 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Close SQL dialog"
                  title="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </DialogClose>
            </div>
          </div>
          {message.sql ? (
            <div className="min-h-0 flex-1 bg-muted/40">
              <textarea
                ref={sqlTextareaRef}
                value={editedSql}
                onChange={(event) => setEditedSql(event.target.value)}
                readOnly={!isEditingSql}
                aria-label={isEditingSql ? "Edit SQL query" : "Executed SQL query"}
                className={cn(
                  "h-full min-h-0 w-full resize-none rounded-none border-0 p-5 font-mono text-xs leading-5 outline-none",
                  isEditingSql
                    ? "bg-background focus:ring-2 focus:ring-inset focus:ring-ring"
                    : "cursor-text bg-muted/80",
                )}
              />
            </div>
          ) : null}
          {/* {message.analysis ? (
            <div className="mt-2 text-sm whitespace-pre-wrap">{message.analysis}</div>
          ) : null} */}
        </DialogContent>
      </Dialog>
      <Dialog open={showDebug} onOpenChange={setShowDebug}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Debug Mode</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto space-y-3">
            {debugRequestText ? (
              <section>
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Request
                </div>
                <pre className="rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">
                  {debugRequestText}
                </pre>
              </section>
            ) : null}
            {debugGeneratedQuery ? (
              <section>
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Generated Query
                </div>
                <pre className="rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">
                  {debugGeneratedQuery}
                </pre>
              </section>
            ) : null}
            <section>
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Complete OpenAI Response
              </div>
              <pre className="rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">
                {completeOpenAiResponseText}
              </pre>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
