import { v4 as uuidv4 } from "uuid";
import { AgentMemory } from "./agent-memory";

// Crew structure for collaborative workflows
export interface Crew {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
  managerAgentId?: string;
  process: "sequential" | "hierarchical" | "collaborative" | "consensus";
  goals: string[];
  createdAt: string;
  status: "active" | "paused" | "completed" | "failed";
  sharedContextId?: string;
  tasks: CrewTask[];
  metadata?: Record<string, any>;
}

// Enhanced task structure for crew collaboration
export interface CrewTask {
  id: string;
  crewId: string;
  title: string;
  description: string;
  assignedTo?: string;
  dependencies: string[];
  status:
    | "pending"
    | "assigned"
    | "in_progress"
    | "completed"
    | "failed"
    | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  expectedOutput: string;
  tools?: string[];
  context?: string;
  approvalRequired?: boolean;
  approvedBy?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  metadata?: Record<string, any>;
}

const API_BASE = "/api";

export class CrewCollaboration {
  static async createCrew(
    name: string,
    description: string,
    agentIds: string[],
    goals: string[],
    process: Crew["process"] = "collaborative",
    managerAgentId?: string
  ): Promise<Crew> {
    const crew: Crew = {
      id: uuidv4(),
      name,
      description,
      agentIds,
      managerAgentId,
      process,
      goals,
      createdAt: new Date().toISOString(),
      status: "active",
      tasks: [],
    };

    // Create shared context for the crew
    // The original code had A2ACommunication.createSharedContext here,
    // but A2ACommunication and its dependencies were removed.
    // This placeholder will be replaced with a proper implementation
    // when A2ACommunication is re-introduced or a new mechanism is in place.
    // For now, we'll just set a placeholder ID.
    crew.sharedContextId = "placeholder-shared-context-id";
    return crew;
  }

  static async getAllCrews(): Promise<Crew[]> {
    try {
      const res = await fetch(`${API_BASE}/memory/get/global:crews`);
      const data = await res.json();
      return Array.isArray(data.value) ? data.value : [];
    } catch {
      return [];
    }
  }
}
