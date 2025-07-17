import { v4 as uuidv4 } from "uuid";
import { Agent } from "@/types";
import { AgentMemory } from "./agent-memory";

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

export class AgentExecution {
  private static conversations: Map<string, AgentConversation> = new Map();
  private static activeAgents: Set<string> = new Set();
  private static initialized = false;

  /**
   * Public method to initialize the agent execution system
   */
  static init(): void {
    if (!this.initialized) {
      this.initialize();
      this.initialized = true;
    }
  }

  /**
   * Start an agent - activate it for execution
   */
  static startAgent(agent: Agent): Agent {
    try {
      // Add to active agents
      this.activeAgents.add(agent.id);

      // Initialize conversation if needed
      if (!this.conversations.has(agent.id)) {
        this.conversations.set(agent.id, {
          agentId: agent.id,
          messages: [
            {
              role: "system",
              content: agent.config.systemPrompt,
              timestamp: new Date().toISOString(),
            },
          ],
          lastActive: new Date().toISOString(),
        });

        // Persist conversations to localStorage
        this.saveConversations();
      }

      // Update active agents in localStorage
      this.saveActiveAgents();

      // Log agent start to memory
      AgentMemory.addMemory(agent.id, {
        type: "observation",
        content: `Agent activated`,
        importance: 5,
      });

      // Return updated agent
      const updatedAgent = { ...agent, status: "active" as const };
      this.updateAgentInStorage(updatedAgent);

      return updatedAgent;
    } catch (error) {
      console.error("Error starting agent:", error);
      throw error;
    }
  }

  /**
   * Stop an agent - deactivate it
   */
  static stopAgent(agentId: string): Agent {
    try {
      // Remove from active agents
      this.activeAgents.delete(agentId);

      // Update active agents in localStorage
      this.saveActiveAgents();

      // Log agent stop to memory
      AgentMemory.addMemory(agentId, {
        type: "observation",
        content: `Agent deactivated`,
        importance: 5,
      });

      // Get and update agent
      const agent = this.getAgentDetails(agentId);
      if (!agent) throw new Error("Agent not found");

      const updatedAgent = { ...agent, status: "stopped" as const };
      this.updateAgentInStorage(updatedAgent);

      return updatedAgent;
    } catch (error) {
      console.error("Error stopping agent:", error);
      throw error;
    }
  }

  /**
   * Check if an agent is active
   */
  static isAgentActive(agentId: string): boolean {
    return this.activeAgents.has(agentId);
  }

  /**
   * Send a message to an agent and get response
   */
  static async sendMessage(
    agentId: string,
    message: string
  ): Promise<AgentMessage> {
    try {
      // Get agent conversation
      const conversation = this.getConversation(agentId);
      if (!conversation) {
        throw new Error("Agent conversation not found");
      }

      // Create user message
      const userMessage: AgentMessage = {
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };

      // Add to conversation
      conversation.messages.push(userMessage);
      conversation.lastActive = userMessage.timestamp;

      // Add to agent memory
      AgentMemory.addMemory(agentId, {
        type: "user_message",
        content: message,
        importance: AgentMemory.assessImportance(message, "user_message"),
      });

      // In a real implementation, this would call the AI service
      // Here we'll simulate a response after a delay

      // Get agent info for the response (agent name, type, etc.)
      const agent = this.getAgentDetails(agentId);

      // Generate response based on agent type and message
      const response = await this.generateAgentResponse(agent, message);

      // Create agent message
      const agentMessage: AgentMessage = {
        role: "agent",
        content: response,
        timestamp: new Date().toISOString(),
      };

      // Add to conversation
      conversation.messages.push(agentMessage);
      conversation.lastActive = agentMessage.timestamp;

      // Add to agent memory
      AgentMemory.addMemory(agentId, {
        type: "agent_response",
        content: response,
        importance: AgentMemory.assessImportance(response, "agent_response"),
      });

      // Save updated conversation
      this.saveConversations();

      return agentMessage;
    } catch (error) {
      console.error("Error sending message to agent:", error);
      throw error;
    }
  }

  /**
   * Run an autonomous task with an agent
   */
  static async runAutonomousTask(agent: Agent, task: string): Promise<string> {
    try {
      // Check if agent is active
      if (!this.isAgentActive(agent.id)) {
        this.startAgent(agent);
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

      // Simulate processing time (would be AI service call in real implementation)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Generate response based on agent type and task
      const response = this.generateAutonomousResponse(task, agent);

      // Add result to agent memory
      AgentMemory.addMemory(agent.id, {
        type: "observation",
        content: `Task completed: ${task}`,
        importance: 7,
        metadata: {
          taskType: "autonomous",
          result: response,
        },
      });

      return response;
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
   * Generate a response for autonomous task
   */
  private static generateAutonomousResponse(
    task: string,
    agent: Agent
  ): string {
    const taskLower = task.toLowerCase();
    const agentType = agent.config.type;

    // Generate different responses based on task and agent type
    if (taskLower.includes("analyze") || taskLower.includes("review")) {
      return (
        `Task Analysis Complete: "${task}"\n\n` +
        `I've analyzed the request and identified the following key elements:\n\n` +
        `1. Primary objective: ${this.extractObjective(task)}\n` +
        `2. Key constraints: Time, resources, and data availability\n` +
        `3. Success criteria: Accuracy, completeness, and actionability\n\n` +
        `Based on my analysis, I recommend proceeding with a phased approach, starting with data gathering, then analysis, and finally presenting recommendations.\n\n` +
        `Would you like me to begin implementation or refine the approach?`
      );
    }

    if (taskLower.includes("research") || taskLower.includes("find")) {
      return (
        `Research Task Complete: "${task}"\n\n` +
        `After thorough investigation, I've gathered the following information:\n\n` +
        `• The topic shows significant development in recent years\n` +
        `• Key trends include increased automation, AI integration, and improved efficiency\n` +
        `• Several challenges remain, particularly regarding standardization and interoperability\n\n` +
        `The most promising avenues for further exploration are in the areas of:\n` +
        `1. Adaptive systems that respond to changing environments\n` +
        `2. Integrated platforms that combine multiple functionalities\n` +
        `3. User-centric designs that prioritize accessibility and ease of use\n\n` +
        `Would you like me to focus on any specific aspect for a deeper analysis?`
      );
    }

    if (
      taskLower.includes("plan") ||
      taskLower.includes("schedule") ||
      taskLower.includes("organize")
    ) {
      return (
        `Planning Task Complete: "${task}"\n\n` +
        `I've developed a comprehensive plan with the following components:\n\n` +
        `PHASE 1: Preparation (Days 1-3)\n` +
        `• Resource assessment and allocation\n` +
        `• Stakeholder identification and communication\n` +
        `• Initial risk assessment\n\n` +
        `PHASE 2: Implementation (Days 4-10)\n` +
        `• Core components development\n` +
        `• Integration testing\n` +
        `• Preliminary quality assurance\n\n` +
        `PHASE 3: Refinement (Days 11-14)\n` +
        `• User feedback incorporation\n` +
        `• Performance optimization\n` +
        `• Final documentation\n\n` +
        `The plan includes contingency measures for common obstacles and a flexible timeline that can be adjusted as needed.\n\n` +
        `Would you like me to proceed with implementation or adjust any aspects of this plan?`
      );
    }

    if (taskLower.includes("summarize") || taskLower.includes("summary")) {
      return (
        `Summary Task Complete: "${task}"\n\n` +
        `Key points:\n\n` +
        `1. The subject demonstrates significant complexity with multiple interdependent factors\n` +
        `2. Recent developments have shifted priorities toward sustainable and scalable solutions\n` +
        `3. Current challenges primarily revolve around integration with existing systems\n` +
        `4. Future directions point toward more automated, intelligence-driven approaches\n\n` +
        `This summary focuses on actionable insights and strategic implications rather than tactical details. The most critical takeaway is the need for adaptable frameworks that can evolve with changing requirements.\n\n` +
        `Would you like me to elaborate on any specific aspect of this summary?`
      );
    }

    if (agentType === "conversational") {
      return (
        `I've completed your requested task: "${task}"\n\n` +
        `I approached this by considering multiple perspectives and focusing on the most relevant aspects. The results indicate that there are several viable approaches, each with their own strengths.\n\n` +
        `My analysis suggests that an iterative process would be most effective, allowing for continuous refinement based on feedback and results.\n\n` +
        `Would you like me to proceed with implementation or would you prefer to discuss alternative approaches?`
      );
    }

    if (agentType === "analytical") {
      return (
        `Analysis Complete: "${task}"\n\n` +
        `I've examined the available data and identified the following patterns:\n\n` +
        `• Pattern A: Shows strong correlation with external factors\n` +
        `• Pattern B: Demonstrates cyclical behavior with predictable intervals\n` +
        `• Pattern C: Reveals anomalies that warrant further investigation\n\n` +
        `Statistical significance: High (p < 0.05)\n` +
        `Confidence interval: 95%\n` +
        `Margin of error: ±3.2%\n\n` +
        `This analysis suggests that the observed phenomena are not random and can be modeled with reasonable accuracy. Further data would help refine these conclusions.\n\n` +
        `Would you like me to perform additional analysis on any specific aspect?`
      );
    }

    // Default response for other task types
    return (
      `Task Complete: "${task}"\n\n` +
      `I've successfully executed the requested task and compiled the results. The process involved multiple stages of analysis and execution.\n\n` +
      `Key outcomes:\n\n` +
      `1. Primary objectives were achieved within the specified parameters\n` +
      `2. Several optimization opportunities were identified during execution\n` +
      `3. The results provide a solid foundation for further development\n\n` +
      `Next steps could include refining the approach based on these initial results, exploring alternative methodologies, or scaling the solution to address broader challenges.\n\n` +
      `Would you like me to elaborate on any specific aspect of the results?`
    );
  }

  /**
   * Extract the main objective from a task description (simple version)
   */
  private static extractObjective(task: string): string {
    const taskLower = task.toLowerCase();

    // Extract objective based on common patterns (simple implementation)
    if (taskLower.includes("analyze")) return "Conduct comprehensive analysis";
    if (taskLower.includes("research"))
      return "Gather and synthesize information";
    if (taskLower.includes("plan")) return "Develop structured approach";
    if (taskLower.includes("summarize"))
      return "Extract and present key information";
    if (taskLower.includes("find"))
      return "Locate specific information or resources";
    if (taskLower.includes("create"))
      return "Generate new content or solutions";

    // Default objective extraction
    const words = task.split(" ");
    if (words.length > 5) {
      return `${words[0]} ${words[1]} ${words[2]}...`; // First few words
    }
    return task; // Use full task if it's short
  }

  /**
   * Generate a response based on agent type and message
   */
  private static async generateAgentResponse(
    agent: Agent | null,
    message: string
  ): Promise<string> {
    if (!agent) {
      return "I'm sorry, I can't process your request at the moment.";
    }

    try {
      // Import AI service dynamically to avoid circular dependencies
      const { AIService } = await import("./ai-service");

      // Check if API keys are configured
      if (!AIService.hasValidApiKeys()) {
        console.log("No valid API keys found, using mock response");
        // Fallback to mock response if no API keys
        return this.generateMockResponse(agent, message);
      }

      console.log("Using real AI service for response generation");

      // Get conversation history for context
      const conversation = this.getConversation(agent.id);
      const recentMessages = conversation.messages.slice(-10); // Last 10 messages for context

      // Convert to AI service format
      const aiMessages = recentMessages.map((msg) => {
        const convertedRole =
          msg.role === "agent"
            ? "assistant"
            : (msg.role as "system" | "user" | "assistant");
        console.log(`Converting message role: ${msg.role} -> ${convertedRole}`);
        return {
          role: convertedRole,
          content: msg.content,
        };
      });

      // Add the current user message
      aiMessages.push({
        role: "user",
        content: message,
      });

      console.log("Sending messages to AI service:", aiMessages);

      // Generate response using AI service
      const response = await AIService.generateResponse(
        aiMessages,
        agent.config.model,
        {
          temperature: 0.7,
          maxTokens: agent.config.maxTokens || 1000,
        }
      );

      return response.content;
    } catch (error) {
      console.error("Error generating AI response:", error);

      // Fallback to mock response if AI service fails
      return this.generateMockResponse(agent, message);
    }
  }

  /**
   * Generate a mock response (fallback when AI service is unavailable)
   */
  private static generateMockResponse(agent: Agent, message: string): string {
    const agentType = agent.config.type;
    const messageLower = message.toLowerCase();

    // Generate appropriate responses based on agent type
    if (agentType === "conversational") {
      if (messageLower.includes("hello") || messageLower.includes("hi")) {
        return `Hello! I'm ${agent.config.name}, a conversational AI agent. How can I assist you today?`;
      }

      if (
        messageLower.includes("help") ||
        messageLower.includes("what can you do")
      ) {
        return `I'm ${agent.config.name}, and I'm designed to have helpful conversations. I can answer questions, provide information, or just chat. What would you like to talk about?`;
      }

      return `Thanks for your message. As a conversational agent, I'm here to help with your questions and provide useful information. Based on what you've shared, I think we could explore this topic further. Would you like me to elaborate on any specific aspect?`;
    }

    if (agentType === "analytical") {
      return (
        `I've analyzed your query: "${message}"\n\n` +
        `From an analytical perspective, this presents several interesting dimensions to explore:\n\n` +
        `1. Primary factors: Context, implications, and underlying assumptions\n` +
        `2. Secondary considerations: Trade-offs, alternatives, and constraints\n` +
        `3. Relevant metrics: Efficiency, accuracy, and scalability\n\n` +
        `Based on initial assessment, I recommend focusing on the most critical aspects first to establish a solid foundation for further analysis. Would you like me to proceed with a deeper examination of any particular element?`
      );
    }

    if (agentType === "creative") {
      return (
        `Thanks for the creative prompt! I've been thinking about "${message}" and have some interesting ideas:\n\n` +
        `• What if we approached this from an unconventional angle by inverting our usual thinking?\n` +
        `• There's potential to blend multiple concepts here - combining elements from different domains\n` +
        `• A promising direction might be to explore the tensions between opposing aspects\n\n` +
        `I'm particularly drawn to the possibilities that emerge when we challenge our initial assumptions. Would you like me to develop any of these creative directions further?`
      );
    }

    // Default response for other agent types
    return `Thank you for your message. I'm ${agent.config.name}, an AI agent designed to assist with various tasks. I've processed your request and am ready to help. Could you provide more details about what you're looking for so I can better assist you?`;
  }

  /**
   * Get details for an agent
   */
  private static getAgentDetails(agentId: string): Agent | null {
    try {
      const storedAgents = localStorage.getItem("agents");
      if (storedAgents) {
        const agents = JSON.parse(storedAgents);
        const agent = agents.find((a: Agent) => a.id === agentId);
        return agent || null;
      }
    } catch (error) {
      console.error("Error getting agent details:", error);
    }

    return null;
  }

  /**
   * Get conversation for an agent
   */
  static getConversation(agentId: string): AgentConversation {
    // Check if in memory
    if (this.conversations.has(agentId)) {
      return this.conversations.get(agentId)!;
    }

    // Try to load from localStorage
    try {
      const storedConversations = localStorage.getItem("agent_conversations");
      if (storedConversations) {
        const conversations = JSON.parse(storedConversations);

        if (conversations[agentId]) {
          // Found in localStorage, add to memory
          this.conversations.set(agentId, conversations[agentId]);
          return conversations[agentId];
        }
      }
    } catch (error) {
      console.error("Error loading conversation from localStorage:", error);
    }

    // Not found, create a new conversation
    const newConversation: AgentConversation = {
      agentId,
      messages: [],
      lastActive: new Date().toISOString(),
    };

    this.conversations.set(agentId, newConversation);
    this.saveConversations();

    return newConversation;
  }

  /**
   * Save all conversations to localStorage
   */
  private static saveConversations(): void {
    try {
      // Convert Map to Object for storage
      const conversationsObj: Record<string, AgentConversation> = {};
      for (const [agentId, conversation] of this.conversations.entries()) {
        conversationsObj[agentId] = conversation;
      }

      localStorage.setItem(
        "agent_conversations",
        JSON.stringify(conversationsObj)
      );
    } catch (error) {
      console.error("Error saving conversations to localStorage:", error);
    }
  }

  /**
   * Save active agents to localStorage
   */
  private static saveActiveAgents(): void {
    try {
      localStorage.setItem(
        "active_agents",
        JSON.stringify([...this.activeAgents])
      );
    } catch (error) {
      console.error("Error saving active agents to localStorage:", error);
    }
  }

  /**
   * Update agent in storage
   */
  private static updateAgentInStorage(agent: Agent): void {
    try {
      const storedAgents = localStorage.getItem("agents");
      if (storedAgents) {
        const agents = JSON.parse(storedAgents);
        const updatedAgents = agents.map((a: Agent) =>
          a.id === agent.id ? agent : a
        );
        localStorage.setItem("agents", JSON.stringify(updatedAgents));
      }
    } catch (error) {
      console.error("Error updating agent in storage:", error);
    }
  }

  /**
   * Load all conversations from localStorage
   */
  static loadConversations(): void {
    try {
      const storedConversations = localStorage.getItem("agent_conversations");
      if (storedConversations) {
        const conversations = JSON.parse(storedConversations);

        for (const agentId in conversations) {
          this.conversations.set(agentId, conversations[agentId]);
        }
      }
    } catch (error) {
      console.error("Error loading conversations from localStorage:", error);
    }
  }

  /**
   * Load active agents from localStorage
   */
  static loadActiveAgents(): void {
    try {
      const storedActiveAgents = localStorage.getItem("active_agents");
      if (storedActiveAgents) {
        const activeAgents = JSON.parse(storedActiveAgents);
        this.activeAgents = new Set(activeAgents);
      }
    } catch (error) {
      console.error("Error loading active agents from localStorage:", error);
    }
  }

  /**
   * Initialize the agent execution engine
   */
  static initialize(): void {
    this.loadConversations();
    this.loadActiveAgents();
  }
}

// Initialization is now handled via the init() method called from App.tsx
