import { v4 as uuidv4 } from "uuid";
import { Agent } from "@/types";
import { AgentMemory } from "./agent-memory";
import { SharedVectorDB } from "./shared-vector-db";
// Import agent_context.txt as a raw string
import agentContext from "@/components/agents/agent_context.txt?raw";
import { agentToolRegistry, ToolCall, ToolResult } from "./agent-tools";
// Accurate token counting for OpenAI models (imported dynamically)

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
    onThoughtStep?: (step: string) => void,
    depth: number = 0, // recursion depth for A2A
    maxDepth: number = 2 // user-configurable max depth
  ): Promise<AgentMessage> {
    if (depth > maxDepth) {
      // Summarize the conversation so far using the LLM
      const conversation = await this.getConversation(agentId);
      // Fetch agent details if not already available
      let agentObj = null;
      try {
        const agentRes = await fetch(`/api/agents/${agentId}`);
        if (agentRes.ok) agentObj = await agentRes.json();
      } catch {}
      if (!agentObj) {
        return {
          role: "agent",
          content: `The agent-to-agent conversation has reached the current max depth (${maxDepth}), but a summary could not be generated due to missing agent context.`,
          timestamp: new Date().toISOString(),
        };
      }
      // Convert conversation.messages to system role context
      const contextForSummary = conversation.messages.slice(-10).map((m) => ({
        role: "system" as const,
        content: `${m.role}: ${m.content}`,
        timestamp: m.timestamp,
      }));
      const summaryPrompt = `The agent-to-agent conversation has reached the current max depth (${maxDepth}). Please summarize what has occurred in the conversation so far, including the main points, actions taken, and any unresolved issues or next steps for the user.`;
      const summary = await this.generateAgentResponse(
        agentObj,
        summaryPrompt +
          "\n\nConversation history:\n" +
          conversation.messages
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n"),
        contextForSummary
      );
      return {
        role: "agent",
        content: summary,
        timestamp: new Date().toISOString(),
      };
    }
    try {
      // Get agent details
      const agentRes = await fetch(`/api/agents/${agentId}`);
      if (!agentRes.ok) {
        // Return a user-friendly error message instead of throwing
        return {
          role: "agent",
          content: `Error: Agent with ID '${agentId}' not found. Please check the agent ID and try again.`,
          timestamp: new Date().toISOString(),
        };
      }
      const agent: Agent = await agentRes.json();

      // Get full conversation for context and chat history
      const conversation = await this.getConversation(agentId);
      const chatHistory = conversation.messages || [];
      // Fetch A2A logs for this agent
      let a2aLog: any[] = [];
      try {
        const res = await fetch("/api/memory/get/a2a:messages");
        const data = await res.json();
        a2aLog = Array.isArray(data.value)
          ? data.value
          : data.value
          ? [data.value]
          : [];
      } catch {}
      // Only include A2A messages where this agent is sender or receiver
      const agentA2ALog = a2aLog.filter(
        (msg) => msg.from === agentId || msg.to === agentId
      );
      // Fetch recent A2A-related memories
      let a2aMemories: any[] = [];
      try {
        a2aMemories = (await AgentMemory.getMemories(agentId)).filter(
          (m) => m.type === "message_received" || m.type === "observation"
        );
      } catch {}
      // Merge last N chat messages and last N A2A log entries for context
      const N = 10;
      // Format context messages for LLM
      const formattedChat = chatHistory.slice(-N).map((msg) => {
        if (msg.role === "user") return `User: ${msg.content}`;
        if (msg.role === "agent") return `Agent [${agentId}]: ${msg.content}`;
        return `${msg.role}: ${msg.content}`;
      });
      const formattedA2A = agentA2ALog.slice(-N).map((msg) => {
        const from =
          msg.from === agentId
            ? `Agent [${agentId}]`
            : `A2A from [${msg.from}]`;
        return `${from}: ${msg.message}`;
      });
      const formattedMemories = a2aMemories
        .slice(-N)
        .map((m) => `Memory (${m.type}): ${m.content}`);
      // Add a section for recent A2A interactions
      const a2aSection =
        formattedA2A.length > 0
          ? ["## Recent A2A Interactions:", ...formattedA2A]
          : [];
      // Add a section for recent A2A memories
      const memorySection =
        formattedMemories.length > 0
          ? ["## Recent A2A Memories:", ...formattedMemories]
          : [];
      // Compose the final context for the LLM
      const recentMessages: {
        role: "system";
        content: string;
        timestamp: string;
      }[] = [...formattedChat, ...a2aSection, ...memorySection].map(
        (content) => ({
          role: "system" as const,
          content,
          timestamp: new Date().toISOString(),
        })
      );

      // Create user message
      const userMsg: AgentMessage = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };
      // Append user message to chat history and save only if user-initiated (depth === 0)
      let updatedChat = chatHistory;
      if (depth === 0) {
        updatedChat = [...chatHistory, userMsg];
        await fetch(`/api/memory/set`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: `agent:${agentId}:chat`,
            value: updatedChat,
          }),
        });
      }
      // Also add to short-term memory
      await AgentMemory.addMemory(agentId, {
        type: "user_message",
        content: message,
        importance: 5,
      });

      if (onThoughtStep) onThoughtStep("Generating response with context...");

      // Main tool call execution loop with standard context
      let agentResponseContent = await this.generateAgentResponse(
        agent,
        message,
        recentMessages
      );
      let finalAgentMessage: AgentMessage | null = null;
      // If the response does not contain 'tool_call', treat as normal agent response
      if (!agentResponseContent.includes("tool_call")) {
        finalAgentMessage = {
          role: "agent",
          content: agentResponseContent,
          timestamp: new Date().toISOString(),
        };
        // Only save agent response to chat if user-initiated (depth === 0)
        if (depth === 0) {
          const finalChat = [...updatedChat, finalAgentMessage];
          await fetch(`/api/memory/set`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key: `agent:${agentId}:chat`,
              value: finalChat,
            }),
          });
        }
        await AgentMemory.addMemory(agentId, {
          type: "agent_response",
          content: finalAgentMessage.content,
          importance: 6,
        });
        return finalAgentMessage;
      }
      let toolCall: ToolCall | null = null;
      let loopCount = 0;
      let currentMessage = message;
      let currentContext = [...recentMessages];
      while (loopCount < 5) {
        // prevent infinite loops
        loopCount++;
        // If the new LLM response does not contain 'tool_call', treat as normal agent response and break
        if (!agentResponseContent.includes("tool_call")) {
          finalAgentMessage = {
            role: "agent",
            content: agentResponseContent,
            timestamp: new Date().toISOString(),
          };
          // Only save agent response to chat if user-initiated (depth === 0)
          if (depth === 0) {
            const finalChat = [...updatedChat, finalAgentMessage];
            await fetch(`/api/memory/set`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: `agent:${agentId}:chat`,
                value: finalChat,
              }),
            });
          }
          await AgentMemory.addMemory(agentId, {
            type: "agent_response",
            content: finalAgentMessage.content,
            importance: 6,
          });
          return finalAgentMessage;
        }
        // Try to parse for tool call
        toolCall = null;
        let parseError: string | null = null;
        try {
          let toParse = agentResponseContent;
          // If the response contains a Markdown code block, extract the JSON inside it
          const codeBlockMatch = toParse.match(
            /```(?:json)?\s*([\s\S]*?)\s*```/i
          );
          if (codeBlockMatch && codeBlockMatch[1]) {
            toParse = codeBlockMatch[1];
          }
          // If there is leading/trailing text, try to extract the first JSON object
          if (!toParse.trim().startsWith("{")) {
            const jsonMatch = toParse.match(/\{[\s\S]*\}/);
            if (jsonMatch && jsonMatch[0]) {
              toParse = jsonMatch[0];
            }
          }
          const parsed = JSON.parse(toParse);
          if (parsed && typeof parsed === "object" && parsed.tool_call) {
            toolCall = parsed as ToolCall;
          }
        } catch (err) {
          parseError = err instanceof Error ? err.message : String(err);
        }
        if (!toolCall) {
          // No tool call, treat as final agent response
          // If there was a parse error, inform the user
          finalAgentMessage = {
            role: "agent",
            content:
              parseError && agentResponseContent.trim().length < 1000
                ? `I tried to use a tool, but my response was not valid JSON and could not be parsed. Here is what I produced:\n\n${agentResponseContent}\n\nError: ${parseError}\n\nPlease try rephrasing your request or check the agent's configuration.`
                : agentResponseContent,
            timestamp: new Date().toISOString(),
          };
          break;
        }
        // Execute the tool call
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
          agentResponseContent = `I need to use the tool "$${
            toolCall.tool_call
          }" with arguments: ${JSON.stringify(toolCall.args, null, 2)}.
\n\nThis tool requires your approval before I can proceed. Please review and approve/reject this tool usage.`;
          finalAgentMessage = {
            role: "agent",
            content: agentResponseContent,
            timestamp: new Date().toISOString(),
          };
          break;
        }
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
          await AgentMemory.addMemory(agent.id, {
            type: "observation",
            content: `Tool ${
              toolCall.tool_call
            } executed. Result: ${JSON.stringify(toolResult.result)}`,
            importance: 7,
          });
          // Special handling for SEND_MESSAGE: actually call the receiving agent's LLM
          if (
            toolCall.tool_call === "SEND_MESSAGE" &&
            toolCall.args &&
            toolCall.args.to_id &&
            toolCall.args.message
          ) {
            if (onThoughtStep)
              onThoughtStep(
                `Triggering receiving agent (${toolCall.args.to_id}) to process message...`
              );
            // Call the receiving agent's LLM as if receiving a user message, incrementing depth and passing maxDepth
            const responseFromOtherAgent = await this.sendMessage(
              toolCall.args.to_id,
              toolCall.args.message,
              onThoughtStep,
              depth + 1,
              maxDepth
            );
            // Use the LLM to summarize what occurred
            const summaryPrompt = `You just sent a message to agent ${toolCall.args.to_id} with the content: "${toolCall.args.message}". They replied: "${responseFromOtherAgent.content}". Please summarize this interaction for the user, reflecting on what happened and what the next steps might be. Do not initiate another agent-to-agent message in response to a received message unless specifically instructed by the user. Conclude the conversation once your goal is accomplished or you have responded to the other agent.`;
            const summary = await this.generateAgentResponse(
              agent,
              summaryPrompt,
              currentContext
            );
            finalAgentMessage = {
              role: "agent",
              content: summary,
              timestamp: new Date().toISOString(),
            };
            // Only break if we've reached maxDepth, otherwise continue the loop
            if (depth + 1 >= maxDepth) {
              break;
            } else {
              // Prepare for next loop iteration: update currentMessage and context
              const nextPrompt = `You just received this reply from agent ${toolCall.args.to_id}: "${responseFromOtherAgent.content}". What would you like to do next for the user's goal? Continue the agent-to-agent conversation up to the max depth (${maxDepth}) unless the user says to stop.`;
              currentMessage = nextPrompt;
              currentContext = [
                ...currentContext,
                {
                  role: "system" as const,
                  content: nextPrompt,
                  timestamp: new Date().toISOString(),
                },
              ];
              agentResponseContent = await this.generateAgentResponse(
                agent,
                currentMessage,
                currentContext
              );
              continue;
            }
          }
          // For other tools, inject tool result as a system message and re-prompt LLM
          const toolResultMsg = {
            role: "system" as const,
            content: JSON.stringify(toolResult),
            timestamp: new Date().toISOString(),
          };
          currentContext = [...currentContext, toolResultMsg];
          agentResponseContent = await this.generateAgentResponse(
            agent,
            currentMessage,
            currentContext
          );
          // Continue the loop to check if the new response is a tool call
          continue;
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
          // Continue the loop to see if the next response is a tool call
          continue;
        }
      }
      // After loop, log and return the final agent message
      if (finalAgentMessage) {
        // Only save agent response to chat if user-initiated (depth === 0)
        if (depth === 0) {
          const finalChat = [...updatedChat, finalAgentMessage];
          await fetch(`/api/memory/set`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key: `agent:${agentId}:chat`,
              value: finalChat,
            }),
          });
        }
        await AgentMemory.addMemory(agentId, {
          type: "agent_response",
          content: finalAgentMessage.content,
          importance: 6,
        });
        return finalAgentMessage;
      } else {
        throw new Error(
          "Failed to get a valid agent response after tool execution loop."
        );
      }
    } catch (error) {
      console.error("Error sending message to agent:", error);
      if (onThoughtStep)
        onThoughtStep(
          "Error: " + (error instanceof Error ? error.message : error)
        );
      // Return a user-friendly error message
      return {
        role: "agent",
        content: `An error occurred while sending the message: ${
          error instanceof Error ? error.message : error
        }`,
        timestamp: new Date().toISOString(),
      };
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
      const contextForTask = recentMessages.map((m) => ({
        role: "system" as const,
        content: `${m.role}: ${m.content}`,
        timestamp: m.timestamp,
      }));
      const agentRes = await this.generateAgentResponse(
        agent,
        task,
        contextForTask
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

      // After autonomous task is completed, embed comprehensive context
      SharedVectorDB.embedAgentAction(agent.id, task, agentRes);

      // Also embed the task as a context chunk for future retrieval
      SharedVectorDB.embedContextChunk(
        agent.id,
        `Autonomous Task: ${task}\nResult: ${agentRes}`,
        {
          taskType: "autonomous",
          success: true,
          importance: 8,
        }
      );

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
   * Generate a response using AI service with balanced context management
   */
  private static async generateAgentResponse(
    agent: Agent | null,
    message: string,
    contextMessages: {
      role: "system";
      content: string;
      timestamp: string;
    }[] = []
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

      const aiMessages = [];

      // FIRST: Add base agent context (highest priority)
      const baseContext = await AgentMemory.getFact(agent.id, "base_context");
      if (baseContext) {
        aiMessages.push({
          role: "system",
          content: baseContext,
          timestamp: new Date().toISOString(),
        });
      }

      // SECOND: Add recent conversation context (from contextMessages parameter)
      if (contextMessages.length > 0) {
        // Only add the most recent context messages to avoid overload
        const recentContext = contextMessages.slice(-5);
        aiMessages.push(
          ...recentContext.map((msg) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
          }))
        );
      }

      // THIRD: Add important memories (limited to prevent context overload)
      // Only include important memories/tool results that are relevant to the current user message
      const importantMemories = await AgentMemory.getImportantMemories(
        agent.id,
        10
      );
      // Simple relevance filter: include if memory content contains a keyword from the user message
      const userKeywords = message
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2);
      const relevantMemories = importantMemories.filter((m) =>
        userKeywords.some((kw) => m.content.toLowerCase().includes(kw))
      );
      // If no relevant memories, include only the most recent one for context
      const memoriesToInclude =
        relevantMemories.length > 0
          ? relevantMemories.slice(0, 3)
          : importantMemories.slice(0, 1);
      if (memoriesToInclude.length > 0) {
        const memoryContent = memoriesToInclude
          .map((m) => `[${m.type.toUpperCase()}] ${m.content}`)
          .join("\n");
        aiMessages.push({
          role: "system",
          content: `## Relevant Context:\n${memoryContent}`,
          timestamp: new Date().toISOString(),
        });
      }
      // FOURTH: Add the current user message
      aiMessages.push({
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      });

      // Set maxTokens to 90% of the model's max context window, robust to model name variants
      const modelKey = (agent.config.model || "").toLowerCase();
      let maxContext = 3000;
      if (
        modelKey.includes("gpt-4-turbo") ||
        modelKey.includes("gpt-4-1106-preview")
      ) {
        maxContext = 128000;
      } else if (modelKey.includes("gpt-4")) {
        maxContext = 8192;
      } else if (modelKey.includes("gpt-3.5-turbo-16k")) {
        maxContext = 16000;
      } else if (modelKey.includes("gpt-3.5-turbo")) {
        maxContext = 4096;
      } else if (modelKey.includes("claude-3-opus")) {
        maxContext = 200000;
      } else if (modelKey.includes("claude-3-sonnet")) {
        maxContext = 200000;
      } else if (modelKey.includes("claude-3-haiku")) {
        maxContext = 200000;
      } else if (modelKey.includes("claude-2.1")) {
        maxContext = 200000;
      } else if (modelKey.includes("claude-2")) {
        maxContext = 100000;
      } else if (modelKey.includes("claude-instant-1")) {
        maxContext = 100000;
      } else if (
        modelKey.includes("gemini-2.5-pro") ||
        modelKey.includes("gemini-2.5-flash")
      ) {
        maxContext = 1048576;
      } else if (modelKey.includes("llama-2-70b")) {
        maxContext = 4096;
      } else if (modelKey.includes("dialogpt-medium")) {
        maxContext = 2048;
      } else {
        maxContext = 3000;
      }

      // Accurate token counting for OpenAI models using tiktoken
      let promptTokens = 0;
      try {
        if (modelKey.includes("gpt-3.5") || modelKey.includes("gpt-4")) {
          // @ts-expect-error: tiktoken has no type declarations
          const { encoding_for_model } = await import("@dqbd/tiktoken");
          const enc = encoding_for_model(
            (agent.config.model || "gpt-3.5-turbo") as any
          );
          promptTokens = aiMessages.reduce(
            (acc, m) => acc + enc.encode(m.content).length,
            0
          );
          enc.free();
        } else {
          // Fallback for non-OpenAI models (rough estimate)
          const promptText = aiMessages.map((m) => m.content).join(" ");
          promptTokens = Math.ceil(promptText.split(/\s+/).length * 1.3);
        }
      } catch (err) {
        // If tiktoken fails, fallback to rough estimate
        const promptText = aiMessages.map((m) => m.content).join(" ");
        promptTokens = Math.ceil(promptText.split(/\s+/).length * 1.3);
      }
      let maxTokens = Math.floor(maxContext * 0.9) - promptTokens;
      if (maxTokens < 256) maxTokens = 256;
      const response = await AIService.generateResponse(
        aiMessages,
        agent.config.model,
        {
          temperature: 0.7,
          maxTokens,
        }
      );

      // Store the generated response for future context (but don't overload vector DB)
      if (response.content.length > 50) {
        // Only store meaningful responses
        SharedVectorDB.embedContextChunk(
          agent.id,
          `Agent Response: ${response.content}`,
          {
            responseType: "generated",
            messageContext: message.substring(0, 100),
            importance: 6,
          }
        );
      }

      return response.content;
    } catch (error) {
      console.error("Error generating AI response:", error);

      // Store error context for learning
      await AgentMemory.addMemory(agent.id, {
        type: "observation",
        content: `AI response generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        importance: 8,
        metadata: { error: true, message },
      });

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
    const contextForSessionSummary = conversation.messages
      .slice(-10)
      .map((m) => ({
        role: "system" as const,
        content: `${m.role}: ${m.content}`,
        timestamp: m.timestamp,
      }));
    const summary = await this.generateAgentResponse(
      agent,
      summaryPrompt +
        "\n\nConversation:\n" +
        conversation.messages.map((m) => `${m.role}: ${m.content}`).join("\n") +
        "\n\nMemories:\n" +
        memories.map((m) => `- ${m.content}`).join("\n"),
      contextForSessionSummary
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
