// Agent Tools Registry
// This file defines all tools available to agents, including core, MCP, and cross-agent tools.

import { Agent } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { AgentMemory } from "@/lib/agent-memory";
import { AgentExecution } from "./agent-execution";

export interface ToolCall {
  tool_call: string;
  args?: Record<string, any>;
}

export interface ToolResult {
  tool_call: string;
  result: any;
}

// Tool handler signature
type ToolHandler = (
  args: Record<string, any>,
  context: { agent: Agent }
) => Promise<ToolResult>;

// Tool: List all available agents
export const listAgentsTool: ToolHandler = async (_args, _context) => {
  const res = await fetch("/api/agents");
  if (!res.ok) throw new Error("Failed to fetch agents");
  const agents = await res.json();
  return {
    tool_call: "LIST_AGENTS",
    result: agents.map((a: Agent) => ({
      id: a.id,
      name: a.config.name,
      type: a.config.type,
    })),
  };
};

// Tool: List available MCP servers
export const listMCPsTool: ToolHandler = async (_args, _context) => {
  try {
    const res = await fetch("/api/mcp-servers");
    if (!res.ok) throw new Error("Failed to fetch MCP servers");
    const servers = await res.json();
    return {
      tool_call: "LIST_MCPS",
      result: servers.map((server: any) => ({
        id: server.id,
        name: server.name,
        url: server.url,
        status: server.status,
        capacity: server.capacity,
        features: server.features,
        tools: server.tools,
      })),
    };
  } catch (error) {
    return {
      tool_call: "LIST_MCPS",
      result: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
};

// Tool: Get tools from a specific MCP server
export const getMCPServerToolsTool: ToolHandler = async (args, _context) => {
  const { serverId } = args;
  if (!serverId) throw new Error("serverId is required");

  try {
    const res = await fetch(`/api/mcp-servers/${serverId}`);
    if (!res.ok) throw new Error("MCP server not found");
    const server = await res.json();

    return {
      tool_call: "GET_MCP_SERVER_TOOLS",
      result: {
        serverId,
        serverName: server.name,
        tools: server.tools || [],
      },
    };
  } catch (error) {
    return {
      tool_call: "GET_MCP_SERVER_TOOLS",
      result: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
};

// Tool: Execute a tool on an MCP server
export const executeMCPToolTool: ToolHandler = async (args, _context) => {
  const { serverId, toolName, arguments: toolArgs } = args;
  if (!serverId || !toolName)
    throw new Error("serverId and toolName are required");

  try {
    const res = await fetch(`/api/mcp-servers/${serverId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolName,
        arguments: toolArgs || {},
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to execute MCP tool");
    }

    const result = await res.json();

    return {
      tool_call: "EXECUTE_MCP_TOOL",
      result: {
        serverId,
        toolName,
        result,
      },
    };
  } catch (error) {
    return {
      tool_call: "EXECUTE_MCP_TOOL",
      result: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
};

// Tool: Test MCP server connection
export const testMCPServerTool: ToolHandler = async (args, _context) => {
  const { serverId } = args;
  if (!serverId) throw new Error("serverId is required");

  try {
    const res = await fetch(`/api/mcp-servers/${serverId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to test MCP server");
    }

    const result = await res.json();

    return {
      tool_call: "TEST_MCP_SERVER",
      result: {
        serverId,
        status: result.status,
        tools: result.tools || [],
        error: result.error,
      },
    };
  } catch (error) {
    return {
      tool_call: "TEST_MCP_SERVER",
      result: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
};

// Tool: Discover all available MCP tools across all servers
export const discoverAllMCPToolsTool: ToolHandler = async (_args, _context) => {
  try {
    // Get all MCP servers
    const serversRes = await fetch("/api/mcp-servers");
    if (!serversRes.ok) throw new Error("Failed to fetch MCP servers");
    const servers = await serversRes.json();

    // Collect tools from all online servers
    const allTools = [];
    for (const server of servers) {
      if (
        server.status === "online" &&
        server.tools &&
        server.tools.length > 0
      ) {
        allTools.push({
          serverId: server.id,
          serverName: server.name,
          tools: server.tools,
        });
      }
    }

    return {
      tool_call: "DISCOVER_ALL_MCP_TOOLS",
      result: {
        totalServers: servers.length,
        onlineServers: servers.filter((s: any) => s.status === "online").length,
        toolsByServer: allTools,
      },
    };
  } catch (error) {
    return {
      tool_call: "DISCOVER_ALL_MCP_TOOLS",
      result: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
};

// Placeholder: Cross-agent communication (send message, etc.)
export const crossAgentCommTool: ToolHandler = async (_args, _context) => {
  // TODO: Implement cross-agent communication
  return { tool_call: "CROSS_AGENT_COMM", result: "Not implemented" };
};

// Cross-agent communication log key
const CROSS_AGENT_LOG_KEY = "cross_agent:log";

// Helper to log A2A messages in a central log
async function logA2AMessage(entry: any) {
  // Fetch existing log
  const res = await fetch("/api/memory/get/a2a:messages");
  let log: any[] = [];
  try {
    const data = await res.json();
    log = Array.isArray(data.value)
      ? data.value
      : data.value
      ? [data.value]
      : [];
  } catch {}
  // Append new entry
  log.push(entry);
  // Save back
  await fetch("/api/memory/set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "a2a:messages", value: log }),
  });
}

// Tool: Send a message to another agent and trigger their response
export const sendMessageTool: ToolHandler = async (args, context) => {
  const { to_id, message } = args;
  if (!to_id || !message) throw new Error("to_id and message are required");

  const timestamp = new Date().toISOString();
  const entry = {
    from: context.agent.id,
    to: to_id,
    message,
    timestamp,
    direction: "sent",
    type: "a2a_message",
  };
  await logA2AMessage(entry);

  // Log the outgoing message in sender's memory
  await AgentMemory.addMemory(context.agent.id, {
    type: "observation",
    content: `Sent to ${to_id}: ${message}`,
    importance: 6,
    metadata: { to: to_id, direction: "sent" },
  });

  // Log the incoming message in receiver's memory
  await AgentMemory.addMemory(to_id, {
    type: "message_received",
    content: `Received from ${context.agent.id}: ${message}`,
    importance: 6,
    metadata: { from: context.agent.id, direction: "received" },
  });

  // Trigger the receiving agent to process the message as a user message
  const response = await AgentExecution.sendMessage(to_id, message);

  // Log the response in the A2A log as well
  const responseEntry = {
    from: to_id,
    to: context.agent.id,
    message: response.content,
    timestamp: new Date().toISOString(),
    direction: "response",
    type: "a2a_response",
  };
  await logA2AMessage(responseEntry);

  return {
    tool_call: "SEND_MESSAGE",
    result: `Message sent to agent ${to_id} and processed.`,
  };
};

// Tool: Receive a message (for agent to process incoming messages)
export const receiveMessageTool: ToolHandler = async (args, context) => {
  const { from_id, message } = args;
  if (!from_id || !message) throw new Error("from_id and message are required");

  const timestamp = new Date().toISOString();
  const entry = {
    from: from_id,
    to: context.agent.id,
    message,
    timestamp,
    direction: "received",
    type: "a2a_message",
  };
  await logA2AMessage(entry);

  // Log the incoming message in receiver's memory
  await AgentMemory.addMemory(context.agent.id, {
    type: "message_received",
    content: `Received from ${from_id}: ${message}`,
    importance: 6,
    metadata: { from: from_id, direction: "received" },
  });

  // Process the message as a user message for the receiving agent
  const response = await AgentExecution.sendMessage(context.agent.id, message);

  // Log the response in the A2A log as well
  const responseEntry = {
    from: context.agent.id,
    to: from_id,
    message: response.content,
    timestamp: new Date().toISOString(),
    direction: "response",
    type: "a2a_response",
  };
  await logA2AMessage(responseEntry);

  return {
    tool_call: "RECEIVE_MESSAGE",
    result: `Message from agent ${from_id} received and processed.`,
  };
};

// Memory management tools
export const addMemoryTool: ToolHandler = async (args, context) => {
  const { type, content, importance, metadata } = args;
  if (!type || !content) throw new Error("type and content are required");

  const entry = await AgentMemory.addMemory(context.agent.id, {
    type,
    content,
    importance: importance || undefined,
    metadata: metadata || undefined,
  });

  return {
    tool_call: "ADD_MEMORY",
    result: `Memory added with importance ${
      entry?.importance || "auto-assessed"
    }`,
  };
};

export const getMemoriesTool: ToolHandler = async (args, context) => {
  const { limit, type, search } = args;
  let memories = await AgentMemory.getMemories(context.agent.id);

  // Filter by type if specified
  if (type) {
    memories = memories.filter((m) => m.type === type);
  }

  // Search if specified
  if (search) {
    memories = await AgentMemory.searchMemories(context.agent.id, search);
  }

  // Apply limit
  if (limit) {
    memories = memories.slice(0, parseInt(limit));
  }

  return {
    tool_call: "GET_MEMORIES",
    result: memories,
  };
};

export const getImportantMemoriesTool: ToolHandler = async (args, context) => {
  const { limit = 10 } = args;
  const memories = await AgentMemory.getImportantMemories(
    context.agent.id,
    parseInt(limit)
  );

  return {
    tool_call: "GET_IMPORTANT_MEMORIES",
    result: memories,
  };
};

export const getRecentMemoriesTool: ToolHandler = async (args, context) => {
  const { limit = 10 } = args;
  const memories = await AgentMemory.getRecentMemories(
    context.agent.id,
    parseInt(limit)
  );

  return {
    tool_call: "GET_RECENT_MEMORIES",
    result: memories,
  };
};

export const searchMemoriesTool: ToolHandler = async (args, context) => {
  const { query } = args;
  if (!query) throw new Error("query is required");

  const memories = await AgentMemory.searchMemories(context.agent.id, query);

  return {
    tool_call: "SEARCH_MEMORIES",
    result: memories,
  };
};

export const setFactTool: ToolHandler = async (args, context) => {
  const { key, value } = args;
  if (!key || !value) throw new Error("key and value are required");

  const success = await AgentMemory.setFact(context.agent.id, key, value);

  return {
    tool_call: "SET_FACT",
    result: success
      ? `Fact '${key}' stored successfully`
      : "Failed to store fact",
  };
};

export const getFactTool: ToolHandler = async (args, context) => {
  const { key } = args;
  if (!key) throw new Error("key is required");

  const fact = await AgentMemory.getFact(context.agent.id, key);

  return {
    tool_call: "GET_FACT",
    result: fact || "Fact not found",
  };
};

export const clearMemoriesTool: ToolHandler = async (args, context) => {
  const success = await AgentMemory.clearMemories(context.agent.id);

  return {
    tool_call: "CLEAR_MEMORIES",
    result: success
      ? "All memories cleared successfully"
      : "Failed to clear memories",
  };
};

// Advanced memory rating tool inspired by Cursor's Memory Rating Prompt
export const rateMemoryTool: ToolHandler = async (args, context) => {
  const { content, type, context: memoryContext } = args;
  if (!content) throw new Error("content is required");

  // Enhanced importance assessment based on content analysis
  let importance = 5; // default

  // Base importance by type
  switch (type) {
    case "user_message":
      importance = 7;
      break;
    case "agent_response":
      importance = 5;
      break;
    case "observation":
      importance = 6;
      break;
    case "reflection":
      importance = 8;
      break;
    case "message_received":
      importance = 6;
      break;
    case "system":
      importance = 7;
      break;
  }

  const contentLower = content.toLowerCase();

  // Enhanced keyword analysis
  const criticalKeywords = [
    "critical",
    "urgent",
    "emergency",
    "error",
    "failed",
    "broken",
    "danger",
  ];
  const importantKeywords = [
    "important",
    "priority",
    "crucial",
    "essential",
    "key",
    "vital",
    "significant",
  ];
  const userKeywords = [
    "remember",
    "don't forget",
    "save this",
    "keep in mind",
    "note this",
  ];
  const learningKeywords = [
    "learned",
    "discovered",
    "found",
    "realized",
    "understood",
    "pattern",
  ];

  // Check for critical keywords (highest priority)
  for (const keyword of criticalKeywords) {
    if (contentLower.includes(keyword)) {
      importance = Math.min(10, importance + 3);
      break;
    }
  }

  // Check for important keywords
  for (const keyword of importantKeywords) {
    if (contentLower.includes(keyword)) {
      importance = Math.min(10, importance + 2);
    }
  }

  // Check for user emphasis keywords
  for (const keyword of userKeywords) {
    if (contentLower.includes(keyword)) {
      importance = Math.min(10, importance + 2);
    }
  }

  // Check for learning/insight keywords
  for (const keyword of learningKeywords) {
    if (contentLower.includes(keyword)) {
      importance = Math.min(10, importance + 1);
    }
  }

  // Content length analysis
  if (content.length > 1000) importance = Math.min(10, importance + 1);
  if (content.length < 20) importance = Math.max(1, importance - 1);

  // Context relevance analysis
  if (memoryContext && memoryContext.includes("user_preference")) {
    importance = Math.min(10, importance + 1);
  }

  // Ensure importance is between 1 and 10
  importance = Math.max(1, Math.min(10, importance));

  return {
    tool_call: "RATE_MEMORY",
    result: {
      importance,
      reasoning: `Rated importance ${importance}/10 based on type (${type}), content analysis, and context relevance`,
      content_preview:
        content.substring(0, 100) + (content.length > 100 ? "..." : ""),
    },
  };
};

// Tool registry
export const agentToolRegistry: Record<string, ToolHandler> = {
  LIST_AGENTS: listAgentsTool,
  LIST_MCPS: listMCPsTool,
  CROSS_AGENT_COMM: crossAgentCommTool,
  SEND_MESSAGE: sendMessageTool,
  RECEIVE_MESSAGE: receiveMessageTool,
  // Memory management tools
  ADD_MEMORY: addMemoryTool,
  GET_MEMORIES: getMemoriesTool,
  GET_IMPORTANT_MEMORIES: getImportantMemoriesTool,
  GET_RECENT_MEMORIES: getRecentMemoriesTool,
  SEARCH_MEMORIES: searchMemoriesTool,
  SET_FACT: setFactTool,
  GET_FACT: getFactTool,
  CLEAR_MEMORIES: clearMemoriesTool,
  RATE_MEMORY: rateMemoryTool,
  // MCP server tools
  GET_MCP_SERVER_TOOLS: getMCPServerToolsTool,
  EXECUTE_MCP_TOOL: executeMCPToolTool,
  TEST_MCP_SERVER: testMCPServerTool,
  DISCOVER_ALL_MCP_TOOLS: discoverAllMCPToolsTool,
};
