// Agent Configuration
export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  type: "conversational" | "analytical" | "creative" | "assistant" | "custom";
  model: string;
  maxTokens?: number;
  temperature?: number;
  contextLength?: number;
  tools?: any[];
  contextData?: string;
  features?: {
    memory?: boolean;
    a2a?: boolean;
    websearch?: boolean;
    fileStorage?: boolean;
    tools?: boolean;
  };
}

// Agent Type
export interface Agent {
  id: string;
  config: AgentConfig;
  status: "active" | "stopped" | "error";
  deploymentType: "local" | "mcp";
  createdAt: string;
  lastActive: string;
  mcpServer?: MCPServer;
}

// Server/MCP Status
export interface MCPServer {
  id: string;
  name: string;
  url: string;
  status: "connected" | "disconnected" | "online" | "offline";
  agents?: number;
  capacity?: {
    currentAgents: number;
    maxAgents: number;
  };
  features?: string[];
}

// Stats/Dashboard
export interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  totalInteractions: number;
  messagesExchanged: number;
}

// A2A Communication
export interface A2AMessageData {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: string;
  status: "sent" | "delivered" | "read" | "failed";
}

// Memory
export interface AgentMemoryData {
  id: string;
  timestamp: string;
  type: "observation" | "interaction" | "reflection";
  content: string;
  importance: number;
}

// Crew Configuration
export interface CrewConfig {
  name: string;
  description: string;
  objective: string;
  workflowType: "sequential" | "parallel" | "hierarchical";
}

export interface CrewMember {
  agentId: string;
  role: string;
}

export interface Crew {
  id: string;
  config: CrewConfig;
  members: CrewMember[];
  status: "active" | "stopped";
  createdAt: string;
  lastActive: string;
}

// Activity log
export interface ActivityLog {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  timestamp: string;
  details?: string;
}
