import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { MainSidebar } from "./components/layout/sidebar";
import AgentsPage from "./pages/agents";
import AgentDetailsPage from "./pages/agents/details/[id]";
import NewAgentPage from "./pages/agents/new";
import CrewsPage from "./pages/crews";
import LogsPage from "./pages/logs";
import MCPServersPage from "./pages/mcp-servers";
import SettingsPage from "./pages/settings";
import { useEffect } from "react";
import { A2ACommunication } from "./lib/a2a-communication";
import { AgentMemory } from "./lib/agent-memory";
import { AgentExecution } from "./lib/agent-execution";
import { AIService } from "./lib/ai-service";

const queryClient = new QueryClient();

const App = () => {
  // Initialize services when app starts
  useEffect(() => {
    // Initialize A2A communication, Agent Memory, Agent Execution, and AI Service
    A2ACommunication.init();
    AgentMemory.init();
    AgentExecution.init();
    AIService.init();

    // Expose for debugging
    // @ts-ignore
    window.AgentMemory = AgentMemory;
    // @ts-ignore
    window.A2ACommunication = A2ACommunication;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <div className="flex min-h-screen">
            <MainSidebar />
            <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/agents/new" element={<NewAgentPage />} />
                <Route
                  path="/agents/details/:id"
                  element={<AgentDetailsPage />}
                />
                <Route path="/crews" element={<CrewsPage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path="/mcp-servers" element={<MCPServersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
