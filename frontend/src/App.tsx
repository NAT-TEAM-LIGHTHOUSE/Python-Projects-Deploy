import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import EmbedDashboardPage from "./pages/EmbedDashboardPage";
import Embed from "./pages/Embed";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/web/agentai/table_gpt_plus/" element={<Index />} />
          <Route path="/web/agentai/table_gpt_plus/dashboard" element={<Dashboard />} />
          <Route path="/web/agentai/table_gpt_plus/history_dashboard" element={<Dashboard hideFilters={true} defaultFilter="unique" showAdvancedFilters={true} hideBackButton={true} />} />
          <Route path="/web/agentai/table_gpt_plus/dashboard/embed" element={<EmbedDashboardPage />} />
          <Route path="/web/agentai/table_gpt_plus/chatbot/embed" element={<Embed />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
