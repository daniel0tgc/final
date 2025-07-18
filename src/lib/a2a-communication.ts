import { v4 as uuidv4 } from "uuid";
import { AgentMemory } from "./agent-memory";
import { AgentExecution } from "./agent-execution";

// Define the structure of agent-to-agent messages
export interface A2AMessage {
  id: string;
  sourceAgentId: string;
  sourceAgentName: string;
  targetAgentId: string;
  targetAgentName: string;
  message: string;
  timestamp: string;
  status: "pending" | "success" | "error";
  error?: string;
  metadata?: Record<string, any>;
}

const API_BASE = "/api";

// A2A Communication class
export class A2ACommunication {
  /**
   * Public method to initialize the A2A communication system
   */
  static init(): void {
    // No initialization needed for backend storage
  }

  /**
   * Send a message from one agent to another (store in backend/Redis)
   */
  static async sendMessage(
    sourceAgentId: string,
    sourceAgentName: string,
    targetAgentId: string,
    targetAgentName: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<A2AMessage> {
    const newMessage: A2AMessage = {
      id: uuidv4(),
      sourceAgentId,
      sourceAgentName,
      targetAgentId,
      targetAgentName,
      message,
      timestamp: new Date().toISOString(),
      status: "pending",
      metadata: { ...(metadata || {}), a2a: true },
    };
    // Store in Redis via backend
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: `a2a:messages`, value: newMessage }),
    });
    // For now, return the message as pending; UI should poll for updates
    return newMessage;
  }

  /**
   * Update an existing message
   */
  private static updateMessage(updatedMessage: A2AMessage): void {
    // This method is no longer needed as messages are stored in backend
    console.warn(
      "updateMessage is deprecated as messages are stored in backend."
    );
  }

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
  }> {
    const sent = await this.getSentMessages(agentId);
    const received = await this.getReceivedMessages(agentId);

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
