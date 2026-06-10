import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, History, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface PageInfo {
  limit: number;
  offset: number;
  total: number;
}

interface DashboardProps {
  hideFilters?: boolean;
  defaultFilter?: string;
  showAdvancedFilters?: boolean;
  hideBackButton?: boolean;
}

interface DashboardData {
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
    unique_appkeys: string[];
    filter_type: string;
    page: PageInfo;
  };
}

const Dashboard = ({ hideFilters = false, defaultFilter = "all", showAdvancedFilters = false, hideBackButton = false }: DashboardProps) => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>(defaultFilter);
  const [selectedAppkey, setSelectedAppkey] = useState<string>("");
  const [selectedUserCode, setSelectedUserCode] = useState<string>("");
  const [selectedWmaObjectCode, setSelectedWmaObjectCode] = useState<string>("");
  const [selectedAppPageFrameSeqid, setSelectedAppPageFrameSeqid] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(0);
  const limit = 10;

  const fetchDashboardData = async (
    offset: number, 
    filter: string, 
    appkey: string,
    userCode: string = "",
    wmaObjectCode: string = "",
    appPageFrameSeqid: string = ""
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const apiBase = import.meta.env.VITE_API_BASE || '';
      const url = `${apiBase}/api/agentai/table_gpt_plus/dashboard`;
      
      console.log("Fetching dashboard from:", url);
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter_type: filter,
          appkey: appkey || null,
          user_code: userCode || null,
          wma_object_code: wmaObjectCode || null,
          app_page_frame_seqid: appPageFrameSeqid || null,
          limit: limit,
          offset: offset,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`);
      }

      const data = await response.json();
      console.log("Dashboard data:", data);
      setDashboardData(data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(0, defaultFilter, selectedAppkey, selectedUserCode, selectedWmaObjectCode, selectedAppPageFrameSeqid);
  }, []);

  const handleFilterChange = (value: string) => {
    setFilterType(value);
    setSelectedAppkey("");
    setCurrentPage(0);
    fetchDashboardData(0, value, "", selectedUserCode, selectedWmaObjectCode, selectedAppPageFrameSeqid);
  };

  const handleAppkeyChange = (value: string) => {
    setSelectedAppkey(value);
  };

  const handleUserCodeChange = (value: string) => {
    setSelectedUserCode(value);
  };

  const handleWmaObjectCodeChange = (value: string) => {
    setSelectedWmaObjectCode(value);
  };

  const handleAppPageFrameSeqidChange = (value: string) => {
    setSelectedAppPageFrameSeqid(value);
  };

  const recentQueries = dashboardData?.data?.recent_queries || [];
  const uniqueAppkeys = dashboardData?.data?.unique_appkeys || [];
  const pageInfo = dashboardData?.data?.page;
  const totalRecords = pageInfo?.total || 0;
  const totalPages = Math.ceil(totalRecords / limit) || 0;
  const currentPageNum = Math.floor((pageInfo?.offset || 0) / limit);

  console.log("Recent queries:", recentQueries);
  console.log("Unique appkeys:", uniqueAppkeys);
  console.log("Page info:", pageInfo);
  console.log("Total records:", totalRecords);

  // Debug: if dashboardData exists but no data, show debug info
  if (!isLoading && !error && dashboardData && recentQueries.length === 0 && totalRecords > 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="flex items-center gap-3 mb-6">
          {!hideBackButton && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/web/agentai/table_gpt_plus/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-2xl font-display font-bold">Debug: Empty Data</h1>
        </div>
        <pre className="bg-muted p-4 rounded-lg overflow-auto">
          {JSON.stringify(dashboardData, null, 2)}
        </pre>
      </div>
    );
  }

  const handlePrevPage = () => {
    if (currentPageNum > 0) {
      const newOffset = (currentPageNum - 1) * limit;
      setCurrentPage(currentPageNum - 1);
      fetchDashboardData(newOffset, filterType, selectedAppkey);
    }
  };

  const handleNextPage = () => {
    if (currentPageNum < totalPages - 1) {
      const newOffset = (currentPageNum + 1) * limit;
      setCurrentPage(currentPageNum + 1);
      fetchDashboardData(newOffset, filterType, selectedAppkey);
    }
  };

  const showAllColumns = filterType === "unique" || (filterType === "all" && selectedAppkey);
  
  const columns = showAllColumns
    ? [
        { key: "ai_log_text", label: "Question" },
        { key: "user_timestamp", label: "Timestamp" },
        { key: "appkey", label: "App Key" },
        { key: "wma_user_code", label: "User Code" },
        { key: "wma_object_code", label: "Object Code" },
        { key: "app_page_frame_seqid", label: "Page Frame" },
        { key: "iud_seqid", label: "IUD Seq ID" },
        
      ]
    : [
        { key: "ai_log_text", label: "Question" },
        { key: "user_timestamp", label: "Timestamp" },
      ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="flex items-center gap-3 mb-6">
          {!hideBackButton && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/web/agentai/table_gpt_plus/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground">
              WMA TableGPT User Prompt Log
            </h1>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-destructive p-4">
          <p className="text-destructive">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {!hideBackButton && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/web/agentai/table_gpt_plus/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground">
              WMA TableGPT User Prompt Log
            </h1>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <p className="text-sm text-muted-foreground">Total Queries</p>
          <p className="text-3xl font-bold text-foreground">{dashboardData?.data?.total_queries || 0}</p>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="text-3xl font-bold text-foreground">
            {dashboardData?.data?.daily_counts ? Object.keys(dashboardData.data.daily_counts).length : 0}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <p className="text-sm text-muted-foreground">Recent Activity</p>
          <p className="text-3xl font-bold text-foreground">{recentQueries.length}</p>
        </div>
      </div>

      {/* Filter Bar */}
      {showAdvancedFilters ? (
      <div className="bg-card rounded-xl border border-border shadow-card p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-foreground">Filters:</span>
          
          <span className="text-sm text-muted-foreground">App Key:</span>
          <Select value={selectedAppkey || "all"} onValueChange={handleAppkeyChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All App Keys" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {uniqueAppkeys.map((key) => (
                <SelectItem key={key} value={key}>{key}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">User Code:</span>
          <Input 
            placeholder="Enter User Code"
            value={selectedUserCode}
            onChange={(e) => setSelectedUserCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setCurrentPage(0);
                const appkey = selectedAppkey === "all" ? "" : selectedAppkey;
                fetchDashboardData(0, filterType, appkey, selectedUserCode, selectedWmaObjectCode, selectedAppPageFrameSeqid);
              }
            }}
            className="w-[150px] h-8"
          />

          <span className="text-sm text-muted-foreground">Object Code:</span>
          <Input 
            placeholder="Enter Object Code"
            value={selectedWmaObjectCode}
            onChange={(e) => setSelectedWmaObjectCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setCurrentPage(0);
                const appkey = selectedAppkey === "all" ? "" : selectedAppkey;
                fetchDashboardData(0, filterType, appkey, selectedUserCode, selectedWmaObjectCode, selectedAppPageFrameSeqid);
              }
            }}
            className="w-[150px] h-8"
          />

          <span className="text-sm text-muted-foreground">Page Frame:</span>
          <Input 
            placeholder="Enter Page Frame"
            value={selectedAppPageFrameSeqid}
            onChange={(e) => setSelectedAppPageFrameSeqid(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setCurrentPage(0);
                const appkey = selectedAppkey === "all" ? "" : selectedAppkey;
                fetchDashboardData(0, filterType, appkey, selectedUserCode, selectedWmaObjectCode, selectedAppPageFrameSeqid);
              }
            }}
            className="w-[150px] h-8"
          />

          <Button 
            onClick={() => {
              setCurrentPage(0);
              const appkey = selectedAppkey === "all" ? "" : selectedAppkey;
              fetchDashboardData(0, filterType, appkey, selectedUserCode, selectedWmaObjectCode, selectedAppPageFrameSeqid);
            }}
            className="ml-2"
          >
            Search
          </Button>
        </div>
      </div>
      ) : !hideFilters && (
      <div className="bg-card rounded-xl border border-border shadow-card p-4 mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-foreground">Filter:</span>
          <Select value={filterType} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="webmode">WEB_MODE</SelectItem>
              <SelectItem value="unique">Unique Appkeys</SelectItem>
            </SelectContent>
          </Select>

          {filterType === "unique" && uniqueAppkeys.length > 0 && (
            <>
              <span className="text-sm font-medium text-foreground">App Key:</span>
              <Select value={selectedAppkey} onValueChange={handleAppkeyChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select App Key" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueAppkeys.map((key) => (
                    <SelectItem key={key} value={key}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {filterType === "all" && uniqueAppkeys.length > 0 && (
            <>
              <span className="text-sm font-medium text-foreground">App Key:</span>
              <Select value={selectedAppkey || "all"} onValueChange={handleAppkeyChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All App Keys" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All App Keys</SelectItem>
                  {uniqueAppkeys.map((key) => (
                    <SelectItem key={key} value={key}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <ScrollArea className="h-[calc(100vh-500px)]">
          <div className="min-w-max">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                <TableRow>
                  <TableHead className="w-12 text-center font-semibold text-xs text-muted-foreground">
                    #
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className="font-semibold text-foreground whitespace-nowrap px-4"
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentQueries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  recentQueries.map((row, index) => (
                    <TableRow key={row.id || index} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="text-center text-xs text-muted-foreground font-mono">
                        {(currentPageNum * limit) + index + 1}
                      </TableCell>
                      {showAllColumns ? (
                        <>
                          <TableCell className="whitespace-nowrap px-4 text-sm max-w-[300px] truncate">{row.ai_log_text || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap px-4 text-sm text-muted-foreground">{row.user_timestamp || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap px-4 text-sm">{row.appkey || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap px-4 text-sm">{row.wma_user_code || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap px-4 text-sm">{row.wma_object_code || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap px-4 text-sm">{row.app_page_frame_seqid || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap px-4 text-sm">{row.iud_seqid || "-"}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="whitespace-nowrap px-4 text-sm max-w-[500px] truncate">{row.ai_log_text || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap px-4 text-sm text-muted-foreground">{row.user_timestamp || "-"}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Showing {currentPageNum * limit + 1} to {Math.min((currentPageNum + 1) * limit, totalRecords)} of {totalRecords} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPageNum === 0 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPageNum + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPageNum >= totalPages - 1 || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
