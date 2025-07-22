import { v4 as uuidv4 } from "uuid";
import { Agent } from "@/types";
import { AgentMemory } from "./agent-memory";
import { SharedVectorDB } from "./shared-vector-db";
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

      // Try to parse for tool call
      let toolCall: ToolCall | null = null;
      let triedCorrection = false;
      while (true) {
        try {
          const parsed = JSON.parse(agentResponseContent);
          if (parsed && typeof parsed === "object" && parsed.tool_call) {
            toolCall = parsed as ToolCall;
            break;
          }
        } catch {}
        if (triedCorrection) break;
        // If not valid, re-prompt the LLM with a correction message
        if (onThoughtStep)
          onThoughtStep(
            "Response was not a valid tool call. Re-prompting for correct JSON tool call..."
          );
        agentResponseContent = await this.generateAgentResponse(
          agent,
          `Your previous response was not a valid tool call. You must respond with a valid JSON object with a tool_call field if a tool is needed. Do not describe tool usage in natural language. Original message: ${message}`,
          recentMessages
        );
        triedCorrection = true;
      }

      // If tool call detected, handle it with approval workflow
      if (toolCall && agentToolRegistry[toolCall.tool_call]) {
        if (onThoughtStep)
          onThoughtStep(`Tool call detected: ${toolCall.tool_call}`);
        const toolRequiresApproval = this.doesToolRequireApproval(
          toolCall.tool_call
        );
        if (toolRequiresApproval) {
          if (onThoughtStep)
            onThoughtStep(
              `Tool ${toolCall.tool_call} requires approval - waiting for user confirmation`
            );
          await this.storePendingToolCall(agent.id, toolCall, {
            message,
            context: recentMessages,
            timestamp: new Date().toISOString(),
          });
          agentResponseContent = `I need to use the tool \"${
            toolCall.tool_call
          }\" with arguments: ${JSON.stringify(
            toolCall.args,
            null,
            2
          )}.\n\nThis tool requires your approval before I can proceed. Please review and approve/reject this tool usage.`;
        } else {
          if (onThoughtStep)
            onThoughtStep(`Executing tool: ${toolCall.tool_call}`);
          try {
            const toolResult: ToolResult = await agentToolRegistry[
              toolCall.tool_call
            ](toolCall.args || {}, { agent });
            await this.logToolExecution(
              agent.id,
              toolCall,
              toolResult,
              "success"
            );
            // Log tool result in memory
            await AgentMemory.addMemory(agent.id, {
              type: "observation",
              content: `Tool ${
                toolCall.tool_call
              } executed. Result: ${JSON.stringify(toolResult.result)}`,
              importance: 7,
            });
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
          } catch (toolError) {
            await this.logToolExecution(
              agent.id,
              toolCall,
              null,
              "error",
              toolError instanceof Error ? toolError.message : "Unknown error"
            );
            if (onThoughtStep)
              onThoughtStep(`Tool execution failed: ${toolError}`);
            agentResponseContent = `I encountered an error while using the ${
              toolCall.tool_call
            } tool: ${
              toolError instanceof Error ? toolError.message : "Unknown error"
            }. Let me try a different approach.`;
          }
        }
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
   * Check if a tool requires approval before execution
   */
  private static doesToolRequireApproval(toolName: string): boolean {
    // List of tools that require approval - can be made configurable
    const approvalRequiredTools = [
      "send_email",
      "delete_file",
      "execute_code",
      "make_api_call",
      "transfer_funds",
      "create_user",
      "delete_user",
      "modify_permissions",
    ];

    return approvalRequiredTools.includes(toolName);
  }

  /**
   * Store a pending tool call for approval
   */
  private static async storePendingToolCall(
    agentId: string,
    toolCall: ToolCall,
    context: any
  ): Promise<void> {
    try {
      const pendingApproval = {
        id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentId,
        toolCall,
        context,
        status: "pending",
        timestamp: new Date().toISOString(),
      };

      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingApproval),
      });
    } catch (error) {
      console.error("Failed to store pending tool call:", error);
    }
  }

  /**
   * Log tool execution for monitoring and debugging
   */
  private static async logToolExecution(
    agentId: string,
    toolCall: ToolCall,
    result: ToolResult | null,
    status: "success" | "error" | "pending",
    error?: string
  ): Promise<void> {
    try {
      const logEntry = {
        id: `tool_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        agentId,
        toolName: toolCall.tool_call,
        toolArgs: toolCall.args,
        result: result?.result,
        status,
        error,
        executionTime: result ? Date.now() : undefined, // This would need proper timing
      };

      await fetch("/api/logs/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error("Failed to log tool execution:", error);
    }
  }

  /**
   * Approve a pending tool call and execute it
   */
  static async approveToolCall(
    approvalId: string,
    approved: boolean,
    reason?: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Get the pending approval
      const response = await fetch(`/api/approvals/${approvalId}`);
      if (!response.ok) {
        throw new Error("Approval not found");
      }

      const approval = await response.json();

      if (!approved) {
        // Mark as rejected
        await fetch(`/api/approvals/${approvalId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "rejected",
            reason,
            processedAt: new Date().toISOString(),
          }),
        });

        return { success: false, error: "Tool call rejected by user" };
      }

      // Execute the approved tool
      const { toolCall } = approval;
      const agent = await this.getAgentById(approval.agentId);

      if (!agent) {
        throw new Error("Agent not found");
      }

      const toolResult: ToolResult = await agentToolRegistry[
        toolCall.tool_call
      ](toolCall.args || {}, { agent });

      // Log successful execution
      await this.logToolExecution(
        approval.agentId,
        toolCall,
        toolResult,
        "success"
      );

      // Mark as approved and executed
      await fetch(`/api/approvals/${approvalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          reason,
          result: toolResult,
          processedAt: new Date().toISOString(),
        }),
      });

      return { success: true, result: toolResult };
    } catch (error) {
      console.error("Failed to approve tool call:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get agent by ID - helper method
   */
  private static async getAgentById(agentId: string): Promise<Agent | null> {
    try {
      const response = await fetch(`/api/agents/${agentId}`);
      if (response.ok) {
        return response.json();
      }
      return null;
    } catch {
      return null;
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
    return await agentToolRegistry.SEND_MESSAGE(
      {
        tool_call: "call_agent_api",
        args: {
          sourceAgentId,
          targetAgentId,
          message,
          metadata,
        },
      },
      { agent: sourceAgent }
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
