import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
// import Embed from "./table_gpt_plus/pages/Embed.tsx";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import DbLoginPage from "./pages/DbLoginPage.tsx";
import ChatbotPage from "./shared/pages/ChatbotPage.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import { DEFAULT_APP_KEY } from "./shared/config/appTargets.ts";
import Dashboard from "./pages/Dashboard";
import EmbedDashboardPage from "./pages/EmbedDashboardPage";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/web/agentai/process_gpt/" element={<Index />} />
            <Route path="/web/agentai/process_gpt" element={<ChatbotPage defaultAppKey={DEFAULT_APP_KEY} />} />
            <Route path="/web/agentai/process_gpt/dashboard" element={<Dashboard />} />
            <Route path="/web/agentai/process_gpt/history_dashboard" element={<Dashboard hideFilters={true} defaultFilter="unique" showAdvancedFilters={true} hideBackButton={true} />} />
            <Route path="/web/agentai/process_gpt/dashboard/embed" element={<EmbedDashboardPage />} />
            {/* <Route path="/web/agentai/process_gpt/chatbot/embed" element={<Embed />} /> */}
            {/* <Route path="/web/agentai/sql_gpt/chatbot/embed" element={<Embed />} /> */}
            <Route path="/web/agentai/sql_gpt/login" element={<LoginPage />} />
            <Route path="/web/agentai/sql_gpt/db_login" element={<DbLoginPage />} />
            <Route path="/web/agentai/sql_gpt/chatbot" element={<Navigate to="/web/agentai/process_gpt" replace />} />
            <Route path="/web/agentai/table_gpt_plus/chatbot" element={<Navigate to="/web/agentai/process_gpt" replace />} />
            <Route path="/web/agentai/sql_gpt/dashboard" element={<Navigate to="/web/agentai/process_gpt" replace />} />
            <Route path="/web/agentai/sql_gpt/" element={<Navigate to="/web/agentai/sql_gpt/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
