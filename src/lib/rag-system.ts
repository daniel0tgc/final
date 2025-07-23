// Retrieval Augmented Generation (RAG) System for Enhanced Agent Memory
import { AgentMemory, MemoryEntry } from "./agent-memory";
import { SharedVectorDB, VectorEntry } from "./shared-vector-db";
import { ContextManager } from "./context-manager";
import { ContextTransformer, ContextChunk } from "./context-transformer";

export interface RAGQuery {
  query: string;
  agentId: string;
  contextType?: "task" | "conversation" | "knowledge" | "all";
  maxResults?: number;
  includeShared?: boolean;
}

export interface RAGResult {
  content: string;
  relevanceScore: number;
  source: "memory" | "vector" | "fact" | "shared";
  metadata: Record<string, any>;
  timestamp: string;
}

export interface RAGResponse {
  results: RAGResult[];
  contextSummary: string;
  confidence: number;
  totalSources: number;
}

export class RAGSystem {
  private static readonly MIN_RELEVANCE_THRESHOLD = 0.3;
  private static readonly MAX_CONTEXT_TOKENS = 2000;

  /**
   * Perform RAG query to retrieve relevant information for agent response generation
   */
  static async queryRelevantContext(ragQuery: RAGQuery): Promise<RAGResponse> {
    const {
      query,
      agentId,
      contextType = "all",
      maxResults = 20,
      includeShared = true
    } = ragQuery;

    const results: RAGResult[] = [];

    // 1. Query personal memories
    if (contextType === "all" || contextType === "conversation" || contextType === "knowledge") {
      const memoryResults = await this.queryMemories(agentId, query, maxResults);
      results.push(...memoryResults);
    }

    // 2. Query vector database
    if (contextType === "all" || contextType === "task" || contextType === "knowledge") {
      const vectorResults = await this.queryVectorDatabase(agentId, query, maxResults);
      results.push(...vectorResults);
    }

    // 3. Query long-term facts
    if (contextType === "all" || contextType === "knowledge") {
      const factResults = await this.queryLongTermFacts(agentId, query);
      results.push(...factResults);
    }

    // 4. Query shared knowledge if enabled
    if (includeShared && (contextType === "all" || contextType === "knowledge")) {
      const sharedResults = await this.querySharedKnowledge(agentId, query, maxResults);
      results.push(...sharedResults);
    }

    // 5. Rank and filter results
    const rankedResults = this.rankAndFilterResults(results, query);

    // 6. Generate context summary
    const contextSummary = await this.generateContextSummary(rankedResults, query);

    // 7. Calculate confidence score
    const confidence = this.calculateConfidenceScore(rankedResults, query);

    return {
      results: rankedResults.slice(0, maxResults),
      contextSummary,
      confidence,
      totalSources: rankedResults.length,
    };
  }

  /**
   * Query agent memories with semantic relevance scoring
   */
  private static async queryMemories(
    agentId: string,
    query: string,
    maxResults: number
  ): Promise<RAGResult[]> {
    const memories = await AgentMemory.searchMemories(agentId, query);
    const importantMemories = await AgentMemory.getImportantMemories(agentId, 10);
    
    // Combine and deduplicate
    const allMemories = this.deduplicateMemories([...memories, ...importantMemories]);
    
    return allMemories
      .map(memory => ({
        content: this.formatMemoryContent(memory),
        relevanceScore: this.calculateMemoryRelevance(memory, query),
        source: "memory" as const,
        metadata: {
          type: memory.type,
          importance: memory.importance,
          timestamp: memory.timestamp,
          id: memory.id,
        },
        timestamp: memory.timestamp,
      }))
      .filter(result => result.relevanceScore >= this.MIN_RELEVANCE_THRESHOLD)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  /**
   * Query vector database for contextual information
   */
  private static async queryVectorDatabase(
    agentId: string,
    query: string,
    maxResults: number
  ): Promise<RAGResult[]> {
    const vectorEntries = SharedVectorDB.query(query, agentId, maxResults);
    
    return vectorEntries
      .map(entry => ({
        content: entry.content,
        relevanceScore: this.calculateVectorRelevance(entry, query),
        source: "vector" as const,
        metadata: {
          type: entry.type,
          importance: entry.importance,
          keywords: entry.keywords,
          id: entry.id,
        },
        timestamp: entry.timestamp,
      }))
      .filter(result => result.relevanceScore >= this.MIN_RELEVANCE_THRESHOLD);
  }

  /**
   * Query long-term facts using keyword matching
   */
  private static async queryLongTermFacts(
    agentId: string,
    query: string
  ): Promise<RAGResult[]> {
    // This is a simplified implementation - in a real system you'd have indexed facts
    const queryKeywords = this.extractKeywords(query);
    const results: RAGResult[] = [];

    // Try to match common fact patterns
    const factPatterns = [
      'user_preferences',
      'task_patterns',
      'learned_solutions',
      'collaboration_history',
      'error_patterns',
      'success_patterns',
    ];

    for (const pattern of factPatterns) {
      if (queryKeywords.some(keyword => pattern.includes(keyword))) {
        try {
          const factValue = await AgentMemory.getFact(agentId, pattern);
          if (factValue) {
            results.push({
              content: factValue,
              relevanceScore: this.calculateFactRelevance(factValue, query),
              source: "fact",
              metadata: {
                factKey: pattern,
                type: "long_term_fact",
              },
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          // Ignore fact retrieval errors
        }
      }
    }

    return results.filter(result => result.relevanceScore >= this.MIN_RELEVANCE_THRESHOLD);
  }

  /**
   * Query shared knowledge from other agents
   */
  private static async querySharedKnowledge(
    agentId: string,
    query: string,
    maxResults: number
  ): Promise<RAGResult[]> {
    const sharedMemories = await AgentMemory.getSharedMemories(agentId);
    
    return sharedMemories
      .map(memory => ({
        content: this.formatSharedMemoryContent(memory),
        relevanceScore: this.calculateMemoryRelevance(memory, query),
        source: "shared" as const,
        metadata: {
          type: memory.type,
          sourceAgent: memory.sourceAgentId,
          importance: memory.importance,
          shared: true,
        },
        timestamp: memory.timestamp,
      }))
      .filter(result => result.relevanceScore >= this.MIN_RELEVANCE_THRESHOLD)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, Math.floor(maxResults / 2)); // Limit shared results
  }

  /**
   * Rank and filter results by relevance and diversity
   */
  private static rankAndFilterResults(results: RAGResult[], query: string): RAGResult[] {
    // Sort by relevance score
    const sorted = results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Ensure diversity by source type
    const diversified: RAGResult[] = [];
    const sourceCounters = { memory: 0, vector: 0, fact: 0, shared: 0 };
    const maxPerSource = 8;

    for (const result of sorted) {
      if (sourceCounters[result.source] < maxPerSource) {
        diversified.push(result);
        sourceCounters[result.source]++;
      }
    }

    // Remove near-duplicates
    return this.removeDuplicateResults(diversified);
  }

  /**
   * Generate a concise context summary from RAG results
   */
  private static async generateContextSummary(
    results: RAGResult[],
    query: string
  ): Promise<string> {
    if (results.length === 0) {
      return "No relevant context found for this query.";
    }

    const summaryParts: string[] = [];
    
    // Group by source type
    const bySource = results.reduce((groups, result) => {
      if (!groups[result.source]) groups[result.source] = [];
      groups[result.source].push(result);
      return groups;
    }, {} as Record<string, RAGResult[]>);

    // Summarize each source type
    for (const [source, sourceResults] of Object.entries(bySource)) {
      const count = sourceResults.length;
      const avgConfidence = sourceResults.reduce((sum, r) => sum + r.relevanceScore, 0) / count;
      
      summaryParts.push(`${count} relevant ${source} entries (avg relevance: ${(avgConfidence * 100).toFixed(1)}%)`);
    }

    const topResult = results[0];
    const summary = `Found ${results.length} relevant sources: ${summaryParts.join(', ')}. ` +
      `Most relevant: "${this.truncateContent(topResult.content, 100)}" ` +
      `(${(topResult.relevanceScore * 100).toFixed(1)}% relevance)`;

    return summary;
  }

  /**
   * Calculate overall confidence score for the RAG response
   */
  private static calculateConfidenceScore(results: RAGResult[], query: string): number {
    if (results.length === 0) return 0;

    const avgRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
    const diversityBonus = new Set(results.map(r => r.source)).size / 4; // Max 4 source types
    const volumeBonus = Math.min(results.length / 10, 1); // Bonus for having multiple sources

    const confidence = (avgRelevance * 0.6) + (diversityBonus * 0.2) + (volumeBonus * 0.2);
    return Math.min(confidence, 1);
  }

  /**
   * Format memory content for RAG results
   */
  private static formatMemoryContent(memory: MemoryEntry): string {
    const typeLabel = memory.type.replace('_', ' ').toUpperCase();
    return `[${typeLabel}] ${memory.content}`;
  }

  /**
   * Format shared memory content with source attribution
   */
  private static formatSharedMemoryContent(memory: MemoryEntry): string {
    const sourceInfo = memory.sourceAgentId ? ` (from Agent-${memory.sourceAgentId})` : '';
    const typeLabel = memory.type.replace('_', ' ').toUpperCase();
    return `[SHARED ${typeLabel}]${sourceInfo} ${memory.content}`;
  }

  /**
   * Calculate memory relevance score
   */
  private static calculateMemoryRelevance(memory: MemoryEntry, query: string): number {
    let score = 0;
    const content = memory.content.toLowerCase();
    const queryLower = query.toLowerCase();

    // Exact query match
    if (content.includes(queryLower)) {
      score += 0.5;
    }

    // Keyword matching
    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    const matchingWords = queryWords.filter(word => content.includes(word)).length;
    score += (matchingWords / queryWords.length) * 0.3;

    // Importance factor
    score += (memory.importance / 10) * 0.2;

    return Math.min(score, 1);
  }

  /**
   * Calculate vector entry relevance score
   */
  private static calculateVectorRelevance(entry: VectorEntry, query: string): number {
    let score = 0;
    const content = entry.content.toLowerCase();
    const queryLower = query.toLowerCase();

    // Exact query match
    if (content.includes(queryLower)) {
      score += 0.4;
    }

    // Keyword matching
    const queryKeywords = this.extractKeywords(query);
    const matchingKeywords = entry.keywords.filter(keyword => 
      queryKeywords.includes(keyword)
    ).length;
    
    if (queryKeywords.length > 0) {
      score += (matchingKeywords / queryKeywords.length) * 0.4;
    }

    // Importance factor
    score += (entry.importance / 10) * 0.2;

    return Math.min(score, 1);
  }

  /**
   * Calculate fact relevance score
   */
  private static calculateFactRelevance(fact: string, query: string): number {
    const factLower = fact.toLowerCase();
    const queryLower = query.toLowerCase();

    if (factLower.includes(queryLower)) {
      return 0.8;
    }

    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    const matchingWords = queryWords.filter(word => factLower.includes(word)).length;
    
    return (matchingWords / Math.max(queryWords.length, 1)) * 0.6;
  }

  /**
   * Remove duplicate memories based on content similarity
   */
  private static deduplicateMemories(memories: MemoryEntry[]): MemoryEntry[] {
    const unique: MemoryEntry[] = [];
    const seen = new Set<string>();

    for (const memory of memories) {
      const normalized = memory.content.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(memory);
      }
    }

    return unique;
  }

  /**
   * Remove duplicate RAG results based on content similarity
   */
  private static removeDuplicateResults(results: RAGResult[]): RAGResult[] {
    const unique: RAGResult[] = [];
    const seen = new Set<string>();

    for (const result of results) {
      const normalized = result.content.toLowerCase().replace(/\s+/g, ' ').trim();
      const shortContent = normalized.substring(0, 100);
      
      if (!seen.has(shortContent)) {
        seen.add(shortContent);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Extract keywords from text
   */
  private static extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10);
  }

  /**
   * Truncate content to specified length
   */
  private static truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength - 3) + '...';
  }

  /**
   * Create enhanced context for agent response generation with transformations
   */
  static async buildEnhancedContext(
    agentId: string,
    currentMessage: string,
    maxTokens: number = 3000
  ): Promise<string> {
    // Use RAG to gather relevant context
    const ragResponse = await this.queryRelevantContext({
      query: currentMessage,
      agentId,
      contextType: "all",
      maxResults: 15,
      includeShared: true,
    });

    // Use context manager to build optimized context window
    const contextWindow = await ContextManager.buildContextWindow(
      agentId,
      currentMessage,
      maxTokens
    );

    // Transform the current message for better processing
    const messageTransformations = ContextTransformer.transformContent(currentMessage, {
      isCurrentMessage: true,
      agentId
    });
    const bestMessageTransformation = messageTransformations.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    const contextParts: string[] = [];

    // Add transformed message context
    if (bestMessageTransformation.transformationType !== "original") {
      contextParts.push(`## Message Analysis:`);
      contextParts.push(`Current message has been identified as: ${bestMessageTransformation.transformationType}`);
      if (bestMessageTransformation.metadata.priority) {
        contextParts.push(`Priority Level: ${bestMessageTransformation.metadata.priority}`);
      }
      if (bestMessageTransformation.metadata.hasQuestions) {
        contextParts.push(`Contains ${bestMessageTransformation.metadata.questionCount || 0} questions`);
      }
      if (bestMessageTransformation.metadata.isError) {
        contextParts.push(`Detected error context with ${bestMessageTransformation.metadata.severity} severity`);
      }
    }

    // Add RAG context summary with transformation insights
    if (ragResponse.confidence > 0.3) {
      contextParts.push(`\n## Relevant Context (${(ragResponse.confidence * 100).toFixed(1)}% confidence):`);
      contextParts.push(ragResponse.contextSummary);
      
      // Transform and optimize top RAG results
      const topResults = ragResponse.results.slice(0, 8);
      if (topResults.length > 0) {
        // Convert RAG results to context chunks for transformation
        const contextChunks: ContextChunk[] = topResults.map((result, index) => ({
          id: `rag_${index}`,
          content: result.content,
          tokens: this.estimateTokens(result.content),
          importance: result.relevanceScore * 10,
          source: result.source === "fact" || result.source === "shared" ? "memory" : result.source,
          transformations: [],
          metadata: result.metadata
        }));

        // Apply transformations to chunks
        const transformedChunks = contextChunks.map(chunk => {
          const transformations = ContextTransformer.transformContent(chunk.content, chunk.metadata);
          const bestTransformation = transformations.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
          );
          
          return {
            ...chunk,
            content: bestTransformation.content,
            transformations: transformations.map(t => t.transformationType),
            metadata: {
              ...chunk.metadata,
              ...bestTransformation.metadata,
              transformationConfidence: bestTransformation.confidence
            }
          };
        });

        // Optimize chunks within remaining token budget
        const remainingTokens = maxTokens - this.estimateTokens(contextParts.join('\n'));
        const optimizedChunks = ContextTransformer.optimizeContextChunks(
          transformedChunks, 
          Math.max(remainingTokens * 0.4, 500)
        );

        if (optimizedChunks.length > 0) {
          contextParts.push("\n### Key Information (Enhanced):");
          optimizedChunks.forEach(chunk => {
            const transformationInfo = chunk.transformations.length > 1 
              ? ` [Transformed: ${chunk.transformations.join(', ')}]` 
              : '';
            contextParts.push(`- ${this.truncateContent(chunk.content, 200)}${transformationInfo}`);
          });
        }
      }
    }

    // Add context window sections with intelligent chunking
    const remainingTokens = maxTokens - this.estimateTokens(contextParts.join('\n'));
    contextWindow.sections.forEach(section => {
      if (this.estimateTokens(section.content) > remainingTokens * 0.1) {
        // Apply intelligent chunking for large sections
        const chunks = ContextTransformer.intelligentChunking(section.content, Math.floor(remainingTokens * 0.15));
        const optimizedChunks = ContextTransformer.optimizeContextChunks(chunks, Math.floor(remainingTokens * 0.15));
        
        if (optimizedChunks.length > 0) {
          contextParts.push(`\n## ${section.type.toUpperCase()} Context (Optimized):`);
          optimizedChunks.forEach((chunk, index) => {
            contextParts.push(`${chunk.content}${chunk.metadata?.compressed ? ' [Compressed]' : ''}`);
          });
        }
      } else {
        contextParts.push(`\n${section.content}`);
      }
    });

    // Add transformation statistics for monitoring
    const transformationStats = ContextTransformer.getTransformationStats();
    contextParts.push(`\n## Context Processing Stats:`);
    contextParts.push(`Applied ${transformationStats.ruleCount} transformation rules`);
    contextParts.push(`Total context tokens: ~${this.estimateTokens(contextParts.join('\n'))}`);

    return contextParts.join('\n');
  }

  /**
   * Estimate token count (rough approximation)
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough estimate: 4 characters per token
  }

  /**
   * Get RAG system statistics for monitoring
   */
  static async getRAGStats(agentId: string) {
    const memoryCount = (await AgentMemory.getMemories(agentId)).length;
    const vectorStats = SharedVectorDB.getStats();
    const transformationStats = ContextTransformer.getTransformationStats();
    
    return {
      personalMemories: memoryCount,
      sharedEntries: vectorStats.byAgent[agentId] || 0,
      totalVectorEntries: vectorStats.totalEntries,
      averageImportance: vectorStats.averageImportance,
      memoryTypes: vectorStats.byType,
      transformationRules: transformationStats.ruleCount,
      contextProcessingEnabled: transformationStats.initialized,
    };
  }
}