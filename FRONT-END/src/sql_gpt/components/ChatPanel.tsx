import {
  ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { ChatMessage as ChatMessageType, CSVData } from "@/types/csv";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "../../components/Loader";
import { SuggestionStageLoader } from "../../components/StageSuggestionLoader";
import { StageLoader } from "@/sql_gpt/components/StageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, History, MessageSquareX, Square, ChevronDown } from "lucide-react";
import { buildFallbackChartFromMessages, buildFallbackChartSpec, groundChartAnswer } from "@/lib/chartResponse";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5010';
const DEBUG_ENABLED = String(import.meta.env.VITE_DEBUG || "").toLowerCase() === "true";

const parseSseChunk = (
  chunk: string,
  onEvent: (eventName: string, data: any) => void
) => {
  const events = chunk.split("\n\n");

  for (const rawEvent of events) {
    const trimmed = rawEvent.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n");
    let eventName = "message";
    let dataText = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.replace("event:", "").trim();
      } else if (line.startsWith("data:")) {
        dataText += line.replace("data:", "").trim();
      }
    }

    if (!dataText) continue;

    try {
      onEvent(eventName, JSON.parse(dataText));
    } catch (error) {
      console.error("Failed to parse SSE event", { eventName, dataText, error });
    }
  }
};

const serializeConversationHistory = (messages: ChatMessageType[]) =>
  messages.slice(-8).map((message) => ({
    role: message.role,
    content: message.content,
  }));

interface ChatPanelProps {
  data: CSVData | null;
  messages: ChatMessageType[];
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
  isLoading: boolean;
  showClearChat?: boolean;
  onActiveMessagesCountChange?: (count: number) => void;
  suggestionsLayout?: "responsive" | "single";
  initialSuggestions?: string[];
  suggestionsLoadingOverride?: boolean;
  useDefaultSuggestions?: boolean;
  showMessageLoader?: boolean;
  customLoader?: ReactNode;
  historyPayloadIdentifier?: Record<string, unknown>;
  historyPayloadData?: Record<string, unknown>;
  hideInternalButtons?: boolean;
  inputDisabled?: boolean;
  showSuggestedQuestions?: boolean;
  isSuggestionsPanelOpen?: boolean;
  useStreamEndpoint?: boolean;
  streamEndpointPayload?: {
    payload_identifier?: Record<string, unknown>;
    payload_data?: Record<string, unknown>;
  };
  initialSuggestionsHasMore?: boolean;
  initialSuggestionsTotal?: number;
  onStopGeneration?: () => void;
  onSuggestionClick?: () => void;
}

export type ChatPanelHandle = {
  clearChat: () => void;
};

const SUGGESTED_QUESTIONS = [
  "Show me all records in the data",
  "What are the column names?",
  "How many rows are there?",
  "Summarize this dataset",
  "What's the average of numeric columns?",
  "Show me the first 5 rows",
];

export const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel(
  {
    data,
    messages,
    onSendMessage,
    onClearChat,
    isLoading,
    showClearChat = false,
    onActiveMessagesCountChange,
    suggestionsLayout = "responsive",
    initialSuggestions = [],
    suggestionsLoadingOverride = false,
    useDefaultSuggestions = true,
    showMessageLoader = true,
    customLoader,
    historyPayloadIdentifier,
    historyPayloadData,
    hideInternalButtons = false,
    useStreamEndpoint = false,
    streamEndpointPayload,
    initialSuggestionsHasMore = false,
    initialSuggestionsTotal = 0,
    onStopGeneration,
    inputDisabled = false,
    showSuggestedQuestions = true,
    isSuggestionsPanelOpen = true,
    onSuggestionClick,
  },
  ref
) {
  const [input, setInput] = useState("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionStage, setSuggestionStage] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>(initialSuggestions || []);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [suggestionHasMore, setSuggestionHasMore] = useState(initialSuggestionsHasMore);
  const [suggestionTotal, setSuggestionTotal] = useState(initialSuggestionsTotal);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [suggestionSearchTerm, setSuggestionSearchTerm] = useState("");
  const [isLg, setIsLg] = useState<boolean>(typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const showSuggestionsLoader = suggestionsLoading || suggestionsLoadingOverride;
  const MIN_TEXTAREA_HEIGHT = 40; // px, matches previous single-line input height (h-10)
  const MAX_TEXTAREA_HEIGHT = 200; // px, cap before showing scrollbar

  const adjustTextareaHeight = (el?: HTMLTextAreaElement | null) => {
    const ta = el || textareaRef.current;
    if (!ta) return;
    try {
      ta.style.height = "auto";
      const newHeight = Math.min(ta.scrollHeight, MAX_TEXTAREA_HEIGHT);
      ta.style.height = `${Math.max(newHeight, MIN_TEXTAREA_HEIGHT)}px`;
      ta.style.overflowY = ta.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
    } catch (e) {
      // ignore
    }
  };
  const [internalMessages, setInternalMessages] = useState<ChatMessageType[]>([]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyQuestions, setHistoryQuestions] = useState<string[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>();
  const [isStageStreaming, setIsStageStreaming] = useState(false);
  const activeMessages = useStreamEndpoint ? internalMessages : messages;
  const isBusy = isLoading || isStreaming;
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    onActiveMessagesCountChange?.(activeMessages.length);
  }, [activeMessages.length, onActiveMessagesCountChange]);

  useEffect(() => {
    if (!DEBUG_ENABLED) return;

    const handleDebugKey = (event: KeyboardEvent) => {
      if (event.key !== "F2") return;
      event.preventDefault();
      setShowDebugInfo((current) => !current);
    };

    window.addEventListener("keydown", handleDebugKey);
    return () => window.removeEventListener("keydown", handleDebugKey);
  }, []);

  // Fetch suggestions from API
    // const fetchSuggestions = async () => {
    // if (!data) return;
    // // if initialSuggestions were provided, skip fetching
    // if (initialSuggestions && initialSuggestions.length > 0) {
    //   setSuggestionsLoading(false);
    //   return;
    // }
    // setSuggestionsLoading(true);
    // try {
    //   // Convert CSV data to CSV string format
    //   const csvContent = [data.headers.join(','), ...data.rows.map(row => row.join(','))].join('\n');
      
    //   const requestBody = {
    //     payload_data: {
    //       table_data: csvContent,
    //       table_context: data.headers.join(', ')
    //     },
    //     payload_identifier: {}
    //   };
  const fetchSuggestions = async () => {
    if (!data && !streamEndpointPayload?.payload_data?.table_gpt_bot_id) return;
    setSuggestionsLoading(true);
    try {
      const requestBody: Record<string, unknown> = {
        payload_identifier: streamEndpointPayload?.payload_identifier || {},
      };

      // Include payload_data fields for bot identification
      if (streamEndpointPayload?.payload_data) {
        requestBody.payload_data = {
          ...streamEndpointPayload.payload_data,
          suggestion_offset: 0,
          suggestion_limit: 200,
        };
      } else if (data) {
        // Convert CSV data to CSV string format
        const csvContent = [data.headers.join(','), ...data.rows.map(row => row.join(','))].join('\n');
        requestBody.payload_data = {
          table_data: csvContent,
          table_context: data.headers.join(', '),
          suggestion_offset: 0,
          suggestion_limit: 200,
        };
      }

      const response = await fetch(`${API_BASE}/api/agentai/sql_gpt/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data && Array.isArray(result.data)) {
          setSuggestions(result.data);
          setSuggestionHasMore(result.has_more === true || (result.total || 0) > result.data.length);
          setSuggestionTotal(result.total || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const scrollToLatestMessage = () => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }

    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement | null;

    if (viewport) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(scrollToLatestMessage);
    return () => window.cancelAnimationFrame(frame);
  }, [messages, internalMessages, isLoading, isStreaming, isStageStreaming, currentStage]);

  // When we switch to stream mode, start with any provided messages once.
  const streamHydratedRef = useRef(false);
  useEffect(() => {
    if (!useStreamEndpoint) {
      streamHydratedRef.current = false;
      return;
    }

    if (!streamHydratedRef.current) {
      setInternalMessages(messages);
      streamHydratedRef.current = true;
    }
  }, [useStreamEndpoint, messages]);

  useEffect(() => {
    if (initialSuggestions && initialSuggestions.length > 0) {
      setSuggestions(initialSuggestions);
      setSuggestionHasMore(initialSuggestionsHasMore);
      setSuggestionTotal(initialSuggestionsTotal);
      setSuggestionsLoading(false);
      if (!suggestionsLoadingOverride) {
        setSuggestionStage(2);
      }
    }
  }, [initialSuggestions, initialSuggestionsHasMore, initialSuggestionsTotal, suggestionsLoadingOverride]);

  // Handle See More button click
  const handleSeeMore = () => {
    if (suggestionHasMore && activeSuggestions.length <= 6) {
      fetchSuggestions();
    }
    setSuggestionsExpanded(true);
  };

  // Auto-progress through suggestion stages
  useEffect(() => {
    if (showSuggestionsLoader) {
      // Start from stage 0 when loading begins
      setSuggestionStage(0);

      // Progress to stage 1 after 1 second
      const timer1 = setTimeout(() => setSuggestionStage(1), 3000);

      // Progress to stage 2 after 3 seconds (pause on analyzing, then frame suggestions)
      const timer2 = setTimeout(() => setSuggestionStage(2), 5000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      // When loading completes, show final stage
      setSuggestionStage(2);
    }
  }, [showSuggestionsLoader]);

  // Track large (lg) breakpoint to adjust how many suggestions we show
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const handle = (e: MediaQueryListEvent | MediaQueryList) => setIsLg(('matches' in e) ? e.matches : mq.matches);
    setIsLg(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', handle as EventListener);
    else mq.addListener(handle as unknown as (e: MediaQueryListEvent) => void);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handle as EventListener);
      else mq.removeListener(handle as unknown as (e: MediaQueryListEvent) => void);
    };
  }, []);

  useEffect(() => {
    // Fetch suggestions if we have data or streamEndpointPayload with bot_id
    if ((data && data.headers.length > 0 && data.rows.length > 0) ||
        (streamEndpointPayload?.payload_data?.table_gpt_bot_id)) {
      fetchSuggestions();
    } else {
      setSuggestionsLoading(false);
    }
  }, [data, streamEndpointPayload?.payload_data?.table_gpt_bot_id]);
  //   if (data && data.headers.length > 0 && data.rows.length > 0) {
  //     fetchSuggestions();
  //   } else {
  //     setSuggestionsLoading(false);
  //   }
  // }, [data]);

  const submitInput = (contentRaw?: string) => {
    const content = (typeof contentRaw === "string" ? contentRaw : input).trim();
    if (!content || isBusy) return;
    setInput("");
    window.requestAnimationFrame(scrollToLatestMessage);

    if (useStreamEndpoint && streamEndpointPayload) {
      sendStreamMessage(content);
    } else {
      onSendMessage(content);
    }
    // Reset textarea height after submit
    try {
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
        textareaRef.current.style.overflowY = "hidden";
      }
    } catch {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitInput();
  };

  const resolvedHistoryFields = (() => {
    const pi: Record<string, unknown> = historyPayloadIdentifier || {};
    const pd: Record<string, unknown> = historyPayloadData || {};

    const pick = (...vals: Array<unknown>) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== "");

    const appkey = pick(pi["appkey"], pd["appkey"]);
    const user_code = pick(pi["user_code"], pd["user_code"]);
    const wma_object_code = pick(
      pi["wma_object_code"],
      pi["wmaObjectCode"],
      pd["wma_object_code"],
      pd["wmaObjectCode"],
    );
    const app_page_frame_seqid = pick(
      pi["app_page_frame_seqid"],
      pi["appPageFrameSeqid"],
      pd["app_page_frame_seqid"],
      pd["appPageFrameSeqid"],
      pd["frame_id"],
    );

    return { appkey, user_code, wma_object_code, app_page_frame_seqid };
  })();

  const canFetchHistory = Boolean(
    resolvedHistoryFields.appkey &&
      resolvedHistoryFields.user_code &&
      resolvedHistoryFields.wma_object_code &&
      resolvedHistoryFields.app_page_frame_seqid
  );

  const fetchHistory = async () => {
    if (!canFetchHistory) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`${API_BASE}/api/agentai/sql_gpt/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload_identifier: historyPayloadIdentifier || {},
          payload_data: historyPayloadData || {},
          limit: 50,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.detail || `Failed with status ${res.status}`);
      }
      setHistoryQuestions(Array.isArray(json?.questions) ? json.questions : []);
    } catch (e: unknown) {
      setHistoryQuestions([]);
      setHistoryError(e instanceof Error ? e.message : "Failed to fetch history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    if (!isBusy && data) {
      if (useStreamEndpoint && streamEndpointPayload) {
        sendStreamMessage(question);
      } else {
        onSendMessage(question);
      }
      onSuggestionClick?.();
    }
  };

  const sendStreamMessage = async (content: string) => {
    if (!streamEndpointPayload) {
      onSendMessage(content);
      return;
    }

    const requestStartedAt = performance.now();
    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date()
    };

    setIsStreaming(true);
    setIsStageStreaming(true);
    setCurrentStage("session_dataset_loader");
    setInternalMessages((prev) => [...prev, userMessage]);
    abortControllerRef.current = new AbortController();
    let debugRequest: unknown;
    let debugResponseStatus: number | undefined;
    const debugEvents: Array<{ event: string; data: unknown }> = [];
    let debugFinal: unknown;

    try {
      const payloadIdentifier = streamEndpointPayload?.payload_identifier || {};
      const payloadData = streamEndpointPayload?.payload_data || {};

      const payload = {
        payload_identifier: payloadIdentifier,
        payload_data: {
          ...payloadData,
          user_query: content,
          conversation_history: serializeConversationHistory(activeMessages),
          debug: DEBUG_ENABLED,
        },
      };
      debugRequest = payload;

      const response = await fetch(`${API_BASE}/api/agentai/sql_gpt/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal,
      });
      debugResponseStatus = response.status;

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finalAnswer = "";
      let finalSql = "";
      let finalAnalysis = "";
      let finalKpis: ChatMessageType["result_kpis"];
      let finalResultTable: ChatMessageType["result_table"];
      let finalResultTables: ChatMessageType["result_tables"];
      let hasVisualization = false;
      let visualizationSpec: any = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          parseSseChunk(part, (eventName, data) => {
            debugEvents.push({ event: eventName, data });
            if (eventName === "stage") {
              setCurrentStage(data.node);
              if (data?.sql && !finalSql) finalSql = data.sql;
              if (data?.analysis && !finalAnalysis) finalAnalysis = data.analysis;
              return;
            }

            if (eventName === "final") {
              debugFinal = data;
              finalAnswer = data.answer || "No response received.";
              finalSql = data.sql || finalSql;
              finalAnalysis = data.analysis || finalAnalysis;
              finalKpis = data.result_kpis || finalKpis;
              finalResultTable = data.result_table || finalResultTable;
              finalResultTables = data.result_tables || finalResultTables;
              // Extract visualization data if present
              if (data.has_visualization || data.visualization_spec) {
                hasVisualization = true;
                visualizationSpec = data.visualization_spec;
              }
            }
          });
        }
      }

      if (buffer.trim()) {
        parseSseChunk(buffer, (eventName, data) => {
          debugEvents.push({ event: eventName, data });
          if (eventName === "stage") {
            setCurrentStage(data.node);
            if (data?.sql && !finalSql) finalSql = data.sql;
            if (data?.analysis && !finalAnalysis) finalAnalysis = data.analysis;
            return;
          }

          if (eventName === "final") {
            debugFinal = data;
            finalAnswer = data.answer || "No response received.";
            finalSql = data.sql || finalSql;
            finalAnalysis = data.analysis || finalAnalysis;
            finalKpis = data.result_kpis || finalKpis;
            finalResultTable = data.result_table || finalResultTable;
            finalResultTables = data.result_tables || finalResultTables;
            // Extract visualization data if present
            if (data.has_visualization || data.visualization_spec) {
              hasVisualization = true;
              visualizationSpec = data.visualization_spec;
            }
          }
        });
      }

      const finalVisualizationSpec =
        visualizationSpec ||
        buildFallbackChartSpec(content, finalResultTable, finalResultTables) ||
        buildFallbackChartFromMessages(content, activeMessages);
      const assistantMessage: ChatMessageType = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: groundChartAnswer(
          content,
          finalAnswer || "No response received.",
          finalVisualizationSpec,
          finalResultTable,
          finalResultTables,
        ),
        timestamp: new Date(),
        executionTimeMs: performance.now() - requestStartedAt,
        has_visualization: hasVisualization || Boolean(finalVisualizationSpec),
        visualization_spec: finalVisualizationSpec,
        sql: finalSql || undefined,
        analysis: finalAnalysis || undefined,
        result_kpis: finalKpis,
        result_table: finalResultTable,
        result_tables: finalResultTables,
        debug_payload: DEBUG_ENABLED
          ? {
              status: "success",
              request: debugRequest,
              response_status: debugResponseStatus,
              events: debugEvents,
              final: debugFinal,
            }
          : undefined,
      };

      setInternalMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Chat stream aborted by user");
        return;
      }
      console.error("Streaming error:", error);
      const assistantMessage: ChatMessageType = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error processing your request.",
        timestamp: new Date(),
        executionTimeMs: performance.now() - requestStartedAt,
        debug_payload: DEBUG_ENABLED
          ? {
              status: "error",
              request: debugRequest,
              response_status: debugResponseStatus,
              events: debugEvents,
              error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
            }
          : undefined,
      };
      setInternalMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsStreaming(false);
      setIsStageStreaming(false);
      setCurrentStage(undefined);
      abortControllerRef.current = null;
    }
  };

  const handleStopClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (useStreamEndpoint) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
      setIsStageStreaming(false);
      setCurrentStage(undefined);
    }
    if (onStopGeneration) {
      onStopGeneration();
    }
  };

  const handleClearChatClick = () => {
    if (useStreamEndpoint) {
      setInternalMessages([]);
    }
    setIsStreaming(false);
    setIsStageStreaming(false);
    setCurrentStage(undefined);
    onClearChat();
  };

  useImperativeHandle(
    ref,
    () => ({
      clearChat: handleClearChatClick,
    }),
    [handleClearChatClick]
  );

  const suggestionsContainerClassName =
    suggestionsLayout === "single"
      ? "flex flex-col gap-2"
      : "grid gap-2 grid-cols-1 lg:grid-cols-2";

  const activeSuggestions = suggestions.length > 0 ? suggestions : (useDefaultSuggestions ? SUGGESTED_QUESTIONS : []);

  const renderSuggestionsList = (isSidePanel: boolean) => {
    const filteredSuggestions = suggestionSearchTerm.trim()
      ? activeSuggestions.filter((q) => q.toLowerCase().includes(suggestionSearchTerm.toLowerCase()))
      : activeSuggestions;

    const displayedSuggestions = isSidePanel || suggestionsExpanded 
      ? filteredSuggestions 
      : filteredSuggestions.slice(0, 6);
      
    const hasMoreToExpand = !isSidePanel && !suggestionsExpanded && (filteredSuggestions.length > 6 || suggestionHasMore);

    return (
      <>
        <div className={`flex-1 overflow-y-auto ${isSidePanel ? 'p-3' : 'mb-3'}`}>
          {showSuggestionsLoader ? (
            <SuggestionStageLoader currentStage={suggestionStage} />
          ) : (
            <div className={isSidePanel ? "flex flex-col gap-2" : suggestionsContainerClassName}>
              {displayedSuggestions.length > 0 ? (
                displayedSuggestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(question)}
                    disabled={isBusy || (!data && !streamEndpointPayload?.payload_data?.table_gpt_bot_id && !streamEndpointPayload?.payload_data?.bot_key)}
                    className="w-full text-left px-3 md:px-2 py-2 md:py-2 rounded-xl border border-border bg-background hover:border-primary/40 hover:shadow-md transition-all duration-200 text-xs md:text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <span className="flex items-center gap-2 md:gap-3">
                      <span className="w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                        {index + 1}
                      </span>
                      <span className="group-hover:text-primary transition-colors line-clamp-2">{question}</span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4">
                  No matching suggestions found
                </div>
              )}
            </div>
          )}
        </div>

        {!showSuggestionsLoader && hasMoreToExpand ? (
          <div className={`flex justify-center border-t border-border mt-auto shrink-0 ${isSidePanel ? 'p-2 bg-card' : 'pt-2'}`}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSeeMore}
              disabled={suggestionsLoading || isBusy}
              className="text-primary hover:text-primary/80 text-xs md:text-sm w-full"
            >
              <ChevronDown className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              See More
            </Button>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="flex flex-row w-full h-full min-h-0 overflow-hidden bg-muted/30">
      <div className="flex flex-col min-w-0 flex-1 h-full min-h-0 overflow-hidden">
      {/* Clear Chat Button - shown only when showClearChat is true */}
      {(showClearChat || canFetchHistory) && !hideInternalButtons && (
        <div className="flex justify-end gap-1 px-3 md:px-4 pt-2 md:pt-3">
          {canFetchHistory && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setHistoryOpen(true);
                  fetchHistory();
                }}
                className="text-muted-foreground hover:text-foreground text-xs md:text-sm"
              >
                <History className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                {/* <span className="hidden sm:inline">History</span> */}
              </Button>

              <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                <SheetContent side="left" className="p-0">
                  <div className="h-full flex flex-col">
                    <SheetHeader className="px-4 py-4 border-b border-border">
                      <SheetTitle>History</SheetTitle>
                      <SheetDescription>Recent questions for this context.</SheetDescription>
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchHistory}
                          disabled={historyLoading}
                        >
                          Refresh
                        </Button>
                      </div>
                    </SheetHeader>

                    <ScrollArea className="flex-1 px-4 py-3">
                      {historyLoading ? (
                        <div className="text-sm text-muted-foreground py-2">Loading...</div>
                      ) : historyError ? (
                        <div className="text-sm text-destructive py-2">{historyError}</div>
                      ) : historyQuestions.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-2">No history found.</div>
                      ) : (
                        <div className="space-y-2">
                          {historyQuestions.map((q, idx) => (
                            <div
                              key={`${idx}`}
                              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                              title={q}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (!isBusy) {
                                  setHistoryOpen(false);
                                  if (useStreamEndpoint && streamEndpointPayload) {
                                    sendStreamMessage(q);
                                  } else {
                                    onSendMessage(q);
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (!isBusy) {
                                    setHistoryOpen(false);
                                    if (useStreamEndpoint && streamEndpointPayload) {
                                      sendStreamMessage(q);
                                    } else {
                                      onSendMessage(q);
                                    }
                                  }
                                }
                              }}
                            >
                              {q}
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          )}

          {showClearChat && activeMessages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearChatClick}
            title="Clear Chats"
            className="text-muted-foreground hover:text-destructive text-xs md:text-sm "
          >
            <MessageSquareX className="w-3 h-3 md:w-4 md:h-4 mr-1" />
            <span className="hidden sm:inline">Clear Chat</span>
          </Button>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 overflow-auto px-2 pb-2 sm:px-3 md:px-4" ref={scrollAreaRef}>
        <div className="py-4">
          <div className="mx-auto w-full max-w-full sm:max-w-[640px] md:max-w-[724px] lg:max-w-[1200px] space-y-4">
          {activeMessages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center text-center mx-2 mt-2">
              {/* Card container */}
              <div className="w-full bg-card rounded-2xl border border-border shadow-sm px-4 md:px-5 py-6 md:py-6 max-h-[calc(100vh-220px)] flex flex-col">
                {/* AI Pearl Orb */}
                <div className="flex justify-center mb-4 md:mb-5">
                  <div 
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full relative animate-pulse"
                    style={{ 
                      background: 'var(--gradient-ai-pearl)',
                      boxShadow: 'var(--glow-ai-pearl)'
                    }}
                  >
                    {/* Pearl highlight - creates the 3D shine effect */}
                    <div 
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 30%, transparent 60%)'
                      }}
                    />
                    {/* Inner glow ring */}
                    <div 
                      className="absolute inset-1 rounded-full"
                      style={{
                        background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 70%)'
                      }}
                    />
                  </div>
                </div>

                <h3 className="font-bold text-foreground text-base md:text-lg mb-1">
                  Ask me anything about your data
                </h3>
                <p className="text-muted-foreground text-xs md:text-sm mb-4 md:mb-6">
                  I can help you explore, analyze, and understand your dataset.
                </p>

                {!showSuggestedQuestions ? (
                  <div className="text-center mt-4">
                    <p className="text-sm text-foreground font-semibold">Please select Process Model to proceed</p>
                  </div>
                ) : null}

                {/* Suggested Questions */}
                {showSuggestedQuestions && isSuggestionsPanelOpen ? (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 md:mb-4">
                      Suggested Questions
                    </p>
                    {renderSuggestionsList(false)}
                  </>
                ) : null}
              </div>
            </div>
            ) : (
            <>
              {activeMessages.map((message, index) => {
                const questionForMessage = message.role === 'assistant' 
                  ? activeMessages[index - 1]?.role === 'user' 
                    ? activeMessages[index - 1].content 
                    : undefined
                  : undefined;
                return (
                  <ChatMessage 
                    key={message.id} 
                    message={message}
                    tableData={data || undefined}
                    question={questionForMessage}
                    onSendSql={submitInput}
                    sendDisabled={isBusy}
                    showDebugInfo={showDebugInfo}
                  />
                );
              })}
            </>
          )}
          </div>
          {isLoading && (customLoader || (showMessageLoader ? <TypingIndicator /> : null))}
          {isStageStreaming ? (
            <StageLoader currentStage={currentStage} />
          ) : isStreaming ? (
            <TypingIndicator />
          ) : null}
          <div ref={messageEndRef} className="h-1" />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-auto shrink-0 w-full border-t border-border bg-[#e6e6e6d6] p-3 md:p-4">
        <div className="flex gap-2 items-center">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextareaHeight(e.target as HTMLTextAreaElement);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitInput();
              }
            }}
            placeholder="Ask a question about your data..."
            disabled={!data || inputDisabled}
            className="flex-1 bg-background text-sm resize-none"
            style={{ minHeight: MIN_TEXTAREA_HEIGHT, maxHeight: MAX_TEXTAREA_HEIGHT, overflowY: 'hidden' }}
          />
          {isBusy ? (
            <Button
              type="button"
              onClick={handleStopClick}
              className="px-3 md:px-5 text-white font-semibold text-sm bg-destructive hover:bg-destructive/90"
              title="Stop Generating"
            >
              <Square className="w-4 h-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim() || !data || inputDisabled}
              className="px-3 md:px-5 text-primary-foreground font-semibold text-sm"
              style={{ background: 'var(--gradient-primary)' }}
              title="Send Message"
            >
              <Send className="w-4 h-4 md:ml-1" />
            </Button>
          )}
         </div>
           <span className="block text-[11px] sm:text-xs text-muted-foreground text-center mt-2 leading-4">AI-generated responses may be inaccurate. Review and verify responses.</span>
           <span className="text-[10px] text-muted-foreground block text-end w-[100%]">v3.0.0</span>
      </form>
      </div>

      {/* Right Side Panel */}
      {showSuggestedQuestions && isSuggestionsPanelOpen && (activeMessages.length > 0 || isStreaming) ? (
        <aside className="hidden md:flex shrink-0 w-72 lg:w-80 border-l border-border bg-card flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/20">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Suggested Questions</h3>
            <div className="mt-3">
              <Input
                type="text"
                placeholder="Search suggestions..."
                value={suggestionSearchTerm}
                onChange={(e) => setSuggestionSearchTerm(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>
          {renderSuggestionsList(true)}
        </aside>
      ) : null}
    </div>
  );
});
