import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft, History, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface PageInfo {
  limit: number;
  offset: number;
  total: number;
}

interface EmbedDashboardData {
  success: boolean;
  data: {
    total_queries: number;
    recent_queries: Array<{
      id: number;
      appkey: string;
      wma_user_code: string;
      wma_object_code: string;
      app_page_frame_seqid: string;
      iud_seqid: string;
      ai_log_text: string;
      user_timestamp: string;
    }>;
    daily_counts: Record<string, number>;
    page: PageInfo;
  };
}

interface EmbedDashboardProps {
  payloadIdentifier: {
    appkey?: string;
    wma_object_code?: string;
    app_page_frame_seqid?: string;
    iud_seqid?: string;
    user_code?: string;
  };
}

const EmbedDashboard = ({ payloadIdentifier }: EmbedDashboardProps) => {
  const [dashboardData, setDashboardData] = useState<EmbedDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const limit = 10;

  const fetchDashboardData = async (offset: number) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const apiBase = import.meta.env.VITE_API_BASE || '';
      const url = `${apiBase}/api/agentai/table_gpt_plus/dashboard/embed`;
      
      console.log("Fetching embed dashboard from:", url);
      console.log("Payload:", payloadIdentifier);
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload_identifier: payloadIdentifier,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`);
      }

      const data = await response.json();
      console.log("Embed Dashboard data:", data);
      setDashboardData(data);
    } catch (err) {
      console.error("Embed Dashboard fetch error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(0);
  }, []);

  const recentQueries = dashboardData?.data?.recent_queries || [];
  const pageInfo = dashboardData?.data?.page;
  const totalRecords = pageInfo?.total || 0;
  const totalPages = Math.ceil(totalRecords / limit) || 0;
  const currentPageNum = Math.floor((pageInfo?.offset || 0) / limit);

  const handlePrevPage = () => {
    if (currentPageNum > 0) {
      const newOffset = (currentPageNum - 1) * limit;
      setCurrentPage(currentPageNum - 1);
      fetchDashboardData(newOffset);
    }
  };

  const handleNextPage = () => {
    if (currentPageNum < totalPages - 1) {
      const newOffset = (currentPageNum + 1) * limit;
      setCurrentPage(currentPageNum + 1);
      fetchDashboardData(newOffset);
    }
  };

  const columns = [
    { key: "ai_log_text", label: "Question" },
    { key: "user_timestamp", label: "Timestamp" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-full bg-background p-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-background p-4">
        <div className="bg-card rounded-xl border border-destructive p-4">
          <p className="text-destructive">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <History className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-display font-bold text-foreground">
          WMA TableGPT User Prompt Log
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Total Queries</p>
          <p className="text-2xl font-bold text-foreground">{dashboardData?.data?.total_queries || 0}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="text-2xl font-bold text-foreground">
            {dashboardData?.data?.daily_counts ? Object.keys(dashboardData.data.daily_counts).length : 0}
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Recent Activity</p>
          <p className="text-2xl font-bold text-foreground">{recentQueries.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="min-w-max">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                <TableRow>
                  <TableHead className="w-10 text-center font-semibold text-xs text-muted-foreground">
                    #
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className="font-semibold text-foreground whitespace-nowrap px-3"
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentQueries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-6">
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  recentQueries.map((row, index) => (
                    <TableRow key={row.id || index} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="text-center text-xs text-muted-foreground font-mono">
                        {(currentPageNum * limit) + index + 1}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 text-sm max-w-[400px] truncate">
                        {row.ai_log_text || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-3 text-xs text-muted-foreground">
                        {row.user_timestamp || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Showing {currentPageNum * limit + 1} to {Math.min((currentPageNum + 1) * limit, totalRecords)} of {totalRecords}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPageNum === 0 || isLoading}
              className="h-7 px-2 text-xs"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {currentPageNum + 1}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPageNum >= totalPages - 1 || isLoading}
              className="h-7 px-2 text-xs"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbedDashboard;