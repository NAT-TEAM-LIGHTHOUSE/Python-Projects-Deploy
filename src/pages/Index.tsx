import { useCallback, useRef, useState } from "react";
import { CSVData, ChatMessage } from "@/types/csv";
import { DataSourcePanel } from "@/components/DataSourcePanel";
import { DataPreviewPanel } from "@/components/DataPreviewPanel";
import { ChatPanel, type ChatPanelHandle } from "@/sql_gpt/components/ChatPanel";
import SessionTimeoutDialog from "@/components/SessionTimeoutDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageSquare, MessageSquareX } from "lucide-react";

const Index = () => {
  const [data, setData] = useState<CSVData | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeMessageCount, setActiveMessageCount] = useState(0);
  const chatPanelRef = useRef<ChatPanelHandle | null>(null);

  const handleDataLoaded = useCallback((newData: CSVData, name: string) => {
    setData(newData);
    setSourceName(name);
    setMessages([]);
    setSessionId(
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `table-gpt-${Date.now()}`
    );
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!data) return;

    const requestStartedAt = performance.now();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    // Simulate AI response with data analysis
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const response = generateResponse(content, data);
    
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response,
      timestamp: new Date(),
      executionTimeMs: performance.now() - requestStartedAt,
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsChatLoading(false);
  }, [data]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SessionTimeoutDialog sessionId={sessionId} isEnabled={Boolean(sessionId)} />
      <div className="flex h-screen">
        {/* Left Sidebar - Data Source */}
        <aside className="w-80 flex-shrink-0 p-4">
          <DataSourcePanel 
            onDataLoaded={handleDataLoaded}
            isLoading={isLoading}
          />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-4 pl-0 min-w-0">
          {/* Data Preview - Full Height */}
          <div className="flex-1 relative">
            <DataPreviewPanel 
              data={data}
              sourceName={sourceName}
            />
            
            {/* Chat Trigger Button */}
            <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
              <SheetTrigger asChild>
                <Button 
                  className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
                  size="icon"
                >
                  <MessageSquare className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col">
                <SheetHeader className="px-6 py-4 border-b border-border flex flex-row items-center justify-between">
                  <SheetTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    Chat with Your Data
                  </SheetTitle>
                </SheetHeader>

                {/* Clear Chat placed near the sheet close (X) button */}
                {activeMessageCount > 0 && (
                  <div className="absolute right-14 top-1.5 z-50">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => chatPanelRef.current?.clearChat()}
                      title="Clear Chat"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <MessageSquareX className="h-5 w-5" />
                    </Button>
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <ChatPanel
                    ref={chatPanelRef}
                    data={data}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    onClearChat={handleClearChat}
                    isLoading={isChatLoading}
                    hideInternalButtons={true}
                    suggestionsLayout="single"
                    onActiveMessagesCountChange={setActiveMessageCount}
                    useStreamEndpoint={true}
                    streamEndpointPayload={{
                      payload_identifier: { user_ref_no: sessionId },
                      payload_data: {
                        table_data: data ? [data.headers.join(','), ...data.rows.map(row => row.join(','))].join('\n') : '',
                        table_context: data?.headers.join(', ') || '',
                      },
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </main>
      </div>
    </div>
  );
};

function generateResponse(query: string, data: CSVData): string {
  const lowerQuery = query.toLowerCase();
  
  // Show all records
  if (lowerQuery.includes("show") && (lowerQuery.includes("all") || lowerQuery.includes("records") || lowerQuery.includes("data"))) {
    const maxRows = Math.min(10, data.rows.length);
    let response = `Here are the first ${maxRows} records:\n\n`;
    response += "| " + data.headers.join(" | ") + " |\n";
    response += "| " + data.headers.map(() => "---").join(" | ") + " |\n";
    data.rows.slice(0, maxRows).forEach(row => {
      response += "| " + row.join(" | ") + " |\n";
    });
    if (data.rows.length > maxRows) {
      response += `\n...and ${data.rows.length - maxRows} more rows.`;
    }
    return response;
  }

  // Count/total queries
  if (lowerQuery.includes("count") || lowerQuery.includes("how many") || lowerQuery.includes("total")) {
    if (lowerQuery.includes("row") || lowerQuery.includes("record")) {
      return `The dataset contains **${data.rows.length} rows** of data.`;
    }
    if (lowerQuery.includes("column")) {
      return `The dataset has **${data.headers.length} columns**: ${data.headers.join(", ")}.`;
    }
  }

  // Search for specific value
  const searchTerms = query.match(/["']([^"']+)["']|(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b)/g);
  if (searchTerms) {
    const searchTerm = searchTerms[0].replace(/["']/g, '');
    const matchingRows = data.rows.filter(row => 
      row.some(cell => cell.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    if (matchingRows.length > 0) {
      let response = `Found **${matchingRows.length}** record(s) matching "${searchTerm}":\n\n`;
      response += "| " + data.headers.join(" | ") + " |\n";
      response += "| " + data.headers.map(() => "---").join(" | ") + " |\n";
      matchingRows.slice(0, 5).forEach(row => {
        response += "| " + row.join(" | ") + " |\n";
      });
      return response;
    } else {
      return `No records found matching "${searchTerm}".`;
    }
  }

  // Date/joining date queries
  if (lowerQuery.includes("joining date") || lowerQuery.includes("join date") || lowerQuery.includes("date")) {
    const nameMatch = query.match(/of\s+([A-Za-z\s]+?)(?:\?|$)/i);
    if (nameMatch) {
      const searchName = nameMatch[1].trim();
      const matchingRow = data.rows.find(row => 
        row.some(cell => cell.toLowerCase().includes(searchName.toLowerCase()))
      );
      
      if (matchingRow) {
        const dateColIndex = data.headers.findIndex(h => 
          h.toLowerCase().includes("date") || h.toLowerCase().includes("joining")
        );
        
        if (dateColIndex !== -1) {
          const nameColIndex = data.headers.findIndex(h => 
            h.toLowerCase().includes("name")
          );
          const name = nameColIndex !== -1 ? matchingRow[nameColIndex] : searchName;
          return `The joining date of **${name}** is **${matchingRow[dateColIndex]}**.`;
        }
        
        // Show full record if no date column found
        let response = `Here's the record for "${searchName}":\n\n`;
        response += "| " + data.headers.join(" | ") + " |\n";
        response += "| " + data.headers.map(() => "---").join(" | ") + " |\n";
        response += "| " + matchingRow.join(" | ") + " |\n";
        return response;
      }
      return `Couldn't find a record for "${searchName}".`;
    }
  }

  // Column info
  if (lowerQuery.includes("column") || lowerQuery.includes("field")) {
    return `The dataset has **${data.headers.length} columns**:\n\n${data.headers.map((h, i) => `${i + 1}. **${h}**`).join("\n")}`;
  }

  // Summary/describe
  if (lowerQuery.includes("summary") || lowerQuery.includes("describe") || lowerQuery.includes("overview")) {
    return `**Dataset Summary:**\n\n- **Total Rows:** ${data.rows.length}\n- **Total Columns:** ${data.headers.length}\n- **Columns:** ${data.headers.join(", ")}\n\nWould you like me to show you sample records or analyze specific columns?`;
  }

  // Default response
  return `I can help you explore this dataset. Try asking:\n\n- "Show all records"\n- "How many rows are there?"\n- "What columns are available?"\n- "Find records with [name]"\n- "Give me a summary"`;
}

export default Index;
