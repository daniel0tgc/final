import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/dashboard/agent-card";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Agent } from "@/types";
import { PlusCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);

  const handleAgentStatusChange = (
    agentId: string,
    newStatus: Agent["status"]
  ) => {
    setAgents(
      agents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              status: newStatus,
              lastActive: new Date().toISOString(),
            }
          : agent
      )
    );
  };

  const handleAgentDeploymentChange = (
    agentId: string,
    newType: Agent["deploymentType"]
  ) => {
    setAgents(
      agents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              deploymentType: newType,
              lastActive: new Date().toISOString(),
            }
          : agent
      )
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Manage and monitor your AI agent deployments
            </p>
          </div>
          <Button className="gap-2">
            <PlusCircle size={16} />
            Deploy New Agent
          </Button>
        </div>

        <DashboardStats agents={agents} />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <RecentActivity agents={agents} />

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>MCP Server Status</CardTitle>
              <CardDescription>
                Your available communication servers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center py-4">
                  No MCP servers configured yet
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-2xl font-semibold tracking-tight mt-2">
          Your Agents
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onStatusChange={handleAgentStatusChange}
              onDeploymentChange={handleAgentDeploymentChange}
            />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
