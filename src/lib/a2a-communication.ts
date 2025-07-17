import { v4 as uuidv4 } from 'uuid';
import { AgentMemory } from './agent-memory';

// Define the structure of agent-to-agent messages
export interface A2AMessage {
  id: string;
  sourceAgentId: string;
  sourceAgentName: string;
  targetAgentId: string;
  targetAgentName: string;
  message: string;
  timestamp: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
  metadata?: Record<string, any>;
}

// A2A Communication class
export class A2ACommunication {
  private static readonly STORAGE_KEY = 'a2a_messages';
  private static messages: A2AMessage[] = [];
  private static initialized = false;
  
  /**
   * Public method to initialize the A2A communication system
   */
  static init(): void {
    this.initialize();
  }
  
  /**
   * Initialize the A2A communication system
   */
  private static initialize(): void {
    if (this.initialized) return;
    
    try {
      // Load messages from localStorage
      const storedMessages = localStorage.getItem(this.STORAGE_KEY);
      if (storedMessages) {
        this.messages = JSON.parse(storedMessages);
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize A2A Communication:', error);
      // Initialize with empty array if there's an error
      this.messages = [];
      this.initialized = true;
    }
  }
  
  /**
   * Save messages to localStorage
   */
  private static saveMessages(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.messages));
    } catch (error) {
      console.error('Failed to save A2A messages:', error);
    }
  }
  
  /**
   * Send a message from one agent to another
   */
  static async sendMessage(
    sourceAgentId: string,
    sourceAgentName: string,
    targetAgentId: string,
    targetAgentName: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<A2AMessage> {
    this.initialize();
    
    // Create new message with pending status
    const newMessage: A2AMessage = {
      id: uuidv4(),
      sourceAgentId,
      sourceAgentName,
      targetAgentId,
      targetAgentName,
      message,
      timestamp: new Date().toISOString(),
      status: 'pending',
      metadata
    };
    
    // Add to messages array
    this.messages.push(newMessage);
    this.saveMessages();
    
    try {
      // Simulate message delivery (in a real implementation, this would be an API call or event)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 5% chance of random failure for demo purposes
      if (Math.random() < 0.05) {
        throw new Error('Communication channel error');
      }
      
      // Update message status to success
      const updatedMessage = { ...newMessage, status: 'success' as const };
      this.updateMessage(updatedMessage);
      
      // Add observation to target agent's memory
      AgentMemory.addMemory(targetAgentId, {
        type: 'message_received',
        content: `Received message from ${sourceAgentName}: ${message}`,
        importance: AgentMemory.assessImportance(message, 'message_received'),
        metadata: {
          sourceAgentId,
          sourceAgentName,
          messageId: newMessage.id
        }
      });
      
      return updatedMessage;
    } catch (error) {
      // Update message status to error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const updatedMessage = { 
        ...newMessage, 
        status: 'error' as const,
        error: errorMessage
      };
      this.updateMessage(updatedMessage);
      
      // Add failure observation to source agent's memory
      AgentMemory.addMemory(sourceAgentId, {
        type: 'observation',
        content: `Failed to send message to ${targetAgentName}: ${errorMessage}`,
        importance: 7,
        metadata: {
          targetAgentId,
          targetAgentName,
          messageId: newMessage.id,
          error: errorMessage
        }
      });
      
      return updatedMessage;
    }
  }
  
  /**
   * Update an existing message
   */
  private static updateMessage(updatedMessage: A2AMessage): void {
    const index = this.messages.findIndex(msg => msg.id === updatedMessage.id);
    if (index !== -1) {
      this.messages[index] = updatedMessage;
      this.saveMessages();
    }
  }
  
  /**
   * Get all messages for a specific agent (sent or received)
   */
  static getAgentLogs(agentId: string): A2AMessage[] {
    this.initialize();
    
    return this.messages.filter(msg => 
      msg.sourceAgentId === agentId || msg.targetAgentId === agentId
    );
  }
  
  /**
   * Get conversation between two specific agents
   */
  static getConversation(agent1Id: string, agent2Id: string): A2AMessage[] {
    this.initialize();
    
    return this.messages.filter(msg => 
      (msg.sourceAgentId === agent1Id && msg.targetAgentId === agent2Id) ||
      (msg.sourceAgentId === agent2Id && msg.targetAgentId === agent1Id)
    );
  }
  
  /**
   * Get all sent messages by an agent
   */
  static getSentMessages(agentId: string): A2AMessage[] {
    this.initialize();
    
    return this.messages.filter(msg => msg.sourceAgentId === agentId);
  }
  
  /**
   * Get all received messages by an agent
   */
  static getReceivedMessages(agentId: string): A2AMessage[] {
    this.initialize();
    
    return this.messages.filter(msg => msg.targetAgentId === agentId);
  }
  
  /**
   * Delete a specific message (only allowed by source agent)
   */
  static deleteMessage(messageId: string, requestingAgentId: string): boolean {
    this.initialize();
    
    const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
    
    // Message not found
    if (messageIndex === -1) {
      return false;
    }
    
    const message = this.messages[messageIndex];
    
    // Only source agent can delete the message
    if (message.sourceAgentId !== requestingAgentId) {
      return false;
    }
    
    // Remove message
    this.messages.splice(messageIndex, 1);
    this.saveMessages();
    
    return true;
  }
  
  /**
   * Clear all logs for a specific agent
   */
  static clearLogs(agentId: string): boolean {
    this.initialize();
    
    // Filter out messages related to this agent
    this.messages = this.messages.filter(msg => 
      msg.sourceAgentId !== agentId && msg.targetAgentId !== agentId
    );
    
    this.saveMessages();
    return true;
  }
  
  /**
   * Get summary stats for agent communications
   */
  static getAgentStats(agentId: string): {
    totalSent: number;
    totalReceived: number;
    successRate: number;
    uniqueAgents: number;
  } {
    this.initialize();
    
    const sent = this.getSentMessages(agentId);
    const received = this.getReceivedMessages(agentId);
    
    const successfulSent = sent.filter(msg => msg.status === 'success').length;
    
    // Get unique agents communicated with
    const uniqueAgentIds = new Set<string>();
    sent.forEach(msg => uniqueAgentIds.add(msg.targetAgentId));
    received.forEach(msg => uniqueAgentIds.add(msg.sourceAgentId));
    
    // Remove self from unique agents count if present
    uniqueAgentIds.delete(agentId);
    
    return {
      totalSent: sent.length,
      totalReceived: received.length,
      successRate: sent.length > 0 ? successfulSent / sent.length : 1,
      uniqueAgents: uniqueAgentIds.size
    };
  }
}