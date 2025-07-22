import { v4 as uuidv4 } from "uuid";

// Define the structure of memory entries
export interface MemoryEntry {
  id: string;
  agentId: string;
  type:
    | "user_message"
    | "agent_response"
    | "observation"
    | "reflection"
    | "message_received"
    | "system"
    | "collaborative_context"
    | "task_delegation"
    | "shared_learning"
    | "cross_agent_insight";
  content: string;
  importance: number;
  timestamp: string;
  metadata?: Record<string, any>;
  // Enhanced fields for collaboration
  sharedWith?: string[]; // Other agent IDs this memory is shared with
  contextId?: string; // Reference to shared context
  sourceAgentId?: string; // If this memory came from another agent
  isShared?: boolean; // Whether this memory can be shared with other agents
}

// Utility for backend API base URL
const API_BASE = "/api";

// Agent Memory class
export class AgentMemory {
  /**
   * Public method to initialize the agent memory system
   */
  static init(): void {
    // No initialization needed for backend storage
  }

  /**
   * Add a new short-term memory entry for an agent (stored in Redis)
   */
  static async addMemory(
    agentId: string,
    {
      type,
      content,
      importance,
      metadata,
    }: {
      type: MemoryEntry["type"];
      content: string;
      importance?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<MemoryEntry | null> {
    const entry: MemoryEntry = {
      id: uuidv4(),
      agentId,
      type,
      content,
      importance: importance ?? this.assessImportance(content, type),
      timestamp: new Date().toISOString(),
      metadata,
    };
    // Fetch current array, append, and save back
    const res = await fetch(`${API_BASE}/memory/get/agent:${agentId}:memories`);
    let current: MemoryEntry[] = [];
    try {
      const data = await res.json();
      if (Array.isArray(data.value)) current = data.value;
      else if (data.value) current = [data.value];
    } catch {}
    const updated = [...current, entry];
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: `agent:${agentId}:memories`,
        value: updated,
      }),
    });
    return entry;
  }

  /**
   * Get all short-term memories for an agent (from Redis)
   */
  static async getMemories(agentId: string): Promise<MemoryEntry[]> {
    const res = await fetch(`${API_BASE}/memory/get/agent:${agentId}:memories`);
    const data = await res.json();
    if (Array.isArray(data.value)) return data.value;
    if (data.value) return [data.value];
    return [];
  }

  /**
   * Clear all short-term memories for an agent (in Redis)
   */
  static async clearMemories(agentId: string): Promise<boolean> {
    // Overwrite with empty array
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: `agent:${agentId}:memories`, value: [] }),
    });
    return true;
  }

  /**
   * Add shared memory that can be accessed by multiple agents
   */
  static async addSharedMemory(
    agentId: string,
    {
      type,
      content,
      importance,
      sharedWith,
      contextId,
      metadata,
    }: {
      type: MemoryEntry["type"];
      content: string;
      importance?: number;
      sharedWith: string[];
      contextId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<MemoryEntry | null> {
    const entry: MemoryEntry = {
      id: uuidv4(),
      agentId,
      type,
      content,
      importance: importance ?? this.assessImportance(content, type),
      timestamp: new Date().toISOString(),
      sharedWith,
      contextId,
      isShared: true,
      metadata,
    };

    // Add to creator's memory
    await this.addMemory(agentId, entry);

    // Add to each shared agent's memory
    for (const targetAgentId of sharedWith) {
      if (targetAgentId !== agentId) {
        const sharedEntry = {
          ...entry,
          id: uuidv4(), // New ID for each agent
          agentId: targetAgentId,
          sourceAgentId: agentId,
        };
        await this.addMemory(targetAgentId, sharedEntry);
      }
    }

    return entry;
  }

  /**
   * Get shared memories for an agent (memories shared with this agent)
   */
  static async getSharedMemories(agentId: string): Promise<MemoryEntry[]> {
    const memories = await this.getMemories(agentId);
    return memories.filter(memory => 
      memory.isShared && 
      (memory.sharedWith?.includes(agentId) || memory.sourceAgentId)
    );
  }

  /**
   * Get memories by context ID
   */
  static async getMemoriesByContext(contextId: string): Promise<MemoryEntry[]> {
    // This is a simplified implementation - in a real system, you'd want proper indexing
    const res = await fetch(`${API_BASE}/memory/get/global:context_memories:${contextId}`);
    const data = await res.json();
    if (Array.isArray(data.value)) return data.value;
    if (data.value) return [data.value];
    return [];
  }

  /**
   * Add memory to a shared context
   */
  static async addContextMemory(
    agentId: string,
    contextId: string,
    {
      type,
      content,
      importance,
      metadata,
    }: {
      type: MemoryEntry["type"];
      content: string;
      importance?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<MemoryEntry | null> {
    const entry: MemoryEntry = {
      id: uuidv4(),
      agentId,
      type,
      content,
      importance: importance ?? this.assessImportance(content, type),
      timestamp: new Date().toISOString(),
      contextId,
      isShared: true,
      metadata,
    };

    // Add to agent's memory
    await this.addMemory(agentId, entry);

    // Also store in context-specific storage
    const contextMemories = await this.getMemoriesByContext(contextId);
    contextMemories.push(entry);
    
    await fetch(`${API_BASE}/memory/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: `global:context_memories:${contextId}`,
        value: contextMemories,
      }),
    });

    return entry;
  }

  /**
   * Get contextual memories for building agent prompts (CrewAI-inspired)
   */
  static async buildContextualMemory(
    agentId: string,
    currentTask?: string,
    contextId?: string
  ): Promise<string> {
    const memories = await this.getMemories(agentId);
    const sharedMemories = await this.getSharedMemories(agentId);
    let contextMemories: MemoryEntry[] = [];
    
    if (contextId) {
      contextMemories = await this.getMemoriesByContext(contextId);
    }

    // Build context string
    const contextParts: string[] = [];

    // Add relevant personal memories
    const relevantMemories = memories
      .filter(m => m.importance >= 7 || (currentTask && m.content.toLowerCase().includes(currentTask.toLowerCase())))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
    
    if (relevantMemories.length > 0) {
      contextParts.push("## Personal Memory:");
      relevantMemories.forEach(m => {
        contextParts.push(`- ${m.content} (${m.type})`);
      });
    }

    // Add shared memories
    const relevantSharedMemories = sharedMemories
      .filter(m => m.importance >= 6)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
    
    if (relevantSharedMemories.length > 0) {
      contextParts.push("\n## Shared Knowledge:");
      relevantSharedMemories.forEach(m => {
        const source = m.sourceAgentId ? ` (from Agent-${m.sourceAgentId})` : "";
        contextParts.push(`- ${m.content}${source}`);
      });
    }

    // Add context-specific memories
    if (contextMemories.length > 0) {
      contextParts.push("\n## Collaboration Context:");
      contextMemories
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5)
        .forEach(m => {
          contextParts.push(`- ${m.content} (by Agent-${m.agentId})`);
        });
    }

    return contextParts.join("\n");
  }

  /**
   * Share insights with other agents based on recent experiences
   */
  static async shareInsights(
    agentId: string,
    targetAgentIds: string[],
    topic: string
  ): Promise<MemoryEntry[]> {
    const memories = await this.getMemories(agentId);
    
    // Find memories related to the topic
    const relevantMemories = memories.filter(m => 
      m.content.toLowerCase().includes(topic.toLowerCase()) &&
      m.importance >= 6 &&
      !m.isShared // Don't re-share already shared memories
    );

    const sharedInsights: MemoryEntry[] = [];

    for (const memory of relevantMemories.slice(0, 3)) { // Limit to top 3 insights
      const insight = await this.addSharedMemory(agentId, {
        type: "cross_agent_insight",
        content: `Insight about ${topic}: ${memory.content}`,
        importance: memory.importance,
        sharedWith: targetAgentIds,
        metadata: { 
          originalMemoryId: memory.id,
          topic,
          shared: true
        }
      });
      
      if (insight) {
        sharedInsights.push(insight);
      }
    }

    return sharedInsights;
  }

  /**
   * Search agent memories using a query
   */
  static async searchMemories(
    agentId: string,
    query: string
  ): Promise<MemoryEntry[]> {
    const agentMemories = await this.getMemories(agentId);
    const queryLower = query.toLowerCase();

    return agentMemories.filter((memory) =>
      memory.content.toLowerCase().includes(queryLower)
    );
  }

  /**
   * Get recent memories for an agent
   */
  static async getRecentMemories(
    agentId: string,
    limit: number = 10
  ): Promise<MemoryEntry[]> {
    const agentMemories = await this.getMemories(agentId);

    // Sort by timestamp (newest first)
    const sorted = [...agentMemories].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return sorted.slice(0, limit);
  }

  /**
   * Get most important memories for an agent
   */
  static async getImportantMemories(
    agentId: string,
    limit: number = 10
  ): Promise<MemoryEntry[]> {
    const agentMemories = await this.getMemories(agentId);

    // Sort by importance (highest first)
    const sorted = [...agentMemories].sort(
      (a, b) => b.importance - a.importance
    );

    return sorted.slice(0, limit);
  }

  /**
   * Get a long-term fact for an agent (from PostgreSQL)
   */
  static async getFact(agentId: string, key: string): Promise<string | null> {
    const res = await fetch(`${API_BASE}/longterm/get/${agentId}/${key}`);
    const data = await res.json();
    return data.value ?? null;
  }

  /**
   * Set a long-term fact for an agent (in PostgreSQL)
   */
  static async setFact(
    agentId: string,
    key: string,
    value: string
  ): Promise<boolean> {
    const res = await fetch(`${API_BASE}/longterm/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, key, value }),
    });
    return res.ok;
  }

  /**
   * Apply memory management policies (e.g., pruning old memories)
   */
  private static applyMemoryPolicies(agentId: string): void {
    // This method is no longer needed as memory is stored in Redis
  }

  /**
   * Assess the importance of a memory based on content and type
   * Enhanced implementation inspired by Cursor's Memory Rating Prompt
   */
  static assessImportance(content: string, type: MemoryEntry["type"]): number {
    // Base importance by type
    let importance = 5; // default

    switch (type) {
      case "user_message":
        importance = 7; // User input is generally important
        break;
      case "agent_response":
        importance = 5; // Standard responses
        break;
      case "observation":
        importance = 6; // Environmental data
        break;
      case "reflection":
        importance = 8; // Internal analysis is highly valuable
        break;
      case "message_received":
        importance = 6; // Cross-agent communication
        break;
      case "system":
        importance = 7; // System-level information
        break;
    }

    const contentLower = content.toLowerCase();

    // Enhanced keyword analysis with weighted importance
    const criticalKeywords = [
      "critical",
      "urgent",
      "emergency",
      "error",
      "failed",
      "broken",
      "danger",
      "crash",
      "fatal",
      "exception",
      "timeout",
      "deadline",
    ];
    const importantKeywords = [
      "important",
      "priority",
      "crucial",
      "essential",
      "key",
      "vital",
      "significant",
      "major",
      "primary",
      "core",
      "fundamental",
    ];
    const userEmphasisKeywords = [
      "remember",
      "don't forget",
      "save this",
      "keep in mind",
      "note this",
      "mark this",
      "highlight",
      "bookmark",
      "save for later",
      "important to me",
    ];
    const learningKeywords = [
      "learned",
      "discovered",
      "found",
      "realized",
      "understood",
      "pattern",
      "insight",
      "lesson",
      "discovery",
      "breakthrough",
      "solution",
      "fix",
    ];
    const negativeKeywords = [
      "unimportant",
      "trivial",
      "minor",
      "insignificant",
      "not needed",
      "can ignore",
      "skip this",
      "not relevant",
    ];

    // Check for critical keywords (highest priority - immediate boost)
    for (const keyword of criticalKeywords) {
      if (contentLower.includes(keyword)) {
        importance = Math.min(10, importance + 3);
        break; // Only apply the highest critical keyword
      }
    }

    // Check for important keywords (moderate boost)
    for (const keyword of importantKeywords) {
      if (contentLower.includes(keyword)) {
        importance = Math.min(10, importance + 2);
      }
    }

    // Check for user emphasis keywords (high priority - user intent)
    for (const keyword of userEmphasisKeywords) {
      if (contentLower.includes(keyword)) {
        importance = Math.min(10, importance + 2);
      }
    }

    // Check for learning/insight keywords (valuable for growth)
    for (const keyword of learningKeywords) {
      if (contentLower.includes(keyword)) {
        importance = Math.min(10, importance + 1);
      }
    }

    // Check for negative keywords (reduce importance)
    for (const keyword of negativeKeywords) {
      if (contentLower.includes(keyword)) {
        importance = Math.max(1, importance - 2);
      }
    }

    // Content length analysis (longer content often contains more detail)
    if (content.length > 1000) {
      importance = Math.min(10, importance + 1);
    } else if (content.length > 500) {
      importance = Math.min(10, importance + 0.5);
    } else if (content.length < 20) {
      importance = Math.max(1, importance - 1);
    }

    // Question analysis (questions often indicate important topics)
    if (
      content.includes("?") ||
      content.includes("how") ||
      content.includes("why") ||
      content.includes("what")
    ) {
      importance = Math.min(10, importance + 1);
    }

    // Exclamation analysis (emphasis often indicates importance)
    if (content.includes("!")) {
      importance = Math.min(10, importance + 0.5);
    }

    // Code or technical content (often important for technical agents)
    if (
      content.includes("function") ||
      content.includes("class") ||
      content.includes("import") ||
      content.includes("const") ||
      content.includes("let") ||
      content.includes("var") ||
      content.includes("if") ||
      content.includes("for") ||
      content.includes("while")
    ) {
      importance = Math.min(10, importance + 1);
    }

    // URL or reference content (often important for research)
    if (
      content.includes("http") ||
      content.includes("www.") ||
      content.includes(".com") ||
      content.includes(".org") ||
      content.includes(".io")
    ) {
      importance = Math.min(10, importance + 1);
    }

    // Number analysis (specific data often important)
    if (/\d+/.test(content)) {
      importance = Math.min(10, importance + 0.5);
    }

    // Ensure importance is between 1 and 10
    return Math.max(1, Math.min(10, Math.round(importance)));
  }
}
