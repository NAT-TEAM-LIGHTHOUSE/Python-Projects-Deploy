import { useEffect, useState, useCallback, useRef } from "react";
import { ChatPanel } from "@/sql_gpt/components/ChatPanel";
import { StageLoader } from "@/sql_gpt/components/StageLoader";
import SessionTimeoutDialog from "@/components/SessionTimeoutDialog";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquareX } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CSVData, ChatMessage } from "@/types/csv";
import { buildFallbackChartFromMessages, buildFallbackChartSpec, groundChartAnswer } from "@/lib/chartResponse";
import "@/sql_gpt/pages/Embed.scss";
import { APP_TARGETS, getAppTarget, type AppKey } from "@/shared/config/appTargets";

const DEBUG_ENABLED = String(import.meta.env.VITE_DEBUG || "").toLowerCase() === "true";

interface SseEventData {
  node?: string;
  code?: string;
  message?: string;
  answer?: string;
  has_visualization?: boolean;
  visualization_spec?: unknown;
  sql?: string;
  analysis?: string;
  result_kpis?: ChatMessage["result_kpis"];
  result_table?: ChatMessage["result_table"];
  result_tables?: ChatMessage["result_tables"];
}

const EMBED_SESSION_DATA: CSVData = {
  headers: [],
  rows: [],
  rawContent: "",
};

const parseSseChunk = (
  chunk: string,
  onEvent: (eventName: string, data: SseEventData) => void
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

type DbLoginMetadata = {
  session_id?: string;
  payload_identifier?: Record<string, unknown>;
  payload_data?: {
    table_context?: string;
    custom_prompt?: string;
    [key: string]: unknown;
  };
};

type BotOption = {
  key: string;
  name: string;
};

type ChatbotPageProps = {
  defaultAppKey?: AppKey;
};

const normalizeBotOption = (bot: unknown): BotOption | null => {
  if (typeof bot === "string") {
    const name = bot.trim();
    const key = name.split(/\s+/)[0] || "";
    return key && name ? { key, name } : null;
  }

  const option = bot as Partial<BotOption>;
  const key = option?.key?.trim() || "";
  const name = option?.name?.trim() || key;
  return key && name ? { key, name } : null;
};

const serializeConversationHistory = (chatMessages: ChatMessage[]) =>
  chatMessages.slice(-8).map((message) => ({
    role: message.role,
    content: message.content,
  }));

const isMissingSessionMessage = (value?: string) => {
  const message = (value || "").toLowerCase();
  return message.includes("session") && (
    message.includes("not found") ||
    message.includes("invalid") ||
    message.includes("expired")
  );
};

function ChatbotPage({ defaultAppKey = "sql_gpt" }: ChatbotPageProps) {
  const [selectedAppKey, setSelectedAppKey] = useState<AppKey>(defaultAppKey);
  const selectedApp = getAppTarget(selectedAppKey);
  const apiBase = selectedApp.apiBase;
  const botsPath = selectedApp.botsPath;
  const apiPrefix = selectedApp.apiPrefix;
  const [dbSession, setDbSession] = useState<DbLoginMetadata | null>(null);
  const [dbSessionLoading, setDbSessionLoading] = useState(false);
  const [dbSessionError, setDbSessionError] = useState<string | null>(null);
  const [bots, setBots] = useState<BotOption[]>([]);
  const [selectedBotKey, setSelectedBotKey] = useState("");
  const [botsLoading, setBotsLoading] = useState(true);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>();
  const [isStageStreaming, setIsStageStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsHasMore, setSuggestionsHasMore] = useState(false);
  const [suggestionsTotal, setSuggestionsTotal] = useState(0);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSelectedAppKey(defaultAppKey);
  }, [defaultAppKey]);

  const connectForSelectedBot = useCallback(async (botKey: string, showLoading = true) => {
    setDbSession(null);
    if (showLoading) setDbSessionLoading(true);
    setDbSessionError(null);

    const response = await fetch(`${apiBase}${apiPrefix}/db_login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tns: "",
        bot_key: botKey,
        username: botKey,
        password: botKey,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.detail || `Database connection failed: ${response.status}`);
    }

    const result = await response.json();
    if (!result.session_id) {
      throw new Error("Database connection failed: missing session id");
    }

    const metadata: DbLoginMetadata = {
      session_id: result.session_id,
      payload_identifier: { user_ref_no: result.session_id },
      payload_data: { bot_key: botKey },
    };
    sessionStorage.setItem("dbSession", JSON.stringify(metadata));
    setDbSession(metadata);
    return metadata;
  }, [apiBase, apiPrefix]);

  useEffect(() => {
    if (!selectedBotKey) {
      setDbSession(null);
      setDbSessionLoading(false);
      return;
    }

    let cancelled = false;

    const connect = async () => {
      try {
        const metadata = await connectForSelectedBot(selectedBotKey);
        if (cancelled) {
          sessionStorage.removeItem("dbSession");
          if (metadata.session_id) setDbSession(null);
        }
      } catch (error) {
        if (!cancelled) {
          sessionStorage.removeItem("dbSession");
          setDbSessionError(error instanceof Error ? error.message : "Database connection failed");
        }
      } finally {
        if (!cancelled) setDbSessionLoading(false);
      }
    };

    void connect();

    return () => {
      cancelled = true;
    };
  }, [connectForSelectedBot, selectedBotKey]);

  useEffect(() => {
    const controller = new AbortController();

    const loadBots = async () => {
      setBotsLoading(true);
      setBotsError(null);

      try {
        const response = await fetch(`${apiBase}${botsPath}`, {
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(result?.detail || `Failed to load bots: ${response.status}`);
        }
        if (!Array.isArray(result?.bots)) {
          throw new Error("The bot configuration response is invalid");
        }

        const configuredBots = result.bots
          .map(normalizeBotOption)
          .filter((bot: BotOption | null): bot is BotOption => Boolean(bot));

        if (!configuredBots.length) {
          throw new Error("No bots are configured");
        }

        setBots(configuredBots);
        setSelectedBotKey((current) =>
          current && configuredBots.some((bot: BotOption) => bot.key === current)
            ? current
            : configuredBots[0]?.key || ""
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setBots([]);
        setSelectedBotKey("");
        setBotsError(error instanceof Error ? error.message : "Failed to load bots");
      } finally {
        if (!controller.signal.aborted) setBotsLoading(false);
      }
    };

    void loadBots();
    return () => controller.abort();
  }, [apiBase, botsPath]);

  useEffect(() => {
    if (!selectedBotKey) {
      setSuggestions([]);
      setSuggestionsHasMore(false);
      setSuggestionsTotal(0);
      return;
    }

    const fetchSuggestions = async () => {
      setSuggestionsLoading(true);
      try {
        const response = await fetch(
          `${apiBase}${apiPrefix}/suggestions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payload_identifier: {},
              payload_data: {
                bot_key: selectedBotKey,
                suggestion_limit: 200,
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load suggestions: ${response.status}`);
        }

        const result = await response.json();
        if (Array.isArray(result?.data)) {
          setSuggestions(result.data);
          setSuggestionsHasMore(Boolean(result.has_more));
          setSuggestionsTotal(Number(result.total) || 0);
        } else {
          setSuggestions([]);
          setSuggestionsHasMore(false);
          setSuggestionsTotal(0);
        }
      } catch (error) {
        console.error("Failed to load suggestions", error);
        setSuggestions([]);
        setSuggestionsHasMore(false);
        setSuggestionsTotal(0);
      } finally {
        setSuggestionsLoading(false);
      }
    };

    void fetchSuggestions();
  }, [apiBase, apiPrefix, selectedBotKey]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!dbSession?.session_id) return;

      const requestStartedAt = performance.now();
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
      let debugRequest: unknown;
      let debugResponseStatus: number | undefined;
      const debugEvents: Array<{ event: string; data: unknown }> = [];
      let debugFinal: unknown;
      let finalAnswer = "";
      let finalSql = "";
      let finalAnalysis = "";
      let finalKpis: ChatMessage["result_kpis"];
      let finalResultTable: ChatMessage["result_table"];
      let finalResultTables: ChatMessage["result_tables"];
      let hasVisualization = false;
      let visualizationSpec: unknown = null;

      try {
        let activeSession = dbSession;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          finalAnswer = "";
          finalSql = "";
          finalAnalysis = "";
          finalKpis = undefined;
          finalResultTable = undefined;
          finalResultTables = undefined;
          hasVisualization = false;
          visualizationSpec = null;
          let sessionNotFound = false;

          const payload = {
            payload_identifier: activeSession.payload_identifier || { user_ref_no: activeSession.session_id },
            payload_data: {
              ...(activeSession.payload_data || {}),
              user_query: content,
              conversation_history: serializeConversationHistory(messages),
              bot_key: selectedBotKey,
              debug: DEBUG_ENABLED,
            },
          };
          debugRequest = payload;

          const response = await fetch(`${apiBase}${apiPrefix}/stream`, {
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

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";

            for (const part of parts) {
              parseSseChunk(part, (eventName, data) => {
                debugEvents.push({ event: eventName, data });
                if (
                  data.code === "SESSION_NOT_FOUND" ||
                  (eventName === "error" && isMissingSessionMessage(data.message)) ||
                  (eventName === "final" && isMissingSessionMessage(data.answer))
                ) {
                  sessionNotFound = true;
                }
                if (eventName === "stage") {
                  setCurrentStage(data.node);
                  if (data?.sql && !finalSql) finalSql = data.sql;
                  if (data?.analysis && !finalAnalysis) finalAnalysis = data.analysis;
                }
                if (eventName === "final") {
                  debugFinal = data;
                  finalAnswer = data.answer || finalAnswer || "No response received.";
                  finalSql = data.sql || finalSql;
                  finalAnalysis = data.analysis || finalAnalysis;
                  finalKpis = data.result_kpis || finalKpis;
                  finalResultTable = data.result_table || finalResultTable;
                  finalResultTables = data.result_tables || finalResultTables;
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
              if (
                data.code === "SESSION_NOT_FOUND" ||
                (eventName === "error" && isMissingSessionMessage(data.message)) ||
                (eventName === "final" && isMissingSessionMessage(data.answer))
              ) {
                sessionNotFound = true;
              }
              if (eventName === "stage") {
                setCurrentStage(data.node);
                if (data?.sql && !finalSql) finalSql = data.sql;
                if (data?.analysis && !finalAnalysis) finalAnalysis = data.analysis;
              }
              if (eventName === "final") {
                debugFinal = data;
                finalAnswer = data.answer || finalAnswer || "No response received.";
                finalSql = data.sql || finalSql;
                finalAnalysis = data.analysis || finalAnalysis;
                finalKpis = data.result_kpis || finalKpis;
                finalResultTable = data.result_table || finalResultTable;
                finalResultTables = data.result_tables || finalResultTables;
                if (data.has_visualization || data.visualization_spec) {
                  hasVisualization = true;
                  visualizationSpec = data.visualization_spec;
                }
              }
            });
          }

          if (sessionNotFound && attempt === 0) {
            activeSession = await connectForSelectedBot(selectedBotKey, false);
            continue;
          }

          break;
        }

        const finalVisualizationSpec =
          visualizationSpec ||
          buildFallbackChartSpec(content, finalResultTable, finalResultTables) ||
          buildFallbackChartFromMessages(content, messages);
        const assistantMessage: ChatMessage = {
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

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("Chat stream aborted");
          return;
        }
        console.error("Chat stream failed", error);
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "Sorry, failed to get response.",
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
        setMessages((prev) => [...prev, assistantMessage]);
      } finally {
        setIsChatLoading(false);
        setIsStageStreaming(false);
        setCurrentStage(undefined);
        abortControllerRef.current = null;
      }
    },
    [apiBase, apiPrefix, connectForSelectedBot, dbSession, messages, selectedBotKey]
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

  const handleBotChange = useCallback((botKey: string) => {
    sessionStorage.removeItem("dbSession");
    setDbSession(null);
    setDbSessionError(null);
    setMessages([]);
    setSuggestions([]);
    setSelectedBotKey(botKey);
  }, []);

  const handleAppChange = useCallback((appKey: string) => {
    const nextAppKey = appKey === "table_gpt_plus" ? "table_gpt_plus" : "sql_gpt";
    setSelectedAppKey(nextAppKey);
    setBots([]);
    setSelectedBotKey("");
    setDbSession(null);
    setDbSessionError(null);
    setMessages([]);
    setSuggestions([]);
    sessionStorage.removeItem("dbSession");
  }, []);

  return (
    <div className="embed-page">
      <SessionTimeoutDialog
        sessionId={dbSession?.session_id}
        isEnabled={Boolean(dbSession?.session_id)}
        apiBase={apiBase}
        apiPrefix={apiPrefix}
        onSessionExpired={() => {
          sessionStorage.removeItem("dbSession");
          setDbSession(null);
          setMessages([]);
          setDbSessionError("Database session expired. Select the bot again to reconnect.");
        }}
      />
      <main className="embed-page__main">
        <div className="embed-page__shell">
          <div className="embed-page__panel">
            <div className="embed-page__header">
              <div className="embed-page__header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="embed-page__brand">
                  <img
                    src={selectedApp?.iconSrc || "/web/agentai/sql_gpt/assests/icon/artificial-intelligence.svg"}
                    alt="AI"
                    className="embed-page__brand-icon"
                  />
                  <h3 className="brand-title">
                    <span className="glow-text">{selectedApp?.label || "Select app"}</span>
                  </h3>
                </div>
                <div className="embed-page__header-actions">
                  <div className="embed-page__header-actions-row">
                    <Select value={selectedAppKey} onValueChange={handleAppChange}>
                      <SelectTrigger className="embed-page__header-select" aria-label={selectedApp.botSelectAriaLabel}>
                        <SelectValue placeholder={selectedApp.botSelectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(APP_TARGETS).map((app) => (
                          <SelectItem key={app.key} value={app.key}>
                            {app.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {messages.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSuggestionsOpen(!isSuggestionsOpen)}
                        className={`mr-3 px-3 py-1.5 border shadow-sm transition-all duration-200 ${
                          isSuggestionsOpen
                            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        }`}
                        title="Toggle Suggestions"
                      >
                        <Sparkles className="w-4 h-4 mr-1.5" />
                        <span className="hidden sm:inline font-medium">Suggestions</span>
                      </Button>
                    )}
                    <Select
                      value={selectedBotKey}
                      onValueChange={handleBotChange}
                      disabled={botsLoading || Boolean(botsError) || bots.length === 0}
                    >
                      <SelectTrigger
                        className="embed-page__header-select"
                        aria-label="Select Bot"
                        title={botsError || undefined}
                      >
                        <SelectValue
                          placeholder={
                            botsLoading
                              ? "Loading bots..."
                              : botsError
                                ? "Bots unavailable"
                                : "Select Bot"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {bots.map((bot) => (
                          <SelectItem key={bot.key} value={bot.key}>
                            {bot.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {messages.length > 0 && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          handleClearChat();
                          sessionStorage.removeItem("dbSession");
                          window.location.href = `${selectedApp.routePrefix}`;
                        }}
                        title={selectedApp.clearLabel}
                        className="ml-2 h-8 w-20 text-muted-foreground hover:text-white shadow-sm"
                      >
                        <MessageSquareX className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="embed-page__body">
              {dbSessionLoading || dbSessionError ? (
                <div className="flex min-h-[360px] items-center justify-center px-6">
                  <div className="rounded-md border bg-background px-5 py-4 text-center shadow-sm">
                    <div className="text-sm font-semibold text-foreground">
                      {dbSessionLoading ? "Connecting to database..." : "Database connection failed"}
                    </div>
                    {dbSessionError ? (
                      <div className="mt-2 text-sm text-destructive">{dbSessionError}</div>
                    ) : null}
                  </div>
                </div>
              ) : (
              <ChatPanel
                data={EMBED_SESSION_DATA}
                messages={messages}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearChat}
                isLoading={isChatLoading}
                inputDisabled={!selectedBotKey || dbSessionLoading || !dbSession?.session_id}
                showSuggestedQuestions={true}
                    isSuggestionsPanelOpen={isSuggestionsOpen}
                showClearChat={true}
                hideInternalButtons={true}
                useDefaultSuggestions={false}
                initialSuggestions={suggestions}
                initialSuggestionsHasMore={suggestionsHasMore}
                initialSuggestionsTotal={suggestionsTotal}
                suggestionsLoadingOverride={suggestionsLoading}
                streamEndpointPayload={{
                  payload_data: { bot_key: selectedBotKey },
                }}
                showMessageLoader={false}
                customLoader={isStageStreaming ? <StageLoader currentStage={currentStage} /> : null}
                onSuggestionClick={() => setIsSuggestionsOpen(false)}
                onStopGeneration={handleStopGeneration}
              />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ChatbotPage;
