import { v4 as uuidv4 } from 'uuid';

// Define the structure of memory entries
export interface MemoryEntry {
  id: string;
  agentId: string;
  type: 'user_message' | 'agent_response' | 'observation' | 'reflection' | 'message_received';
  content: string;
  importance: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Agent Memory class
export class AgentMemory {
  private static readonly STORAGE_KEY = 'agent_memories';
  private static memories: Map<string, MemoryEntry[]> = new Map();
  private static initialized = false;
  
  /**
   * Public method to initialize the agent memory system
   */
  static init(): void {
    this.initialize();
  }
  
  /**
   * Initialize the agent memory system
   */
  private static initialize(): void {
    if (this.initialized) return;
    
    try {
      // Load memories from localStorage
      const storedMemories = localStorage.getItem(this.STORAGE_KEY);
      if (storedMemories) {
        const parsed = JSON.parse(storedMemories);
        
        // Convert from object to Map for easier access
        for (const agentId in parsed) {
          this.memories.set(agentId, parsed[agentId]);
        }
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Agent Memory:', error);
      // Initialize with empty map if there's an error
      this.memories = new Map();
      this.initialized = true;
    }
  }
  
  /**
   * Save all memories to localStorage
   */
  private static saveMemories(): void {
    try {
      // Convert Map to Object for storage
      const memoriesObj: Record<string, MemoryEntry[]> = {};
      for (const [agentId, entries] of this.memories.entries()) {
        memoriesObj[agentId] = entries;
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memoriesObj));
    } catch (error) {
      console.error('Failed to save agent memories:', error);
    }
  }
  
  /**
   * Add a new memory entry for an agent
   */
  static addMemory(
    agentId: string, 
    {
      type,
      content,
      importance,
      metadata
    }: {
      type: MemoryEntry['type'],
      content: string,
      importance?: number,
      metadata?: Record<string, any>
    }
  ): MemoryEntry {
    this.initialize();
    
    // If importance is not provided, calculate it
    if (importance === undefined) {
      importance = this.assessImportance(content, type);
    }
    
    // Create new memory entry
    const newEntry: MemoryEntry = {
      id: uuidv4(),
      agentId,
      type,
      content,
      importance,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    // Get or create agent's memory array
    if (!this.memories.has(agentId)) {
      this.memories.set(agentId, []);
    }
    
    // Add new entry
    const agentMemories = this.memories.get(agentId)!;
    agentMemories.push(newEntry);
    
    // Apply memory management policies
    this.applyMemoryPolicies(agentId);
    
    // Save to localStorage
    this.saveMemories();
    
    return newEntry;
  }
  
  /**
   * Get all memories for an agent
   */
  static getMemories(agentId: string): MemoryEntry[] {
    this.initialize();
    
    return this.memories.get(agentId) || [];
  }
  
  /**
   * Apply memory management policies (e.g., pruning old memories)
   */
  private static applyMemoryPolicies(agentId: string): void {
    const agentMemories = this.memories.get(agentId);
    if (!agentMemories) return;
    
    // Sort by importance (highest first) and timestamp (newest first)
    agentMemories.sort((a, b) => {
      if (a.importance !== b.importance) {
        return b.importance - a.importance;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    // Limit to 200 memories per agent for performance
    // Note: In a real implementation, consider more sophisticated strategies
    // like differential storage based on importance
    const MAX_MEMORIES = 200;
    if (agentMemories.length > MAX_MEMORIES) {
      this.memories.set(agentId, agentMemories.slice(0, MAX_MEMORIES));
    }
  }
  
  /**
   * Clear all memories for an agent
   */
  static clearMemories(agentId: string): boolean {
    this.initialize();
    
    this.memories.delete(agentId);
    this.saveMemories();
    
    return true;
  }
  
  /**
   * Search agent memories using a query
   */
  static searchMemories(agentId: string, query: string): MemoryEntry[] {
    this.initialize();
    
    const agentMemories = this.memories.get(agentId) || [];
    const queryLower = query.toLowerCase();
    
    return agentMemories.filter(memory => 
      memory.content.toLowerCase().includes(queryLower)
    );
  }
  
  /**
   * Get recent memories for an agent
   */
  static getRecentMemories(agentId: string, limit: number = 10): MemoryEntry[] {
    this.initialize();
    
    const agentMemories = this.memories.get(agentId) || [];
    
    // Sort by timestamp (newest first)
    const sorted = [...agentMemories].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return sorted.slice(0, limit);
  }
  
  /**
   * Get most important memories for an agent
   */
  static getImportantMemories(agentId: string, limit: number = 10): MemoryEntry[] {
    this.initialize();
    
    const agentMemories = this.memories.get(agentId) || [];
    
    // Sort by importance (highest first)
    const sorted = [...agentMemories].sort((a, b) => b.importance - a.importance);
    
    return sorted.slice(0, limit);
  }
  
  /**
   * Assess the importance of a memory based on content and type
   * This is a simple heuristic implementation
   */
  static assessImportance(content: string, type: MemoryEntry['type']): number {
    // Base importance by type
    let importance = 5; // default
    
    switch (type) {
      case 'observation':
        importance = 5;
        break;
      case 'reflection':
        importance = 6;
        break;
      case 'user_message':
        importance = 7;
        break;
      case 'agent_response':
        importance = 5;
        break;
      case 'message_received':
        importance = 6;
        break;
    }
    
    const contentLower = content.toLowerCase();
    
    // Check for important keywords
    const importantKeywords = [
      'critical', 'urgent', 'important', 'priority', 'crucial', 'essential',
      'error', 'failed', 'warning', 'alert', 'danger',
      'remember', 'don\'t forget', 'key', 'vital', 'significant'
    ];
    
    for (const keyword of importantKeywords) {
      if (contentLower.includes(keyword)) {
        importance += 1;
        // Cap at 10
        if (importance >= 10) {
          return 10;
        }
      }
    }
    
    // Adjust based on content length (longer content might be more detailed)
    if (content.length > 500) importance += 1;
    if (content.length < 20) importance -= 1;
    
    // Ensure importance is between 1 and 10
    return Math.max(1, Math.min(10, importance));
  }
}