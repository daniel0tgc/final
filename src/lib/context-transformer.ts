// Lightweight Context Transformation System for Enhanced Agent Processing
import { MemoryEntry } from "./agent-memory";
import { VectorEntry } from "./shared-vector-db";

export interface TransformationRule {
  id: string;
  name: string;
  description: string;
  condition: (content: string, metadata?: Record<string, any>) => boolean;
  transform: (content: string, metadata?: Record<string, any>) => TransformedContent;
  priority: number;
}

export interface TransformedContent {
  content: string;
  metadata: Record<string, any>;
  confidence: number;
  transformationType: string;
}

export interface ContextChunk {
  id: string;
  content: string;
  tokens: number;
  importance: number;
  source: "memory" | "vector" | "conversation" | "system";
  transformations: string[];
  metadata: Record<string, any>;
}

export class ContextTransformer {
  private static transformationRules: TransformationRule[] = [];
  private static initialized = false;

  /**
   * Initialize the context transformer with built-in rules
   */
  static init() {
    if (this.initialized) return;

    this.addBuiltInRules();
    this.initialized = true;
  }

  /**
   * Add built-in transformation rules
   */
  private static addBuiltInRules() {
    // Rule 1: Code Context Extraction
    this.addRule({
      id: "code_extraction",
      name: "Code Context Extraction",
      description: "Extract and format code snippets for better context",
      condition: (content) => {
        return /```[\s\S]*?```|`[^`]+`|function\s+\w+|class\s+\w+|import\s+/.test(content);
      },
      transform: (content) => {
        const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
        const inlineCode = content.match(/`[^`]+`/g) || [];
        
        let transformedContent = content;
        const extractedCode: string[] = [];

        // Process code blocks
        codeBlocks.forEach((block, index) => {
          const cleanBlock = block.replace(/```(\w+)?\n?/g, '').replace(/```/g, '');
          extractedCode.push(`[CODE_BLOCK_${index}]: ${cleanBlock.trim()}`);
          transformedContent = transformedContent.replace(block, `[CODE_BLOCK_${index}]`);
        });

        // Process inline code
        inlineCode.forEach((code, index) => {
          const cleanCode = code.replace(/`/g, '');
          extractedCode.push(`[INLINE_CODE_${index}]: ${cleanCode}`);
          transformedContent = transformedContent.replace(code, `[INLINE_CODE_${index}]`);
        });

        return {
          content: transformedContent + (extractedCode.length > 0 ? '\\n\\n' + extractedCode.join('\\n') : ''),
          metadata: { 
            hasCode: true, 
            codeBlocks: codeBlocks.length, 
            inlineCode: inlineCode.length 
          },
          confidence: 0.9,
          transformationType: "code_extraction"
        };
      },
      priority: 8
    });

    // Rule 2: Error Context Enhancement
    this.addRule({
      id: "error_enhancement",
      name: "Error Context Enhancement", 
      description: "Enhance error messages with context and solutions",
      condition: (content) => {
        const errorPatterns = /error|failed|exception|timeout|crash|fatal|broken/i;
        return errorPatterns.test(content);
      },
      transform: (content) => {
        const errorKeywords = content.match(/\b(error|failed|exception|timeout|crash|fatal|broken)\b/gi) || [];
        const severity = errorKeywords.length > 2 ? "HIGH" : errorKeywords.length > 1 ? "MEDIUM" : "LOW";
        
        const transformedContent = `[ERROR_CONTEXT: ${severity}] ${content}`;
        
        return {
          content: transformedContent,
          metadata: { 
            isError: true, 
            severity, 
            errorKeywords: errorKeywords.length 
          },
          confidence: 0.85,
          transformationType: "error_enhancement"
        };
      },
      priority: 9
    });

    // Rule 3: Question Context Processing
    this.addRule({
      id: "question_processing",
      name: "Question Context Processing",
      description: "Identify and prioritize questions for better response generation",
      condition: (content) => {
        return /\?|how|what|why|when|where|which|who/i.test(content);
      },
      transform: (content) => {
        const questions = content.match(/[^.!]*\?/g) || [];
        const questionWords = content.match(/\b(how|what|why|when|where|which|who)\b/gi) || [];
        
        const transformedContent = questions.length > 0 
          ? `[QUESTIONS: ${questions.length}] ${content}` 
          : `[INQUIRY: ${questionWords.length}] ${content}`;
        
        return {
          content: transformedContent,
          metadata: { 
            hasQuestions: questions.length > 0,
            questionCount: questions.length,
            inquiryWords: questionWords.length
          },
          confidence: 0.8,
          transformationType: "question_processing"
        };
      },
      priority: 7
    });

    // Rule 4: Temporal Context Extraction
    this.addRule({
      id: "temporal_extraction",
      name: "Temporal Context Extraction",
      description: "Extract and highlight temporal information",
      condition: (content) => {
        const timePatterns = /\b(today|tomorrow|yesterday|now|later|soon|before|after|during|while|when|since|until)\b/i;
        const datePatterns = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;
        return timePatterns.test(content) || datePatterns.test(content);
      },
      transform: (content) => {
        const timeWords = content.match(/\b(today|tomorrow|yesterday|now|later|soon|before|after|during|while|when|since|until)\b/gi) || [];
        const dates = content.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi) || [];
        
        const transformedContent = `[TEMPORAL: ${timeWords.length + dates.length}] ${content}`;
        
        return {
          content: transformedContent,
          metadata: { 
            hasTemporal: true,
            timeWords: timeWords.length,
            dates: dates.length
          },
          confidence: 0.75,
          transformationType: "temporal_extraction"
        };
      },
      priority: 6
    });

    // Rule 5: Collaboration Context
    this.addRule({
      id: "collaboration_context",
      name: "Collaboration Context Processing",
      description: "Enhance agent-to-agent communication context",
      condition: (content, metadata) => {
        const collabPatterns = /agent|collaborate|together|share|team|coordinate|discuss/i;
        return collabPatterns.test(content) || metadata?.isA2A || metadata?.fromAgent;
      },
      transform: (content, metadata) => {
        const collabWords = content.match(/\b(agent|collaborate|together|share|team|coordinate|discuss)\b/gi) || [];
        const sourceAgent = metadata?.fromAgent || metadata?.sourceAgentId;
        
        let transformedContent = `[COLLABORATION: ${collabWords.length}] ${content}`;
        if (sourceAgent) {
          transformedContent = `[FROM_AGENT: ${sourceAgent}] ${transformedContent}`;
        }
        
        return {
          content: transformedContent,
          metadata: { 
            isCollaborative: true,
            collabWords: collabWords.length,
            sourceAgent
          },
          confidence: 0.85,
          transformationType: "collaboration_context"
        };
      },
      priority: 8
    });

    // Rule 6: Priority Context Enhancement
    this.addRule({
      id: "priority_enhancement",
      name: "Priority Context Enhancement",
      description: "Identify and highlight high-priority content",
      condition: (content) => {
        const priorityPatterns = /urgent|critical|important|priority|asap|immediate|deadline|must|required/i;
        return priorityPatterns.test(content);
      },
      transform: (content) => {
        const priorityWords = content.match(/\b(urgent|critical|important|priority|asap|immediate|deadline|must|required)\b/gi) || [];
        const priority = priorityWords.some(word => ['urgent', 'critical', 'asap', 'immediate'].includes(word.toLowerCase())) 
          ? "HIGH" : "MEDIUM";
        
        const transformedContent = `[PRIORITY: ${priority}] ${content}`;
        
        return {
          content: transformedContent,
          metadata: { 
            hasPriority: true,
            priority,
            priorityWords: priorityWords.length
          },
          confidence: 0.9,
          transformationType: "priority_enhancement"
        };
      },
      priority: 10
    });
  }

  /**
   * Add a custom transformation rule
   */
  static addRule(rule: TransformationRule) {
    this.transformationRules.push(rule);
    // Sort by priority (higher priority first)
    this.transformationRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Transform a single piece of content using applicable rules
   */
  static transformContent(content: string, metadata: Record<string, any> = {}): TransformedContent[] {
    this.init();
    
    const transformations: TransformedContent[] = [];
    const applicableRules = this.transformationRules.filter(rule => 
      rule.condition(content, metadata)
    );

    for (const rule of applicableRules) {
      try {
        const transformed = rule.transform(content, metadata);
        transformations.push(transformed);
      } catch (error) {
        console.warn(`Transformation rule ${rule.id} failed:`, error);
      }
    }

    // If no transformations apply, return original content
    if (transformations.length === 0) {
      transformations.push({
        content,
        metadata,
        confidence: 1.0,
        transformationType: "original"
      });
    }

    return transformations;
  }

  /**
   * Transform memory entries for better context processing
   */
  static transformMemories(memories: MemoryEntry[]): ContextChunk[] {
    this.init();
    
    return memories.map(memory => {
      const transformations = this.transformContent(memory.content, {
        type: memory.type,
        importance: memory.importance,
        timestamp: memory.timestamp,
        agentId: memory.agentId,
        ...memory.metadata
      });

      // Use the best transformation (highest confidence)
      const bestTransformation = transformations.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

      return {
        id: memory.id,
        content: bestTransformation.content,
        tokens: this.estimateTokens(bestTransformation.content),
        importance: memory.importance + (bestTransformation.confidence - 1) * 2, // Boost importance for good transformations
        source: "memory" as const,
        transformations: transformations.map(t => t.transformationType),
        metadata: {
          ...memory.metadata,
          ...bestTransformation.metadata,
          originalContent: memory.content,
          transformationConfidence: bestTransformation.confidence
        }
      };
    });
  }

  /**
   * Transform vector entries for better context processing
   */
  static transformVectorEntries(entries: VectorEntry[]): ContextChunk[] {
    this.init();
    
    return entries.map(entry => {
      const transformations = this.transformContent(entry.content, {
        type: entry.type,
        importance: entry.importance,
        keywords: entry.keywords,
        agentId: entry.agentId,
        ...entry.metadata
      });

      const bestTransformation = transformations.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

      return {
        id: entry.id,
        content: bestTransformation.content,
        tokens: this.estimateTokens(bestTransformation.content),
        importance: entry.importance + (bestTransformation.confidence - 1) * 2,
        source: "vector" as const,
        transformations: transformations.map(t => t.transformationType),
        metadata: {
          ...entry.metadata,
          ...bestTransformation.metadata,
          originalContent: entry.content,
          transformationConfidence: bestTransformation.confidence
        }
      };
    });
  }

  /**
   * Intelligently chunk large context while preserving meaning
   */
  static intelligentChunking(content: string, maxTokens: number): ContextChunk[] {
    this.init();
    
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: ContextChunk[] = [];
    let currentChunk = "";
    let currentTokens = 0;
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);
      
      if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
        // Create chunk from current content
        const transformations = this.transformContent(currentChunk.trim());
        const bestTransformation = transformations.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );

        chunks.push({
          id: `chunk_${chunkIndex}`,
          content: bestTransformation.content,
          tokens: currentTokens,
          importance: this.assessChunkImportance(currentChunk),
          source: "system",
          transformations: transformations.map(t => t.transformationType),
          metadata: {
            chunkIndex,
            originalLength: currentChunk.length,
            transformationConfidence: bestTransformation.confidence
          }
        });

        chunkIndex++;
        currentChunk = sentence;
        currentTokens = sentenceTokens;
      } else {
        currentChunk += (currentChunk ? ". " : "") + sentence;
        currentTokens += sentenceTokens;
      }
    }

    // Add final chunk if any content remains
    if (currentChunk.trim().length > 0) {
      const transformations = this.transformContent(currentChunk.trim());
      const bestTransformation = transformations.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

      chunks.push({
        id: `chunk_${chunkIndex}`,
        content: bestTransformation.content,
        tokens: currentTokens,
        importance: this.assessChunkImportance(currentChunk),
        source: "system",
        transformations: transformations.map(t => t.transformationType),
        metadata: {
          chunkIndex,
          originalLength: currentChunk.length,
          transformationConfidence: bestTransformation.confidence
        }
      });
    }

    return chunks;
  }

  /**
   * Optimize context chunks for maximum relevance within token limits
   */
  static optimizeContextChunks(chunks: ContextChunk[], maxTokens: number): ContextChunk[] {
    // Sort by importance and transformation confidence
    const sortedChunks = chunks.sort((a, b) => {
      const scoreA = a.importance * (a.metadata?.transformationConfidence || 1);
      const scoreB = b.importance * (b.metadata?.transformationConfidence || 1);
      return scoreB - scoreA;
    });

    const optimizedChunks: ContextChunk[] = [];
    let totalTokens = 0;

    for (const chunk of sortedChunks) {
      if (totalTokens + chunk.tokens <= maxTokens) {
        optimizedChunks.push(chunk);
        totalTokens += chunk.tokens;
      } else if (totalTokens < maxTokens * 0.8) {
        // Try to compress the chunk if we have room
        const compressedContent = this.compressChunk(chunk, maxTokens - totalTokens);
        if (compressedContent) {
          optimizedChunks.push({
            ...chunk,
            content: compressedContent,
            tokens: maxTokens - totalTokens,
            metadata: {
              ...chunk.metadata,
              compressed: true
            }
          });
          break;
        }
      }
    }

    return optimizedChunks;
  }

  /**
   * Assess the importance of a text chunk
   */
  private static assessChunkImportance(content: string): number {
    let importance = 5; // Base importance

    // Length factor
    if (content.length > 500) importance += 1;
    if (content.length > 1000) importance += 1;

    // Keyword factors
    const importantPatterns = [
      /\b(error|failed|critical|urgent|important)\b/i,
      /\b(solution|fix|resolve|answer)\b/i,
      /\b(task|goal|objective|requirement)\b/i,
      /\?|\bhow\b|\bwhat\b|\bwhy\b/i
    ];

    for (const pattern of importantPatterns) {
      if (pattern.test(content)) {
        importance += 1;
      }
    }

    return Math.min(10, importance);
  }

  /**
   * Compress a chunk to fit within token limits
   */
  private static compressChunk(chunk: ContextChunk, maxTokens: number): string | null {
    if (chunk.tokens <= maxTokens) return chunk.content;

    const sentences = chunk.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const targetRatio = maxTokens / chunk.tokens;
    const targetSentences = Math.floor(sentences.length * targetRatio);

    if (targetSentences < 1) return null;

    const compressedSentences = sentences.slice(0, targetSentences);
    const compressed = compressedSentences.join('. ') + '...';

    return this.estimateTokens(compressed) <= maxTokens ? compressed : null;
  }

  /**
   * Get transformation statistics
   */
  static getTransformationStats(): Record<string, any> {
    return {
      ruleCount: this.transformationRules.length,
      rules: this.transformationRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        priority: rule.priority
      })),
      initialized: this.initialized
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}