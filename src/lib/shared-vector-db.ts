// Mocked shared vector database for agent awareness and knowledge sharing
export class SharedVectorDB {
  static vectorStore: any[] = [];

  // Embed agent profile when created
  static embedAgentProfile(agent: any) {
    this.vectorStore.push({
      type: "agent_profile",
      agentId: agent.id,
      name: agent.config.name,
      description: agent.config.description,
      timestamp: new Date().toISOString(),
      data: agent,
    });
  }

  // Embed agent action or result
  static embedAgentAction(agentId: string, action: string, result: string) {
    this.vectorStore.push({
      type: "agent_action",
      agentId,
      action,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  // Query the vector store (mocked)
  static query(query: string) {
    // For now, just return all entries containing the query in name, description, or action
    return this.vectorStore.filter((entry) => {
      return (
        (entry.name && entry.name.includes(query)) ||
        (entry.description && entry.description.includes(query)) ||
        (entry.action && entry.action.includes(query)) ||
        (entry.result && entry.result.includes(query))
      );
    });
  }
}
