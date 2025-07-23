// Enhanced Context Window Management System
import { AgentMemory, MemoryEntry } from "./agent-memory";
import { SharedVectorDB, VectorEntry } from "./shared-vector-db";

export interface ContextWindow {
  totalTokens: number;
  maxTokens: number;
  sections: ContextSection[];
  overflow: boolean;
}

export interface ContextSection {
  type: "system" | "memory" | "conversation" | "task";
  content: string;
  tokens: number;
  importance: number;
  compressed: boolean;
}

export class ContextManager {
  private static readonly DEFAULT_MAX_TOKENS = 4000;
  private static readonly COMPRESSION_THRESHOLD = 0.8; // Compress when 80% full
  private static readonly PRIORITY_WEIGHTS = {
    system: 1.0,
    task: 0.9,
    memory: 0.8,
    conversation: 0.7,
  };

  /**
   * Build optimized context window for an agent
   */
  static async buildContextWindow(
    agentId: string,
    currentMessage: string,
    maxTokens: number = this.DEFAULT_MAX_TOKENS
  ): Promise<ContextWindow> {
    const contextWindow: ContextWindow = {
      totalTokens: 0,
      maxTokens,
      sections: [],
      overflow: false,
    };

    // 1. Always include system context (highest priority)
    await this.addSystemContext(agentId, contextWindow);

    // 2. Add current task context
    await this.addTaskContext(agentId, currentMessage, contextWindow);

    // 3. Add relevant memories based on semantic similarity
    await this.addMemoryContext(agentId, currentMessage, contextWindow);

    // 4. Add conversation history (lowest priority)
    await this.addConversationContext(agentId, contextWindow);

    // 5. Compress if necessary
    if (contextWindow.totalTokens > maxTokens * this.COMPRESSION_THRESHOLD) {
      await this.compressContext(contextWindow);
    }

    return contextWindow;
  }

  /**
   * Add system context (agent identity and core instructions)
   */
  private static async addSystemContext(
    agentId: string,
    contextWindow: ContextWindow
  ): Promise<void> {
    const baseContext = await AgentMemory.getFact(agentId, "base_context");
    if (baseContext) {
      const tokens = this.estimateTokens(baseContext);
      contextWindow.sections.push({
        type: "system",
        content: baseContext,
        tokens,
        importance: 10,
        compressed: false,
      });
      contextWindow.totalTokens += tokens;
    }
  }

  /**
   * Add task-specific context using vector similarity
   */
  private static async addTaskContext(
    agentId: string,
    currentMessage: string,
    contextWindow: ContextWindow
  ): Promise<void> {
    const remainingTokens = contextWindow.maxTokens - contextWindow.totalTokens;
    const taskBudget = Math.floor(remainingTokens * 0.3); // 30% for task context

    const relevantEntries = SharedVectorDB.getContextualEntries(
      agentId,
      currentMessage,
      taskBudget
    );

    if (relevantEntries.length > 0) {
      const taskContent = this.formatVectorEntries(relevantEntries);
      const tokens = this.estimateTokens(taskContent);
      
      contextWindow.sections.push({
        type: "task",
        content: taskContent,
        tokens,
        importance: 9,
        compressed: false,
      });
      contextWindow.totalTokens += tokens;
    }
  }

  /**
   * Add memory context using importance and relevance scoring
   */
  private static async addMemoryContext(
    agentId: string,
    currentMessage: string,
    contextWindow: ContextWindow
  ): Promise<void> {
    const remainingTokens = contextWindow.maxTokens - contextWindow.totalTokens;
    const memoryBudget = Math.floor(remainingTokens * 0.4); // 40% for memory context

    // Get most important memories
    const importantMemories = await AgentMemory.getImportantMemories(agentId, 10);
    
    // Get memories relevant to current message
    const relevantMemories = await AgentMemory.searchMemories(agentId, currentMessage);
    
    // Combine and deduplicate
    const allMemories = this.deduplicateMemories([...importantMemories, ...relevantMemories]);
    
    // Sort by combined importance and relevance score
    const scoredMemories = allMemories
      .map(memory => ({
        memory,
        score: this.calculateMemoryRelevanceScore(memory, currentMessage)
      }))
      .sort((a, b) => b.score - a.score);

    // Build memory context within budget
    const memoryContent: string[] = [];
    let memoryTokens = 0;

    for (const { memory } of scoredMemories) {
      const memoryText = `[${memory.type}] ${memory.content}`;
      const tokens = this.estimateTokens(memoryText);
      
      if (memoryTokens + tokens <= memoryBudget) {
        memoryContent.push(memoryText);
        memoryTokens += tokens;
      } else {
        break;
      }
    }

    if (memoryContent.length > 0) {
      const content = `## Relevant Memories:\n${memoryContent.join('\n')}`;
      contextWindow.sections.push({
        type: "memory",
        content,
        tokens: memoryTokens,
        importance: 8,
        compressed: false,
      });
      contextWindow.totalTokens += memoryTokens;
    }
  }

  /**
   * Add conversation history context
   */
  private static async addConversationContext(
    agentId: string,
    contextWindow: ContextWindow
  ): Promise<void> {
    // Import dynamically to avoid circular dependency
    const { AgentExecution } = await import("./agent-execution");
    
    const remainingTokens = contextWindow.maxTokens - contextWindow.totalTokens;
    const conversationBudget = Math.floor(remainingTokens * 0.8); // Use most of remaining budget

    const conversation = await AgentExecution.getConversation(agentId);
    const recentMessages = conversation.messages.slice(-10); // Last 10 messages

    const conversationContent: string[] = [];
    let conversationTokens = 0;

    // Add messages from most recent, staying within budget
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const message = recentMessages[i];
      const messageText = `${message.role}: ${message.content}`;
      const tokens = this.estimateTokens(messageText);
      
      if (conversationTokens + tokens <= conversationBudget) {
        conversationContent.unshift(messageText);
        conversationTokens += tokens;
      } else {
        break;
      }
    }

    if (conversationContent.length > 0) {
      const content = `## Recent Conversation:\n${conversationContent.join('\n')}`;
      contextWindow.sections.push({
        type: "conversation",
        content,
        tokens: conversationTokens,
        importance: 7,
        compressed: false,
      });
      contextWindow.totalTokens += conversationTokens;
    }
  }

  /**
   * Compress context when approaching token limits
   */
  private static async compressContext(contextWindow: ContextWindow): Promise<void> {
    if (contextWindow.totalTokens <= contextWindow.maxTokens) {
      return;
    }

    // Sort sections by priority (importance * type weight)
    const prioritizedSections = contextWindow.sections
      .map(section => ({
        section,
        priority: section.importance * (this.PRIORITY_WEIGHTS[section.type] || 0.5)
      }))
      .sort((a, b) => b.priority - a.priority);

    // Keep essential sections, compress or remove others
    contextWindow.sections = [];
    contextWindow.totalTokens = 0;
    contextWindow.overflow = true;

    for (const { section } of prioritizedSections) {
      const remainingBudget = contextWindow.maxTokens - contextWindow.totalTokens;
      
      if (section.tokens <= remainingBudget) {
        // Section fits, keep as-is
        contextWindow.sections.push(section);
        contextWindow.totalTokens += section.tokens;
      } else if (remainingBudget > 100 && section.type !== "system") {
        // Try to compress the section
        const compressedContent = this.compressContent(section.content, remainingBudget);
        const compressedTokens = this.estimateTokens(compressedContent);
        
        if (compressedTokens < section.tokens) {
          contextWindow.sections.push({
            ...section,
            content: compressedContent,
            tokens: compressedTokens,
            compressed: true,
          });
          contextWindow.totalTokens += compressedTokens;
        }
      }
      // If section doesn't fit and can't be compressed, skip it
    }
  }

  /**
   * Compress content by summarizing and removing less important details
   */
  private static compressContent(content: string, targetTokens: number): string {
    const lines = content.split('\n');
    const targetRatio = Math.min(0.7, targetTokens / this.estimateTokens(content));
    const targetLines = Math.floor(lines.length * targetRatio);
    
    if (targetLines >= lines.length) {
      return content;
    }

    // Keep headers and important lines, summarize the rest
    const compressed: string[] = [];
    let includedLines = 0;

    for (const line of lines) {
      if (includedLines >= targetLines) {
        break;
      }

      // Always keep headers and important indicators
      if (line.startsWith('#') || line.includes('IMPORTANT') || line.includes('ERROR')) {
        compressed.push(line);
        includedLines++;
      } else if (includedLines < targetLines) {
        compressed.push(line);
        includedLines++;
      }
    }

    if (compressed.length < lines.length) {
      compressed.push(`... [${lines.length - compressed.length} lines compressed] ...`);
    }

    return compressed.join('\n');
  }

  /**
   * Calculate relevance score for memory entries
   */
  private static calculateMemoryRelevanceScore(memory: MemoryEntry, query: string): number {
    let score = memory.importance; // Base score is importance

    const queryLower = query.toLowerCase();
    const contentLower = memory.content.toLowerCase();

    // Exact match bonus
    if (contentLower.includes(queryLower)) {
      score += 5;
    }

    // Keyword overlap bonus
    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    const matchingWords = queryWords.filter(word => contentLower.includes(word)).length;
    score += matchingWords * 2;

    // Recent memory bonus
    const age = Date.now() - new Date(memory.timestamp).getTime();
    const hoursSinceCreation = age / (1000 * 60 * 60);
    if (hoursSinceCreation < 24) {
      score += 2; // Recent memories get bonus
    }

    // Type-based scoring
    const typeWeights = {
      'user_message': 1.0,
      'reflection': 1.2,
      'system': 0.8,
      'observation': 0.9,
      'agent_response': 0.7,
      'message_received': 1.1,
    };
    score *= typeWeights[memory.type as keyof typeof typeWeights] || 1.0;

    return score;
  }

  /**
   * Remove duplicate memories based on content similarity
   */
  private static deduplicateMemories(memories: MemoryEntry[]): MemoryEntry[] {
    const unique: MemoryEntry[] = [];
    const seen = new Set<string>();

    for (const memory of memories) {
      // Create a normalized version for comparison
      const normalized = memory.content.toLowerCase().replace(/\s+/g, ' ').trim();
      const shortContent = normalized.substring(0, 100); // Compare first 100 chars
      
      if (!seen.has(shortContent)) {
        seen.add(shortContent);
        unique.push(memory);
      }
    }

    return unique;
  }

  /**
   * Format vector entries for context display
   */
  private static formatVectorEntries(entries: VectorEntry[]): string {
    const sections: string[] = [];
    
    const grouped = entries.reduce((groups, entry) => {
      if (!groups[entry.type]) groups[entry.type] = [];
      groups[entry.type].push(entry);
      return groups;
    }, {} as Record<string, VectorEntry[]>);

    for (const [type, typeEntries] of Object.entries(grouped)) {
      const typeName = type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      sections.push(`### ${typeName}:`);
      typeEntries.forEach(entry => {
        sections.push(`- ${entry.content}`);
      });
    }

    return sections.join('\n');
  }

  /**
   * Estimate token count (rough approximation)
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough estimate: 4 characters per token
  }

  /**
   * Get context window utilization stats
   */
  static getContextStats(contextWindow: ContextWindow) {
    const utilization = (contextWindow.totalTokens / contextWindow.maxTokens) * 100;
    
    const sectionStats = contextWindow.sections.map(section => ({
      type: section.type,
      tokens: section.tokens,
      percentage: (section.tokens / contextWindow.totalTokens) * 100,
      compressed: section.compressed,
      importance: section.importance,
    }));

    return {
      utilization: Math.round(utilization * 100) / 100,
      totalTokens: contextWindow.totalTokens,
      maxTokens: contextWindow.maxTokens,
      overflow: contextWindow.overflow,
      sections: sectionStats,
    };
  }
}