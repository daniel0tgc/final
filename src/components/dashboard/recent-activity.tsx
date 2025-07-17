import { Agent } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RecentActivityProps {
  agents: Agent[];
}

export function RecentActivity({ agents }: RecentActivityProps) {
  // Sort agents by lastActive timestamp (newest first)
  const sortedAgents = [...agents].sort(
    (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
  );

  // Take only the 5 most recent activities
  const recentAgents = sortedAgents.slice(0, 5);

  const statusColorMap = {
    idle: "bg-gray-400",
    running: "bg-green-500",
    paused: "bg-yellow-500",
    error: "bg-red-500",
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // Convert to appropriate unit
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMins > 0) {
      return `${diffMins}m ago`;
    } else {
      return `${diffSecs}s ago`;
    }
  };

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Recent Agent Activity</CardTitle>
        <CardDescription>
          Latest updates from your AI agents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentAgents.map(agent => (
            <div key={agent.id} className="flex items-center">
              <div className="mr-4 rounded-full p-2 bg-muted">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    statusColorMap[agent.status]
                  )}
                />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  {agent.config.name}
                  <span className="ml-2 text-muted-foreground font-normal">
                    is now {agent.status}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTimeAgo(agent.lastActive)}
                </p>
              </div>
              <Badge variant="outline">
                {agent.deploymentType === "local" ? "Local" : "A2A"}
              </Badge>
            </div>
          ))}

          {recentAgents.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recent activity
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}