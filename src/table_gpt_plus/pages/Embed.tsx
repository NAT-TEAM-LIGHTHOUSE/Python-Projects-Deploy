import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ChatPanel } from "@/components/ChatPanel";
import { StageLoader } from "@/components/StageLoader";
import SessionTimeoutDialog from "@/components/SessionTimeoutDialog";
import { CSVData, ChatMessage } from "@/types/csv";
import { Bot, History, Clock3, MessageSquareX, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import "@/pages/EmbedSessionState.css";
import "./Embed.scss";

const API_BASE = import.meta.env.VITE_API_BASE;
const EMBED_SESSION_DATA: CSVData = {
  headers: [],
  rows: [],
  rawContent: "",
};

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

type EmbedMetadata = {
  session_id?: string;
  payload_identifier?: Record<string, unknown>;
  payload_data?: {
    table_context?: string;
    custom_prompt?: string;
    aiInputData?: string;
    frame_id?: string;
    [key: string]: unknown;
  };
};

type EmbedSessionState = "active" | "expired" | "missing";

type StoredCsvBot = {
  bot_id: string;
  name: string;
};

function EmbedSessionNotice({
  title,
  description,
  sessionId,
}: {
  title: string;
  description: string;
  sessionId?: string;
}) {
  return (
    <div className="embed-session-state">
      <div className="embed-session-state__card">
        <div className="embed-session-state__badge">
          <Clock3 className="h-7 w-7" />
        </div>
        <h1 className="embed-session-state__title">{title}</h1>
        <p className="embed-session-state__description">{description}</p>
        {sessionId ? (
          <div className="embed-session-state__meta">
            Session reference: <code>{sessionId}</code>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const Embed = () => {
  const [searchParams] = useSearchParams();
  const urlSessionId = (searchParams.get("session_id") || searchParams.get("user_ref_no") || "").trim();
  const [activeSessionId, setActiveSessionId] = useState(urlSessionId);
  const [isBotSession, setIsBotSession] = useState(false);
  const sessionDeleteRequestedRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [initialSuggestions, setInitialSuggestions] = useState<string[]>([]);
  const [embedMetadata, setEmbedMetadata] = useState<EmbedMetadata | null>(null);
  const [initialSuggestionsOffset, setInitialSuggestionsOffset] = useState(0);
  const [initialSuggestionsHasMore, setInitialSuggestionsHasMore] = useState(false);
  const [initialSuggestionsTotal, setInitialSuggestionsTotal] = useState(0);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>();
  const [isStageStreaming, setIsStageStreaming] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [embedSessionState, setEmbedSessionState] = useState<EmbedSessionState>(
    urlSessionId ? "active" : "missing"
  );
  const [storedBots, setStoredBots] = useState<StoredCsvBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [botsLoading, setBotsLoading] = useState(false);
  const [botSessionLoading, setBotSessionLoading] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const shouldShowBotPicker = embedSessionState === "missing" || isBotSession;
  const lastStartedBotIdRef = useRef<string>("");
  const botPickerDisabled =
    botsLoading ||
    botSessionLoading ||
    storedBots.length === 0 ||
    isChatLoading ||
    isStageStreaming;

  // History state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyQuestions, setHistoryQuestions] = useState<string[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const input = document.querySelector<HTMLInputElement>(
          'input[placeholder="Ask a question about your data..."]'
        );
        input?.focus();
      } catch {
        // ignore
      }
    }, 200);
    return () => clearTimeout(t);
  }, [messages]);

  useEffect(() => {
    if (!activeSessionId) return;

    const deleteSessionOnUnload = () => {
      if (sessionDeleteRequestedRef.current) return;
      sessionDeleteRequestedRef.current = true;

      const payload = JSON.stringify({ user_ref_no: activeSessionId });
      const endpoint = `${API_BASE}/api/agentai/table_gpt_plus/session/delete`;

      try {
        const blob = new Blob([payload], { type: "application/json" });
        const beaconAccepted = typeof navigator !== "undefined" && navigator.sendBeacon(endpoint, blob);

        if (!beaconAccepted) {
          void fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => undefined);
        }
      } catch (_) {
        void fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => undefined);
      }
    };

    const handlePageHide = () => {
      deleteSessionOnUnload();
    };

    const handleBeforeUnload = () => {
      deleteSessionOnUnload();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeSessionId]);

  useEffect(() => {
    setActiveSessionId(urlSessionId);
    setEmbedSessionState(urlSessionId ? "active" : "missing");
  }, [urlSessionId]);

  useEffect(() => {
    if (!activeSessionId) {
      setEmbedMetadata(null);
      setInitialSuggestions([]);
      setSuggestionsLoading(false);
      setEmbedSessionState("missing");
      setIsBotSession(false);
      lastStartedBotIdRef.current = "";
      return;
    }

    let cancelled = false;

    const loadEmbedMetadata = async () => {
      setMetadataLoading(true);
      setSuggestionsLoading(true);
      setEmbedSessionState("active");
    try {
      const response = await fetch(
          `${API_BASE}/api/agentai/table_gpt_plus/chatbot/embed/session/${encodeURIComponent(activeSessionId)}`
        );

        if (!response.ok) {
          const nextState: EmbedSessionState = response.status === 404 ? "expired" : "missing";
          throw new Error(`Failed to load embed session metadata: ${response.status}:${nextState}`);
        }

        const result = await response.json();
        if (!cancelled) {
          const metadata = (result.metadata || null) as EmbedMetadata | null;
          setEmbedMetadata(metadata);
          setIsBotSession(Boolean((metadata?.payload_data as any)?.table_gpt_bot));
          const metaBotId = (metadata?.payload_data as any)?.table_gpt_bot?.bot_id;
          if (typeof metaBotId === "string" && metaBotId.trim()) {
            lastStartedBotIdRef.current = metaBotId.trim();
            setSelectedBotId(metaBotId.trim());
          }

          const suggestionPayload = {
            payload_identifier: metadata?.payload_identifier || { user_ref_no: activeSessionId },
            payload_data: {
              ...(metadata?.payload_data || {}),
            },
          };

          const suggestionResponse = await fetch(`${API_BASE}/api/agentai/table_gpt_plus/suggestions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(suggestionPayload),
          });

          if (suggestionResponse.ok) {
            const suggestionResult = await suggestionResponse.json();
            setInitialSuggestions(
              Array.isArray(suggestionResult.data) ? suggestionResult.data : []
            );
            setInitialSuggestionsOffset(suggestionResult.offset || 0);
            setInitialSuggestionsHasMore(suggestionResult.has_more || false);
            setInitialSuggestionsTotal(suggestionResult.total || 0);
          } else {
            setInitialSuggestions([]);
          }
        }
      } catch (error) {
        console.error("Failed to load embed session metadata", error);
        if (!cancelled) {
          setEmbedMetadata(null);
          setInitialSuggestions([]);
          setIsBotSession(false);
          const message = error instanceof Error ? error.message : "";
          setEmbedSessionState(message.endsWith(":expired") ? "expired" : "missing");
        }
      } finally {
        if (!cancelled) {
          setMetadataLoading(false);
          setSuggestionsLoading(false);
        }
      }
    };

    loadEmbedMetadata();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  useEffect(() => {
    if (!shouldShowBotPicker) return;
    if (storedBots.length > 0) return;

    let cancelled = false;
    const loadStoredBots = async () => {
      setBotsLoading(true);
      setBotError(null);
      try {
        const response = await fetch(`${API_BASE}/api/agentai/table_gpt_plus/chatbot/embed/bots`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result?.message || `Failed to load bots: ${response.status}`);
        }

        const bots = Array.isArray(result?.data) ? result.data : [];
        if (!cancelled) {
          setStoredBots(bots);
          setSelectedBotId((current) => current || "");
        }
      } catch (error) {
        if (!cancelled) {
          setStoredBots([]);
          setBotError(error instanceof Error ? error.message : "Failed to load bots");
        }
      } finally {
        if (!cancelled) {
          setBotsLoading(false);
        }
      }
    };

    loadStoredBots();

    return () => {
      cancelled = true;
    };
  }, [shouldShowBotPicker, storedBots.length]);

  const startStoredBotSession = useCallback(async (botId: string) => {
    const resolvedBotId = (botId || "").trim();
    if (!resolvedBotId) return;
    if (lastStartedBotIdRef.current === resolvedBotId) return;
    lastStartedBotIdRef.current = resolvedBotId;

    setBotSessionLoading(true);
    setBotError(null);
    try {
      const response = await fetch(`${API_BASE}/api/agentai/table_gpt_plus/chatbot/embed/bots/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: resolvedBotId,
          payload_identifier: {},
          payload_data: {},
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success || !result?.session_id) {
        throw new Error(result?.message || `Failed to create session: ${response.status}`);
      }

      const nextSessionId = String(result.session_id);
      setActiveSessionId(nextSessionId);
      setIsBotSession(true);
      setEmbedSessionState("active");
      setMessages([]);
      setEmbedMetadata(null);
      setInitialSuggestions([]);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?session_id=${encodeURIComponent(nextSessionId)}`
      );
    } catch (error) {
      setBotError(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setBotSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shouldShowBotPicker) return;
    if (!selectedBotId) return;
    void startStoredBotSession(selectedBotId);
  }, [selectedBotId, shouldShowBotPicker, startStoredBotSession]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeSessionId) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Session ID is missing in embed URL.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsChatLoading(true);
      setIsStageStreaming(true);
      setCurrentStage("session_dataset_loader");
      abortControllerRef.current = new AbortController();

      try {
        const payloadData = embedMetadata?.payload_data || {};
        const payloadIdentifier = embedMetadata?.payload_identifier || {
          user_ref_no: activeSessionId,
        };

        const payload = {
          payload_identifier: payloadIdentifier,
          payload_data: {
            ...payloadData,
            user_query: content,
          },
        };

        const response = await fetch(`${API_BASE}/api/agentai/table_gpt_plus/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          body: JSON.stringify(payload),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Stream request failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let finalAnswer = "";
        let hasVisualization = false;
        let visualizationSpec: any = null;
        let executionTimeSeconds: number | undefined;
        let executionTimeMs: number | undefined;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            parseSseChunk(part, (eventName, data) => {
              if (eventName === "stage") {
                setCurrentStage(data.node);
                return;
              }

              if (eventName === "final") {
                finalAnswer = data.answer || "No response received.";
                executionTimeSeconds = typeof data.execution_time_seconds === "number"
                  ? data.execution_time_seconds
                  : undefined;
                executionTimeMs = typeof data.execution_time_ms === "number"
                  ? data.execution_time_ms
                  : undefined;
                if (data.has_visualization) {
                  hasVisualization = true;
                  visualizationSpec = data.visualization_spec;
                }
              }
            });
          }
        }

        if (buffer.trim()) {
          parseSseChunk(buffer, (eventName, data) => {
            if (eventName === "stage") {
              setCurrentStage(data.node);
            }

            if (eventName === "final") {
              finalAnswer = data.answer || "No response received.";
              executionTimeSeconds = typeof data.execution_time_seconds === "number"
                ? data.execution_time_seconds
                : undefined;
              executionTimeMs = typeof data.execution_time_ms === "number"
                ? data.execution_time_ms
                : undefined;
              if (data.has_visualization) {
                hasVisualization = true;
                visualizationSpec = data.visualization_spec;
              }
            }
          });
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: finalAnswer || "No response received.",
          timestamp: new Date(),
          execution_time_seconds: executionTimeSeconds,
          execution_time_ms: executionTimeMs,
          has_visualization: hasVisualization,
          visualization_spec: visualizationSpec,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("Embed chat stream aborted by user");
          return;
        }
        console.error("Embed chat stream failed", error);
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Sorry, failed to get response.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } finally {
        setIsChatLoading(false);
        setIsStageStreaming(false);
        setCurrentStage(undefined);
        abortControllerRef.current = null;
      }
    },
    [embedMetadata, activeSessionId]
  );

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsChatLoading(false);
    setIsStageStreaming(false);
    setCurrentStage(undefined);
  }, []);

  const handleClearChat = useCallback(() => setMessages([]), []);

  // History fetch logic - for TABLE_GPT_PLUS, we need appkey and wma_object_code
  const resolvedHistoryFields = (() => {
    const pi: Record<string, unknown> = embedMetadata?.payload_identifier || {};
    const pd: Record<string, unknown> = embedMetadata?.payload_data || {};

    const pick = (...vals: Array<unknown>) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== "");

    const appkey = pick(pi["appkey"], pd["appkey"]) || "TABLE_GPT_PLUS";
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

  // For TABLE_GPT_PLUS bots, we can fetch history with just appkey and wma_object_code
  const canFetchHistory = Boolean(
    resolvedHistoryFields.appkey &&
    resolvedHistoryFields.wma_object_code
  );

  const fetchHistory = async () => {
    if (!canFetchHistory) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`${API_BASE}/api/agentai/table_gpt_plus/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload_identifier: embedMetadata?.payload_identifier || {},
          payload_data: embedMetadata?.payload_data || {},
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

  // Determine the display title for the header (prefer backend-provided bot name / file name)
  const selectedBot = storedBots.find((b) => b.bot_id === selectedBotId);
  const displayTitle = (() => {
    const pd = embedMetadata?.payload_data as Record<string, any> | undefined;

    // 1) If embed metadata includes a resolved stored bot with a display name, use it
    if (pd?.table_gpt_bot && typeof pd.table_gpt_bot === "object") {
      if (pd.table_gpt_bot.name) return String(pd.table_gpt_bot.name);
    }

    // 2) If embed metadata provides the actual table file name (from bind_stored_csv_to_session), use it
    if (pd?.table_file_name) return String(pd.table_file_name);

    // 3) Fall back to the selected bot information returned by the bots listing
    if (selectedBot?.name) return selectedBot.name;
    if ((selectedBot as any)?.file_name) return (selectedBot as any).file_name;

    // 4) Finally use generic table_context/frame_id or default text
    return (pd && (pd.table_context as string)) || (pd && (pd.frame_id as string)) || "Chat with Your Data";
  })();

  // if (embedSessionState === "missing") {
  //   return (
  //     <div className="embed-bot-picker">
  //       <div className="embed-bot-picker__panel">
  //         <div className="embed-bot-picker__badge">
  //           <Bot className="h-7 w-7" />
  //         </div>
  //         <h1 className="embed-bot-picker__title">TableGPT Bots</h1>
  //         <div className="embed-bot-picker__control">
  //           <Select
  //             value={selectedBotId}
  //             onValueChange={setSelectedBotId}
  //             disabled={botsLoading || botSessionLoading || storedBots.length === 0}
  //           >
  //             <SelectTrigger className="embed-bot-picker__select">
  //               <SelectValue placeholder={botsLoading ? "Loading bots..." : "Select a CSV bot"} />
  //             </SelectTrigger>
  //             <SelectContent>
  //               {storedBots.map((bot) => (
  //                 <SelectItem key={bot.bot_id} value={bot.bot_id}>
  //                   {bot.name}
  //                 </SelectItem>
  //               ))}
  //             </SelectContent>
  //           </Select>
  //           <Button
  //             onClick={handleStartStoredBotSession}
  //             disabled={!selectedBotId || botsLoading || botSessionLoading}
  //             className="embed-bot-picker__button"
  //           >
  //             {botSessionLoading ? "Starting..." : "Start Chat"}
  //           </Button>
  //         </div>

  //         {botError ? <div className="embed-bot-picker__error">{botError}</div> : null}
  //         {!botsLoading && storedBots.length === 0 && !botError ? (
  //           <div className="embed-bot-picker__empty">No CSV bots found.</div>
  //         ) : null}
  //       </div>
  //     </div>
  //   );
  // }

  if (embedSessionState === "expired") {
    return (
      <EmbedSessionNotice
        title="Session expired"
        description="This chat session is no longer available. Please reopen the chatbot from the source application to start a new session."
        sessionId={activeSessionId}
      />
    );
  }

  return (
    <div className="embed-page">
      <SessionTimeoutDialog
        sessionId={activeSessionId}
        isEnabled={Boolean(activeSessionId)}
        onSessionExpired={() => {
          setEmbedMetadata(null);
          setInitialSuggestions([]);
          setMessages([]);
          setEmbedSessionState("expired");
        }}
        onLogout={() => {
          setEmbedMetadata(null);
          setInitialSuggestions([]);
          setMessages([]);
          setEmbedSessionState("expired");
        }}
      />
      <main className="embed-page__main">
        <div className="embed-page__shell">
          <div className="embed-page__panel">
            <div className="embed-page__header">
              <div className="embed-page__header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div className="embed-page__brand">
                    <img
                      src="/web/agentai/table_gpt_plus/assests/icon/artificial-intelligence.svg"
                      alt="AI"
                      className="embed-page__brand-icon"
                    />
                    <h3 className="brand-title">
                      <span className="glow-text">Table</span><span>GPT</span>
                    </h3>
                  </div>
                  {/* <div style={{ flex: 1, textAlign: "center" }}>
                    {isBotSession && (
                      <h3 className="font-semibold text-sm md:text-base">
                        {displayTitle}
                      </h3>
                    )}
                  </div> */}
                  <div className="embed-page__header-actions">
                    <div className="embed-page__header-actions-row">
                      {(messages.length > 0 || isChatLoading) && (!shouldShowBotPicker || Boolean(selectedBotId)) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsSuggestionsOpen((prev) => !prev)}
                          className="text-muted-foreground hover:text-foreground text-xs md:text-sm"
                          title="Toggle suggested questions"
                        >
                          <Lightbulb className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                          <span className="hidden sm:inline">Suggestions</span>
                        </Button>
                      )}

                      {shouldShowBotPicker && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={selectedBotId}
                            onValueChange={setSelectedBotId}
                            disabled={botPickerDisabled}
                          >
                            <SelectTrigger className="embed-page__header-select" aria-label="Select Process Model">
                              <SelectValue placeholder={botsLoading ? "Loading bots..." : "Select a Process Model"} />
                            </SelectTrigger>
                            <SelectContent>
                              {storedBots.map((bot) => (
                                <SelectItem key={bot.bot_id} value={bot.bot_id}>
                                  {bot.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {(canFetchHistory || messages.length > 0) && (
                        <>
                          {canFetchHistory && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setHistoryOpen(true);
                                  fetchHistory();
                                }}
                                title="View question history"
                                className="embed-page__header-button"
                              >
                                <History className="embed-page__header-icon" />
                                {/* <span className="hidden sm:inline">History</span> */}
                              </Button>

                              <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                                <SheetContent side="left" className="embed-page__history-sheet">
                                  <div className="embed-page__history-panel">
                                    <SheetHeader className="embed-page__history-header">
                                      <SheetTitle>History</SheetTitle>
                                      <SheetDescription>Recent questions for this context.</SheetDescription>
                                      <div className="embed-page__history-refresh">
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

                                    <ScrollArea className="embed-page__history-scroll">
                                      {historyLoading ? (
                                        <div className="embed-page__history-loading">Loading...</div>
                                      ) : historyError ? (
                                        <div className="embed-page__history-error">{historyError}</div>
                                      ) : historyQuestions.length === 0 ? (
                                        <div className="embed-page__history-empty">No history found.</div>
                                      ) : (
                                        <div className="embed-page__history-list">
                                          {historyQuestions.map((q, idx) => (
                                            <div
                                              key={`${idx}`}
                                              className="embed-page__history-item"
                                              title={q}
                                              role="button"
                                              tabIndex={0}
                                              onClick={() => {
                                                if (!isChatLoading) {
                                                  setHistoryOpen(false);
                                                  handleSendMessage(q);
                                                }
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  e.preventDefault();
                                                  if (!isChatLoading) {
                                                    setHistoryOpen(false);
                                                    handleSendMessage(q);
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

                          {messages.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleClearChat}
                              title="Clear Chats"
                              className="embed-page__header-button embed-page__header-button--danger"
                            >
                              <MessageSquareX className="embed-page__header-icon" />
                              {/* <span className="hidden sm:inline">Clear Chat</span> */}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                </div>
              </div>
            </div>
            <div className="embed-page__body">
              <ChatPanel
                data={EMBED_SESSION_DATA}
                messages={messages}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearChat}
                isLoading={isChatLoading}
                inputDisabled={shouldShowBotPicker && !selectedBotId}
                showSuggestedQuestions={!shouldShowBotPicker || Boolean(selectedBotId)}
                showClearChat={true}
                hideInternalButtons={true}
                initialSuggestions={initialSuggestions}
                initialSuggestionsHasMore={initialSuggestionsHasMore}
                initialSuggestionsTotal={initialSuggestionsTotal}
                suggestionsLoadingOverride={suggestionsLoading}
                useDefaultSuggestions={false}
                showMessageLoader={false}
                hideSuggestionsButton={true}
                suggestionsPanelOpen={isSuggestionsOpen}
                historyPayloadIdentifier={embedMetadata?.payload_identifier || undefined}
                historyPayloadData={embedMetadata?.payload_data || undefined}
                streamEndpointPayload={
                  embedMetadata?.payload_identifier || embedMetadata?.payload_data?.table_gpt_bot_id
                    ? {
                        payload_identifier: embedMetadata?.payload_identifier || {},
                        payload_data: embedMetadata?.payload_data || {},
                      }
                    : undefined
                }
                customLoader={
                  isStageStreaming ? <StageLoader currentStage={currentStage} /> : null
                }
                onStopGeneration={handleStopGeneration}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Embed;
