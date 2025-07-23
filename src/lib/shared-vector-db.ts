// Enhanced vector database with semantic search and context management
export interface VectorEntry {
  id: string;
  type: "agent_profile" | "agent_action" | "context_chunk" | "memory_summary" | "conversation_summary";
  agentId: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[]; // For future real embedding integration
  importance: number;
  timestamp: string;
  keywords: string[];
}

export class SharedVectorDB {
  static vectorStore: VectorEntry[] = [];
  static contextWindow = 4000; // Default context window size
  static maxEntries = 1000; // Maximum entries to prevent memory overflow

  // Enhanced agent profile embedding with keyword extraction
  static embedAgentProfile(agent: any) {
    const content = `${agent.config.name} - ${agent.config.description || 'No description'}`;
    const keywords = this.extractKeywords(content);
    
    const entry: VectorEntry = {
      id: `profile_${agent.id}_${Date.now()}`,
      type: "agent_profile",
      agentId: agent.id,
      content,
      metadata: {
        name: agent.config.name,
        description: agent.config.description,
        type: agent.config.type,
        status: agent.status,
        data: agent,
      },
      importance: 8,
      timestamp: new Date().toISOString(),
      keywords,
    };
    
    this.addEntry(entry);
  }

  // Enhanced agent action embedding with context preservation
  static embedAgentAction(agentId: string, action: string, result: string) {
    const content = `Action: ${action}\nResult: ${result}`;
    const keywords = this.extractKeywords(content);
    
    const entry: VectorEntry = {
      id: `action_${agentId}_${Date.now()}`,
      type: "agent_action",
      agentId,
      content,
      metadata: {
        action,
        result,
        success: !result.toLowerCase().includes('error'),
      },
      importance: this.assessActionImportance(action, result),
      timestamp: new Date().toISOString(),
      keywords,
    };
    
    this.addEntry(entry);
  }

  // New: Embed context chunks for better retrieval
  static embedContextChunk(agentId: string, content: string, metadata: Record<string, any> = {}) {
    const keywords = this.extractKeywords(content);
    
    const entry: VectorEntry = {
      id: `context_${agentId}_${Date.now()}`,
      type: "context_chunk",
      agentId,
      content,
      metadata,
      importance: metadata.importance || 6,
      timestamp: new Date().toISOString(),
      keywords,
    };
    
    this.addEntry(entry);
  }

  // New: Store conversation summaries for context compression
  static embedConversationSummary(agentId: string, summary: string, messageCount: number) {
    const keywords = this.extractKeywords(summary);
    
    const entry: VectorEntry = {
      id: `conversation_${agentId}_${Date.now()}`,
      type: "conversation_summary",
      agentId,
      content: summary,
      metadata: {
        messageCount,
        summaryType: 'conversation',
      },
      importance: 7,
      timestamp: new Date().toISOString(),
      keywords,
    };
    
    this.addEntry(entry);
  }

  // Enhanced semantic query with multiple ranking factors
  static query(query: string, agentId?: string, limit: number = 10): VectorEntry[] {
    const queryKeywords = this.extractKeywords(query.toLowerCase());
    
    let results = this.vectorStore
      .filter(entry => !agentId || entry.agentId === agentId)
      .map(entry => ({
        entry,
        score: this.calculateRelevanceScore(entry, query, queryKeywords)
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(result => result.entry);
    
    return results;
  }

  // New: Get contextually relevant entries for building agent context
  static getContextualEntries(agentId: string, query: string, maxTokens: number = 2000): VectorEntry[] {
    const relevantEntries = this.query(query, agentId, 20);
    const contextEntries: VectorEntry[] = [];
    let tokenCount = 0;
    
    for (const entry of relevantEntries) {
      const entryTokens = this.estimateTokens(entry.content);
      if (tokenCount + entryTokens <= maxTokens) {
        contextEntries.push(entry);
        tokenCount += entryTokens;
      } else {
        break;
      }
    }
    
    return contextEntries;
  }

  // New: Build optimized context string within token limits
  static buildOptimizedContext(agentId: string, query: string, maxTokens: number = 2000): string {
    const entries = this.getContextualEntries(agentId, query, maxTokens);
    
    if (entries.length === 0) {
      return "";
    }
    
    const contextSections: string[] = [];
    
    // Group by type for better organization
    const groupedEntries = entries.reduce((groups, entry) => {
      if (!groups[entry.type]) groups[entry.type] = [];
      groups[entry.type].push(entry);
      return groups;
    }, {} as Record<string, VectorEntry[]>);
    
    // Add sections in order of importance
    const typeOrder: Array<keyof typeof groupedEntries> = [
      'conversation_summary',
      'agent_profile', 
      'memory_summary',
      'agent_action',
      'context_chunk'
    ];
    
    for (const type of typeOrder) {
      if (groupedEntries[type]) {
        contextSections.push(`\n## ${this.formatTypeName(type)}:`);
        groupedEntries[type].forEach(entry => {
          contextSections.push(`- ${entry.content}`);
        });
      }
    }
    
    return contextSections.join('\n');
  }

  // Enhanced keyword extraction with NLP-style processing
  private static extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those']);
    
    return text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit to top 10 keywords
  }

  // Calculate relevance score based on multiple factors
  private static calculateRelevanceScore(entry: VectorEntry, query: string, queryKeywords: string[]): number {
    let score = 0;
    const content = entry.content.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Exact query match (highest weight)
    if (content.includes(queryLower)) {
      score += 10;
    }
    
    // Keyword matches
    const keywordMatches = entry.keywords.filter(keyword => 
      queryKeywords.includes(keyword)
    ).length;
    score += keywordMatches * 3;
    
    // Importance factor
    score += entry.importance * 0.5;
    
    // Recency factor (newer entries get slight boost)
    const age = Date.now() - new Date(entry.timestamp).getTime();
    const daysSinceCreation = age / (1000 * 60 * 60 * 24);
    score += Math.max(0, 2 - daysSinceCreation * 0.1);
    
    // Type-based scoring
    const typeWeights = {
      'conversation_summary': 1.2,
      'agent_profile': 1.0,
      'memory_summary': 1.1,
      'agent_action': 0.9,
      'context_chunk': 0.8,
    };
    score *= typeWeights[entry.type] || 1.0;
    
    return score;
  }

  // Assess importance of actions for better ranking
  private static assessActionImportance(action: string, result: string): number {
    let importance = 6; // Base importance
    
    const actionLower = action.toLowerCase();
    const resultLower = result.toLowerCase();
    
    // High importance actions
    if (actionLower.includes('send_message') || actionLower.includes('collaboration')) {
      importance += 2;
    }
    
    // Error or failure reduces importance
    if (resultLower.includes('error') || resultLower.includes('failed')) {
      importance -= 1;
    }
    
    // Success increases importance
    if (resultLower.includes('success') || resultLower.includes('completed')) {
      importance += 1;
    }
    
    return Math.max(1, Math.min(10, importance));
  }

  // Estimate token count (rough approximation)
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough estimate: 4 characters per token
  }

  // Format type names for display
  private static formatTypeName(type: string): string {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  // Add entry with overflow protection
  private static addEntry(entry: VectorEntry) {
    this.vectorStore.push(entry);
    
    // Implement LRU-style cleanup if we exceed max entries
    if (this.vectorStore.length > this.maxEntries) {
      // Sort by importance and recency, remove least important old entries
      this.vectorStore.sort((a, b) => {
        const scoreA = a.importance + (Date.now() - new Date(a.timestamp).getTime()) / (1000 * 60 * 60 * 24) * -0.1;
        const scoreB = b.importance + (Date.now() - new Date(b.timestamp).getTime()) / (1000 * 60 * 60 * 24) * -0.1;
        return scoreB - scoreA;
      });
      
      // Keep only the top entries
      this.vectorStore = this.vectorStore.slice(0, Math.floor(this.maxEntries * 0.8));
    }
  }

  // Clear entries for specific agent (for cleanup)
  static clearAgentEntries(agentId: string) {
    this.vectorStore = this.vectorStore.filter(entry => entry.agentId !== agentId);
  }

  // Get statistics for monitoring
  static getStats() {
    const stats = {
      totalEntries: this.vectorStore.length,
      byType: {} as Record<string, number>,
      byAgent: {} as Record<string, number>,
      averageImportance: 0,
    };
    
    let totalImportance = 0;
    
    for (const entry of this.vectorStore) {
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
      stats.byAgent[entry.agentId] = (stats.byAgent[entry.agentId] || 0) + 1;
      totalImportance += entry.importance;
    }
    
    stats.averageImportance = this.vectorStore.length > 0 ? totalImportance / this.vectorStore.length : 0;
    
    return stats;
  }
}