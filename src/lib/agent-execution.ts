import { v4 as uuidv4 } from "uuid";
import { Agent } from "@/types";
import { AgentMemory } from "./agent-memory";
import { SharedVectorDB } from "./shared-vector-db";
import { A2ACommunication } from "./a2a-communication";
// Remove fs and path imports
// Import agent_context.txt as a raw string
import agentContext from "@/components/agents/agent_context.txt?raw";
import { agentToolRegistry, ToolCall, ToolResult } from "./agent-tools";

// Agent Execution types
export interface AgentMessage {
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
}

export interface AgentConversation {
  agentId: string;
  messages: AgentMessage[];
  lastActive: string;
}

// Remove getAgentBaseContext function

const API_BASE = "/api";

export class AgentExecution {
  /**
   * Public method to initialize the agent execution system
   */
  static init(): void {
    // No longer needed, initialization is handled by backend
  }

  /**
   * Start an agent - activate it for execution
   */
  static async startAgent(agent: Agent): Promise<Agent> {
    try {
      // Start the agent container via backend
      const resp = await fetch("/api/agents/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent }),
      });
      if (!resp.ok) {
        throw new Error("Failed to start agent container");
      }

      // --- Inject agent context as first memory (if not already present) ---
      // Prepare context: replace template vars and append user context
      let context = agentContext
        .replace(/\{\{AGENT_ID\}\}/g, agent.id)
        .replace(/\{\{PRIMARY_ROLE\}\}/g, agent.config.type || "agent")
        .replace(/\{\{MISSION_STATEMENT\}\}/g, agent.config.description || "");
      if (agent.config.contextData) {
        context = context + "\n\nUSER CONTEXT:\n" + agent.config.contextData;
      }
      // Store in long-term memory as 'base_context'
      await AgentMemory.setFact(agent.id, "base_context", context);
      // Also add as system memory if not present
      const existingMemories = await AgentMemory.getMemories(agent.id);
      const hasSystemContext = existingMemories.some(
        (m) =>
          m.type === "system" &&
          m.content.includes("You are an autonomous AI agent")
      );
      if (!hasSystemContext) {
        await AgentMemory.addMemory(agent.id, {
          type: "system",
          content: context,
          importance: 10,
        });
      }
      // --- End context injection ---

      // Log agent activation in memory
      await AgentMemory.addMemory(agent.id, {
        type: "observation",
        content: `Agent activated`,
        importance: 5,
      });
      SharedVectorDB.embedAgentProfile(agent);
      // Initialize A2A memory in long-term storage (PostgreSQL)
      // Only set if not already present
      const existingA2A = await AgentMemory.getFact(agent.id, "a2a:messages");
      if (existingA2A === null) {
        await AgentMemory.setFact(agent.id, "a2a:messages", JSON.stringify([]));
      }
      return { ...agent, status: "active" as const };
    } catch (error) {
      console.error("Error starting agent:", error);
      throw error;
    }
  }

  /**
   * Stop an agent - deactivate it
   */
  static async stopAgent(agent: Agent): Promise<Agent> {
    try {
      // Remove from active agents
      AgentMemory.addMemory(agent.id, {
        type: "observation",
        content: `Agent deactivated`,
        importance: 5,
      });
      return { ...agent, status: "stopped" as const };
    } catch (error) {
      console.error("Error stopping agent:", error);
      throw error;
    }
  }

  /**
   * Check if an agent is active (now checks backend)
   */
  static async isAgentActive(agentId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      if (!res.ok) return false;
      const agent: Agent = await res.json();
      return agent.status === "active";
    } catch (error) {
      console.error("Error checking agent status:", error);
      return false;
    }
  }

  /**
   * Send a message to an agent and get a response (uses AI service and real context)
   */
  static async sendMessage(
    agentId: string,
    message: string,
    onThoughtStep?: (step: string) => void
  ): Promise<AgentMessage> {
    try {
      // Get agent details
      const agentRes = await fetch(`/api/agents/${agentId}`);
      if (!agentRes.ok) throw new Error("Agent not found");
      const agent: Agent = await agentRes.json();

      // Get full conversation for context and chat history
      const conversation = await this.getConversation(agentId);
      const chatHistory = conversation.messages || [];
      const recentMessages = chatHistory.slice(-10);

      // Create user message
      const userMsg: AgentMessage = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };
      // Append user message to chat history
      const updatedChat = [...chatHistory, userMsg];
      // Save updated chat array to backend
      await fetch(`/api/memory/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: `agent:${agentId}:chat`,
          value: updatedChat,
        }),
      });
      // Also add to short-term memory
      await AgentMemory.addMemory(agentId, {
        type: "user_message",
        content: message,
        importance: 5,
      });

      if (onThoughtStep) onThoughtStep("Retrieving context and reasoning...");

      // Generate agent response using AI service and real context
      let agentResponseContent = await this.generateAgentResponse(
        agent,
        message,
        recentMessages
      );

      // Tool call detection (expects JSON with tool_call)
      let toolCall: ToolCall | null = null;
      try {
        const parsed = JSON.parse(agentResponseContent);
        if (parsed && typeof parsed === "object" && parsed.tool_call) {
          toolCall = parsed as ToolCall;
        }
      } catch {}

      // If tool call detected, handle it and re-prompt LLM with tool result
      if (toolCall && agentToolRegistry[toolCall.tool_call]) {
        if (onThoughtStep) onThoughtStep(`Calling tool: ${toolCall.tool_call}`);
        const toolResult: ToolResult = await agentToolRegistry[
          toolCall.tool_call
        ](toolCall.args || {}, { agent });
        // Inject tool result as a system message and re-prompt LLM
        const toolResultMsg: AgentMessage = {
          role: "system",
          content: JSON.stringify(toolResult),
          timestamp: new Date().toISOString(),
        };
        const newContext: AgentMessage[] = [
          ...recentMessages,
          userMsg,
          toolResultMsg,
        ];
        agentResponseContent = await this.generateAgentResponse(
          agent,
          message,
          newContext
        );
      }

      // Create agent response message
      const agentMessage: AgentMessage = {
        role: "agent",
        content: agentResponseContent,
        timestamp: new Date().toISOString(),
      };
      // Append agent response to chat history
      const finalChat = [...updatedChat, agentMessage];
      // Save updated chat array to backend
      await fetch(`/api/memory/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: `agent:${agentId}:chat`,
          value: finalChat,
        }),
      });
      // Also add to short-term memory
      await AgentMemory.addMemory(agentId, {
        type: "agent_response",
        content: agentResponseContent,
        importance: 6,
      });

      return agentMessage;
    } catch (error) {
      console.error("Error sending message to agent:", error);
      if (onThoughtStep)
        onThoughtStep(
          "Error: " + (error instanceof Error ? error.message : error)
        );
      throw error;
    }
  }

  /**
   * Run an autonomous task with an agent
   */
  static async runAutonomousTask(agent: Agent, task: string): Promise<string> {
    try {
      // Check if agent is active
      if (!(await this.isAgentActive(agent.id))) {
        await this.startAgent(agent);
      }

      // Add task to agent memory
      AgentMemory.addMemory(agent.id, {
        type: "observation",
        content: `Autonomous task initiated: ${task}`,
        importance: 8,
        metadata: {
          taskType: "autonomous",
        },
      });

      // Get recent conversation for context
      const conversation = await this.getConversation(agent.id);
      const recentMessages = conversation.messages.slice(-10);

      // Generate response using AI service and real context
      const agentRes = await this.generateAgentResponse(
        agent,
        task,
        recentMessages
      );

      // Add result to agent memory
      AgentMemory.addMemory(agent.id, {
        type: "observation",
        content: `Task completed: ${task}`,
        importance: 7,
        metadata: {
          taskType: "autonomous",
          result: agentRes,
        },
      });

      // After autonomous task is completed (in runAutonomousTask), embed task result in shared vector DB
      SharedVectorDB.embedAgentAction(agent.id, task, agentRes);

      return agentRes;
    } catch (error) {
      console.error("Error running autonomous task:", error);
      throw new Error(
        `Failed to execute task: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate a response using AI service and real conversation context
   */
  private static async generateAgentResponse(
    agent: Agent | null,
    message: string,
    contextMessages: AgentMessage[] = []
  ): Promise<string> {
    if (!agent) {
      throw new Error("Agent not found or unavailable.");
    }

    try {
      // Import AI service dynamically to avoid circular dependencies
      const { AIService } = await import("./ai-service");

      // Check if API keys are configured
      if (!AIService.hasValidApiKeys()) {
        throw new Error("No valid API keys found for AI service.");
      }

      // Retrieve base context from long-term memory
      const baseContext = await AgentMemory.getFact(agent.id, "base_context");
      const aiMessages = [];
      if (baseContext) {
        aiMessages.push({ role: "system", content: baseContext });
      }
      // Add previous messages
      aiMessages.push(
        ...contextMessages.map((msg) => {
          const convertedRole =
            msg.role === "agent"
              ? "assistant"
              : (msg.role as "system" | "user" | "assistant");
          return {
            role: convertedRole,
            content: msg.content,
          };
        })
      );
      // Add the current user message
      aiMessages.push({
        role: "user",
        content: message,
      });

      // Generate response using AI service
      const response = await AIService.generateResponse(
        aiMessages,
        agent.config.model,
        {
          temperature: 0.7,
          maxTokens: agent.config.maxTokens || 1000,
        }
      );

      return response.content;
    } catch (error) {
      console.error("Error generating AI response:", error);
      throw new Error(
        `Failed to generate agent response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get details for an agent (async)
   */
  private static async getAgentDetails(agentId: string): Promise<Agent | null> {
    try {
      const res = await fetch(`${API_BASE}/agents/${agentId}`);
      if (!res.ok) return null;
      const agent: Agent = await res.json();
      return agent;
    } catch (error) {
      console.error("Error getting agent details:", error);
    }
    return null;
  }

  /**
   * Get conversation for an agent (from backend)
   */
  static async getConversation(agentId: string): Promise<AgentConversation> {
    const res = await fetch(`${API_BASE}/memory/get/agent:${agentId}:chat`);
    const data = await res.json();
    const messages: AgentMessage[] = Array.isArray(data.value)
      ? data.value
      : data.value
      ? [data.value]
      : [];
    return {
      agentId,
      messages,
      lastActive:
        messages.length > 0
          ? messages[messages.length - 1].timestamp
          : new Date().toISOString(),
    };
  }

  /**
   * Programmatically call another agent as if it were an API (A2A)
   */
  static async callAgentAPI(
    sourceAgentId: string,
    targetAgentId: string,
    message: string,
    metadata?: Record<string, any>
  ) {
    // Get agent details for names
    const sourceAgent = await this.getAgentDetails(sourceAgentId);
    const targetAgent = await this.getAgentDetails(targetAgentId);
    if (!sourceAgent || !targetAgent) throw new Error("Agent not found");
    return await A2ACommunication.sendMessage(
      sourceAgentId,
      sourceAgent.config.name,
      targetAgentId,
      targetAgent.config.name,
      message,
      metadata
    );
  }

  /**
   * At the end of a session, summarize and store relevant info in long-term memory
   */
  static async summarizeSessionToLongTerm(agentId: string): Promise<void> {
    // Get recent conversation and memories
    const conversation = await this.getConversation(agentId);
    const memories = await AgentMemory.getRecentMemories(agentId, 20);
    // Generate a summary (could use OpenAI or similar)
    const summaryPrompt =
      "Summarize the most important facts, events, and learnings from this session for long-term memory.";
    const agentRes = await fetch(`/api/agents/${agentId}`);
    if (!agentRes.ok) return;
    const agent: Agent = await agentRes.json();
    const summary = await this.generateAgentResponse(
      agent,
      summaryPrompt +
        "\n\nConversation:\n" +
        conversation.messages.map((m) => `${m.role}: ${m.content}`).join("\n") +
        "\n\nMemories:\n" +
        memories.map((m) => `- ${m.content}`).join("\n"),
      conversation.messages.slice(-10)
    );
    // Store summary in long-term memory
    await AgentMemory.setFact(agentId, "session_summary", summary);
  }

  /**
   * Terminate an agent and delete all its data (agent record, memories, chat, long-term facts, A2A messages)
   */
  static async terminateAgent(agentId: string): Promise<void> {
    // Delete agent record
    await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
    // Delete short-term memory
    await fetch(`/api/memory/delete/agent:${agentId}:memories`, {
      method: "DELETE",
    });
    // Delete chat history
    await fetch(`/api/memory/delete/agent:${agentId}:chat`, {
      method: "DELETE",
    });
    // Delete long-term facts (assume backend endpoint exists)
    await fetch(`/api/longterm/delete/${agentId}`, { method: "DELETE" });
    // Delete A2A messages (assume backend endpoint exists)
    await fetch(`/api/memory/delete/a2a:messages/${agentId}`, {
      method: "DELETE",
    });
  }
}
