import { Agent, AgentConfig, MCPServer, Crew } from "@/types";

export const mockTools = [
  {
    id: "search",
    name: "Web Search",
    description: "Search the internet for information",
    isEnabled: true,
  },
  {
    id: "code",
    name: "Code Execution",
    description: "Execute code in a sandbox environment",
    isEnabled: false,
  },
  {
    id: "file",
    name: "File Operations",
    description: "Read and write files",
    isEnabled: true,
  },
  {
    id: "api",
    name: "API Calls",
    description: "Make API calls to external services",
    isEnabled: true,
  },
  {
    id: "database",
    name: "Database Access",
    description: "Query and modify databases",
    isEnabled: false,
  },
];

export const mockPermissions = [
  { id: "internet", name: "Internet Access", isGranted: true },
  { id: "file-system", name: "File System Access", isGranted: true },
  { id: "user-interaction", name: "User Interaction", isGranted: true },
  { id: "agent-communication", name: "Agent Communication", isGranted: false },
  { id: "system", name: "System Operations", isGranted: false },
];

export const createMockAgent = (
  id: string,
  name: string,
  type: AgentType,
  status: Agent["status"],
  deploymentType: Agent["deploymentType"]
): Agent => {
  const config: AgentConfig = {
    name,
    description: `${name} is a ${type} agent designed to help with various tasks.`,
    type,
    model: type === "custom" ? "custom-model" : "gpt-4",
    systemPrompt: `You are ${name}, a helpful ${type} agent. Your goal is to assist users with their tasks.`,
    features: {
      memory: true,
      a2a: true,
      websearch: true,
      fileStorage: false,
      tools: true,
    },
  };

  return {
    id,
    config,
    status,
    deploymentType,
    createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
    lastActive:
      status === "active"
        ? new Date().toISOString()
        : new Date(Date.now() - Math.random() * 1000000000).toISOString(),
  };
};

export const mockAgents: Agent[] = [
  createMockAgent(
    "agent-1",
    "Research Assistant",
    "assistant",
    "active",
    "local"
  ),
  createMockAgent("agent-2", "Code Helper", "analytical", "active", "local"),
  createMockAgent("agent-3", "Data Analyst", "analytical", "stopped", "mcp"),
  createMockAgent(
    "agent-4",
    "Knowledge Base",
    "conversational",
    "active",
    "local"
  ),
  createMockAgent("agent-5", "Custom Agent", "custom", "error", "mcp"),
];

export const mockMCPServers: MCPServer[] = [
  {
    id: "mcp-1",
    name: "Local MCP Server",
    url: "http://localhost:8000",
    status: "connected",
    agents: 3,
  },
  {
    id: "mcp-2",
    name: "Cloud MCP Server",
    url: "https://mcp.example.com",
    status: "disconnected",
    agents: 0,
  },
];

export const mockCrews: Crew[] = [
  {
    id: "crew-1",
    config: {
      name: "Research Team",
      description: "A team for research and analysis tasks",
      objective: "Conduct comprehensive research and provide detailed analysis",
      workflowType: "sequential",
    },
    members: [
      { agentId: "agent-1", role: "Researcher" },
      { agentId: "agent-3", role: "Analyst" },
      { agentId: "agent-4", role: "Knowledge Base" },
    ],
    status: "active",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    lastActive: new Date().toISOString(),
  },
  {
    id: "crew-2",
    config: {
      name: "Development Team",
      description: "A team for coding and development tasks",
      objective: "Build and maintain software applications",
      workflowType: "parallel",
    },
    members: [
      { agentId: "agent-2", role: "Developer" },
      { agentId: "agent-5", role: "Custom Specialist" },
    ],
    status: "stopped",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    lastActive: new Date(Date.now() - 3600000).toISOString(),
  },
];
