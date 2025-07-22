import { v4 as uuidv4 } from "uuid";
import { AgentMemory } from "./agent-memory";
import { AgentExecution } from "./agent-execution";

// Enhanced message types for better collaboration
export interface A2AMessage {
  id: string;
  sourceAgentId: string;
  sourceAgentName: string;
  targetAgentId: string;
  targetAgentName: string;
  message: string;
  timestamp: string;
  status: "pending" | "success" | "error" | "requires_approval";
  error?: string;
  metadata?: Record<string, any>;
  // Enhanced fields for collaboration
  messageType: "direct" | "delegation" | "request" | "response" | "broadcast" | "approval_request";
  taskId?: string;
  contextId?: string;
  priority: "low" | "medium" | "high" | "urgent";
  requiresApproval?: boolean;
  approvedBy?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  sharedContext?: SharedContext;
}

// Shared context between agents
export interface SharedContext {
  id: string;
  creatorAgentId: string;
  participantAgents: string[];
  topic: string;
  context: string;
  lastUpdated: string;
  version: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

// Task delegation structure
export interface AgentTask {
  id: string;
  title: string;
  description: string;
  assigneeAgentId: string;
  assignerAgentId: string;
  status: "assigned" | "in_progress" | "completed" | "failed" | "requires_approval";
  priority: "low" | "medium" | "high" | "urgent";
  dependencies: string[]; // Other task IDs this depends on
  subtasks: string[]; // Subtask IDs
  context?: SharedContext;
  metadata?: Record<string, any>;
  createdAt: string;
  dueBy?: string;
  completedAt?: string;
  approvalRequired?: boolean;
  approvedBy?: string;
}

// Agent capability and state information
export interface AgentState {
  agentId: string;
  agentName: string;
  capabilities: string[];
  currentTasks: string[];
  workload: "idle" | "light" | "medium" | "heavy" | "overloaded";
  specializations: string[];
  availability: "available" | "busy" | "offline";
  lastActivity: string;
  performance: {
    tasksCompleted: number;
    successRate: number;
    averageResponseTime: number;
  };
}

const API_BASE = "/api";

// Enhanced A2A Communication class
export class A2ACommunication {
  /**
   * Initialize the enhanced A2A communication system
   */
  static init(): void {
    // Initialize shared contexts and agent states
    this.initializeSharedSystems();
  }

  private static async initializeSharedSystems(): Promise<void> {
    // Initialize global shared contexts if not exists
    try {
      await fetch(`${API_BASE}/memory/get/global:shared_contexts`);
    } catch {
      await fetch(`${API_BASE}/memory/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          key: `global:shared_contexts`, 
          value: [] 
        }),
      });
    }

    // Initialize agent states tracking
    try {
      await fetch(`${API_BASE}/memory/get/global:agent_states`);
    } catch {
      await fetch(`${API_BASE}/memory/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          key: `global:agent_states`, 
          value: {} 
        }),
      });
    }

    // Initialize collaborative tasks
    try {
      await fetch(`${API_BASE}/memory/get/global:collaborative_tasks`);
    } catch {
      await fetch(`${API_BASE}/memory/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          key: `global:collaborative_tasks`, 
          value: [] 
        }),
      });
    }
  }

  /**
   * Enhanced message sending with context awareness and delegation support
   */
  static async sendMessage(
    sourceAgentId: string,
    sourceAgentName: string,
    targetAgentId: string,
    targetAgentName: string,
    message: string,
    options: {
      messageType?: A2AMessage["messageType"];
      priority?: A2AMessage["priority"];
      requiresApproval?: boolean;
      taskId?: string;
      contextId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<A2AMessage> {
    const {
      messageType = "direct",
      priority = "medium",
      requiresApproval = false,
      taskId,
      contextId,
      metadata = {}
    } = options;

    // Get shared context if specified
    let sharedContext: SharedContext | undefined;
    if (contextId) {
      sharedContext = await this.getSharedContext(contextId);
    }

    const newMessage: A2AMessage = {
      id: uuidv4(),
      sourceAgentId,
      sourceAgentName,
      targetAgentId,
      targetAgentName,
      message,
      timestamp: new Date().toISOString(),
      status: requiresApproval ? "requires_approval" : "pending",
      messageType,
      priority,
      requiresApproval,
      taskId,
      contextId,
      sharedContext,
      metadata: { ...metadata, a2a: true },
    };

    // Store message
    await this.storeMessage(newMessage);

    // Update agent states
    await this.updateAgentActivity(sourceAgentId);
    
    // If it's a delegation, create a task
    if (messageType === "delegation") {
      await this.createCollaborativeTask({
        title: `Delegated Task: ${message.substring(0, 50)}...`,
        description: message,
        assigneeAgentId: targetAgentId,
        assignerAgentId: sourceAgentId,
        priority,
        approvalRequired: requiresApproval,
        contextId
      });
    }

    return newMessage;
  }

  /**
   * Broadcast message to multiple agents
   */
  static async broadcastMessage(
    sourceAgentId: string,
    sourceAgentName: string,
    targetAgentIds: string[],
    message: string,
    options: {
      priority?: A2AMessage["priority"];
      contextId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<A2AMessage[]> {
    const results: A2AMessage[] = [];
    
    for (const targetAgentId of targetAgentIds) {
      // Get target agent name (simplified - in real implementation, get from agent store)
      const targetAgentName = `Agent-${targetAgentId}`;
      
      const message_result = await this.sendMessage(
        sourceAgentId,
        sourceAgentName,
        targetAgentId,
        targetAgentName,
        message,
        {
          ...options,
          messageType: "broadcast"
        }
      );
      results.push(message_result);
    }

    return results;
  }

  /**
   * Create shared context for multi-agent collaboration
   */
  static async createSharedContext(
    creatorAgentId: string,
    participantAgents: string[],
    topic: string,
    context: string,
    metadata?: Record<string, any>
  ): Promise<SharedContext> {
    const sharedContext: SharedContext = {
      id: uuidv4(),
      creatorAgentId,
      participantAgents: [...participantAgents, creatorAgentId],
      topic,
      context,
      lastUpdated: new Date().toISOString(),
      version: 1,
      isActive: true,
      metadata
    };

    // Get current shared contexts
    const res = await fetch(`${API_BASE}/memory/get/global:shared_contexts`);
    const data = await res.json();
    const contexts: SharedContext[] = Array.isArray(data.value) ? data.value : [];
    
    // Add new context
    contexts.push(sharedContext);
    
    // Save back
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        key: `global:shared_contexts`, 
        value: contexts 
      }),
    });

    return sharedContext;
  }

  /**
   * Update shared context
   */
  static async updateSharedContext(
    contextId: string,
    updatorAgentId: string,
    newContext: string
  ): Promise<SharedContext | null> {
    const res = await fetch(`${API_BASE}/memory/get/global:shared_contexts`);
    const data = await res.json();
    const contexts: SharedContext[] = Array.isArray(data.value) ? data.value : [];
    
    const contextIndex = contexts.findIndex(ctx => ctx.id === contextId);
    if (contextIndex === -1) return null;

    const context = contexts[contextIndex];
    
    // Check if agent is participant
    if (!context.participantAgents.includes(updatorAgentId)) {
      throw new Error("Agent not authorized to update this context");
    }

    // Update context
    context.context = newContext;
    context.lastUpdated = new Date().toISOString();
    context.version += 1;

    // Save back
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        key: `global:shared_contexts`, 
        value: contexts 
      }),
    });

    return context;
  }

  /**
   * Get shared context by ID
   */
  static async getSharedContext(contextId: string): Promise<SharedContext | null> {
    const res = await fetch(`${API_BASE}/memory/get/global:shared_contexts`);
    const data = await res.json();
    const contexts: SharedContext[] = Array.isArray(data.value) ? data.value : [];
    
    return contexts.find(ctx => ctx.id === contextId) || null;
  }

  /**
   * Get shared contexts for an agent
   */
  static async getAgentSharedContexts(agentId: string): Promise<SharedContext[]> {
    const res = await fetch(`${API_BASE}/memory/get/global:shared_contexts`);
    const data = await res.json();
    const contexts: SharedContext[] = Array.isArray(data.value) ? data.value : [];
    
    return contexts.filter(ctx => 
      ctx.participantAgents.includes(agentId) && ctx.isActive
    );
  }

  /**
   * Create collaborative task
   */
  static async createCollaborativeTask(taskData: {
    title: string;
    description: string;
    assigneeAgentId: string;
    assignerAgentId: string;
    priority?: AgentTask["priority"];
    dependencies?: string[];
    subtasks?: string[];
    contextId?: string;
    approvalRequired?: boolean;
    dueBy?: string;
    metadata?: Record<string, any>;
  }): Promise<AgentTask> {
    const task: AgentTask = {
      id: uuidv4(),
      title: taskData.title,
      description: taskData.description,
      assigneeAgentId: taskData.assigneeAgentId,
      assignerAgentId: taskData.assignerAgentId,
      status: "assigned",
      priority: taskData.priority || "medium",
      dependencies: taskData.dependencies || [],
      subtasks: taskData.subtasks || [],
      createdAt: new Date().toISOString(),
      approvalRequired: taskData.approvalRequired || false,
      metadata: taskData.metadata,
      dueBy: taskData.dueBy
    };

    // Add context if specified
    if (taskData.contextId) {
      task.context = await this.getSharedContext(taskData.contextId);
    }

    // Get current tasks
    const res = await fetch(`${API_BASE}/memory/get/global:collaborative_tasks`);
    const data = await res.json();
    const tasks: AgentTask[] = Array.isArray(data.value) ? data.value : [];
    
    // Add new task
    tasks.push(task);
    
    // Save back
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        key: `global:collaborative_tasks`, 
        value: tasks 
      }),
    });

    return task;
  }

  /**
   * Update task status
   */
  static async updateTaskStatus(
    taskId: string,
    newStatus: AgentTask["status"],
    updaterAgentId: string,
    metadata?: Record<string, any>
  ): Promise<AgentTask | null> {
    const res = await fetch(`${API_BASE}/memory/get/global:collaborative_tasks`);
    const data = await res.json();
    const tasks: AgentTask[] = Array.isArray(data.value) ? data.value : [];
    
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return null;

    const task = tasks[taskIndex];
    
    // Check if agent is authorized to update
    if (task.assigneeAgentId !== updaterAgentId && task.assignerAgentId !== updaterAgentId) {
      throw new Error("Agent not authorized to update this task");
    }

    // Update task
    task.status = newStatus;
    if (newStatus === "completed") {
      task.completedAt = new Date().toISOString();
    }
    if (metadata) {
      task.metadata = { ...task.metadata, ...metadata };
    }

    // Save back
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        key: `global:collaborative_tasks`, 
        value: tasks 
      }),
    });

    return task;
  }

  /**
   * Get tasks for an agent
   */
  static async getAgentTasks(agentId: string): Promise<AgentTask[]> {
    const res = await fetch(`${API_BASE}/memory/get/global:collaborative_tasks`);
    const data = await res.json();
    const tasks: AgentTask[] = Array.isArray(data.value) ? data.value : [];
    
    return tasks.filter(task => 
      task.assigneeAgentId === agentId || task.assignerAgentId === agentId
    );
  }

  /**
   * Update agent state
   */
  static async updateAgentState(agentId: string, stateUpdate: Partial<AgentState>): Promise<AgentState> {
    const res = await fetch(`${API_BASE}/memory/get/global:agent_states`);
    const data = await res.json();
    const states: Record<string, AgentState> = data.value || {};
    
    // Get current state or create new one
    const currentState = states[agentId] || {
      agentId,
      agentName: `Agent-${agentId}`,
      capabilities: [],
      currentTasks: [],
      workload: "idle",
      specializations: [],
      availability: "available",
      lastActivity: new Date().toISOString(),
      performance: {
        tasksCompleted: 0,
        successRate: 1.0,
        averageResponseTime: 0
      }
    };

    // Update state
    const updatedState = { ...currentState, ...stateUpdate, lastActivity: new Date().toISOString() };
    states[agentId] = updatedState;

    // Save back
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        key: `global:agent_states`, 
        value: states 
      }),
    });

    return updatedState;
  }

  /**
   * Get agent state
   */
  static async getAgentState(agentId: string): Promise<AgentState | null> {
    const res = await fetch(`${API_BASE}/memory/get/global:agent_states`);
    const data = await res.json();
    const states: Record<string, AgentState> = data.value || {};
    
    return states[agentId] || null;
  }

  /**
   * Get all agent states
   */
  static async getAllAgentStates(): Promise<Record<string, AgentState>> {
    const res = await fetch(`${API_BASE}/memory/get/global:agent_states`);
    const data = await res.json();
    return data.value || {};
  }

  /**
   * Find best agent for task based on capabilities and workload
   */
  static async findBestAgentForTask(
    requiredCapabilities: string[],
    excludeAgents: string[] = [],
    priority: AgentTask["priority"] = "medium"
  ): Promise<string | null> {
    const allStates = await this.getAllAgentStates();
    
    const candidateAgents = Object.values(allStates).filter(state => 
      !excludeAgents.includes(state.agentId) &&
      state.availability === "available" &&
      state.workload !== "overloaded" &&
      requiredCapabilities.some(cap => state.capabilities.includes(cap))
    );

    if (candidateAgents.length === 0) return null;

    // Score agents based on capability match, workload, and performance
    const scoredAgents = candidateAgents.map(agent => {
      const capabilityScore = requiredCapabilities.filter(cap => 
        agent.capabilities.includes(cap)
      ).length / requiredCapabilities.length;
      
      const workloadScore = {
        idle: 1.0,
        light: 0.8,
        medium: 0.6,
        heavy: 0.3,
        overloaded: 0.0
      }[agent.workload] || 0;

      const performanceScore = agent.performance.successRate;

      const totalScore = (capabilityScore * 0.5) + (workloadScore * 0.3) + (performanceScore * 0.2);
      
      return { agent, score: totalScore };
    });

    // Sort by score descending
    scoredAgents.sort((a, b) => b.score - a.score);
    
    return scoredAgents[0]?.agent.agentId || null;
  }

  /**
   * Request approval for a message or task
   */
  static async requestApproval(
    requestorAgentId: string,
    approverAgentId: string,
    itemId: string,
    itemType: "message" | "task",
    reason: string
  ): Promise<A2AMessage> {
    return this.sendMessage(
      requestorAgentId,
      `Agent-${requestorAgentId}`,
      approverAgentId,
      `Agent-${approverAgentId}`,
      `Approval requested for ${itemType} ${itemId}: ${reason}`,
      {
        messageType: "approval_request",
        priority: "high",
        metadata: { itemId, itemType, reason }
      }
    );
  }

  /**
   * Approve or reject an item
   */
  static async processApproval(
    approverAgentId: string,
    itemId: string,
    itemType: "message" | "task",
    approved: boolean,
    reason?: string
  ): Promise<boolean> {
    if (itemType === "task") {
      const task = await this.updateTaskStatus(
        itemId,
        approved ? "in_progress" : "failed",
        approverAgentId,
        { approvalStatus: approved ? "approved" : "rejected", approvedBy: approverAgentId }
      );
      return !!task;
    } else {
      // Handle message approval
      const messages = await this.getAllMessages();
      const messageIndex = messages.findIndex(msg => msg.id === itemId);
      if (messageIndex === -1) return false;

      messages[messageIndex].approvalStatus = approved ? "approved" : "rejected";
      messages[messageIndex].approvedBy = approverAgentId;
      messages[messageIndex].status = approved ? "success" : "error";

      await this.storeAllMessages(messages);
      return true;
    }
  }

  // Private helper methods

  private static async storeMessage(message: A2AMessage): Promise<void> {
    const messages = await this.getAllMessages();
    messages.push(message);
    await this.storeAllMessages(messages);
  }

  private static async getAllMessages(): Promise<A2AMessage[]> {
    const res = await fetch(`${API_BASE}/memory/get/a2a:messages`);
    const data = await res.json();
    return Array.isArray(data.value) ? data.value : data.value ? [data.value] : [];
  }

  private static async storeAllMessages(messages: A2AMessage[]): Promise<void> {
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: `a2a:messages`, value: messages }),
    });
  }

  private static async updateAgentActivity(agentId: string): Promise<void> {
    await this.updateAgentState(agentId, {
      lastActivity: new Date().toISOString()
    });
  }

  // Existing methods (maintained for compatibility)

  /**
   * Get all messages for a specific agent (sent or received)
   */
  static async getAgentLogs(agentId: string): Promise<A2AMessage[]> {
    const res = await fetch(`${API_BASE}/memory/get/a2a:messages`);
    const data = await res.json();
    const allMessages: A2AMessage[] = Array.isArray(data.value)
      ? data.value
      : data.value
      ? [data.value]
      : [];
    return allMessages.filter(
      (msg) => msg.sourceAgentId === agentId || msg.targetAgentId === agentId
    );
  }

  /**
   * Get conversation between two specific agents
   */
  static async getConversation(
    agent1Id: string,
    agent2Id: string
  ): Promise<A2AMessage[]> {
    const res = await fetch(`${API_BASE}/memory/get/a2a:messages`);
    const data = await res.json();
    const allMessages: A2AMessage[] = Array.isArray(data.value)
      ? data.value
      : data.value
      ? [data.value]
      : [];
    return allMessages.filter(
      (msg) =>
        (msg.sourceAgentId === agent1Id && msg.targetAgentId === agent2Id) ||
        (msg.sourceAgentId === agent2Id && msg.targetAgentId === agent1Id)
    );
  }

  /**
   * Get all sent messages by an agent
   */
  static async getSentMessages(agentId: string): Promise<A2AMessage[]> {
    const allMessages = await this.getAgentLogs(agentId);
    return allMessages.filter((msg) => msg.sourceAgentId === agentId);
  }

  /**
   * Get all received messages by an agent
   */
  static async getReceivedMessages(agentId: string): Promise<A2AMessage[]> {
    const allMessages = await this.getAgentLogs(agentId);
    return allMessages.filter((msg) => msg.targetAgentId === agentId);
  }

  /**
   * Delete a specific message (only allowed by source agent)
   */
  static async deleteMessage(
    messageId: string,
    requestingAgentId: string
  ): Promise<boolean> {
    // Fetch all messages, filter out the one to delete, and overwrite
    const res = await fetch(`${API_BASE}/memory/get/a2a:messages`);
    const data = await res.json();
    let allMessages: A2AMessage[] = Array.isArray(data.value)
      ? data.value
      : data.value
      ? [data.value]
      : [];
    const message = allMessages.find((msg) => msg.id === messageId);
    if (!message || message.sourceAgentId !== requestingAgentId) return false;
    allMessages = allMessages.filter((msg) => msg.id !== messageId);
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: `a2a:messages`, value: allMessages }),
    });
    return true;
  }

  /**
   * Clear all A2A messages for an agent (removes all messages sent or received by agent)
   */
  static async clearLogs(agentId: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/memory/get/a2a:messages`);
    const data = await res.json();
    let allMessages: A2AMessage[] = Array.isArray(data.value)
      ? data.value
      : data.value
      ? [data.value]
      : [];
    allMessages = allMessages.filter(
      (msg) => msg.sourceAgentId !== agentId && msg.targetAgentId !== agentId
    );
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: `a2a:messages`, value: allMessages }),
    });
    return true;
  }

  /**
   * Get summary stats for agent communications
   */
  static async getAgentStats(agentId: string): Promise<{
    totalSent: number;
    totalReceived: number;
    successRate: number;
    uniqueAgents: number;
    collaborativeTasksCount: number;
    sharedContextsCount: number;
  }> {
    const sent = await this.getSentMessages(agentId);
    const received = await this.getReceivedMessages(agentId);
    const tasks = await this.getAgentTasks(agentId);
    const contexts = await this.getAgentSharedContexts(agentId);

    const successfulSent = sent.filter(
      (msg) => msg.status === "success"
    ).length;

    // Get unique agents communicated with
    const uniqueAgentIds = new Set<string>();
    sent.forEach((msg) => uniqueAgentIds.add(msg.targetAgentId));
    received.forEach((msg) => uniqueAgentIds.add(msg.sourceAgentId));

    // Remove self from unique agents count if present
    uniqueAgentIds.delete(agentId);

    return {
      totalSent: sent.length,
      totalReceived: received.length,
      successRate: sent.length > 0 ? successfulSent / sent.length : 1,
      uniqueAgents: uniqueAgentIds.size,
      collaborativeTasksCount: tasks.length,
      sharedContextsCount: contexts.length,
    };
  }
}

// Fetch cross-agent communication logs from long-term memory (PostgreSQL)
export async function getCrossAgentLogs(agentId: string) {
  const res = await fetch(
    `/api/longterm/get/${agentId}/cross_agent:log:${agentId}`
  );
  const data = await res.json();
  // The value may be a single entry or an array; normalize to array
  if (Array.isArray(data.value)) return data.value;
  if (data.value) return [data.value];
  return [];
}
