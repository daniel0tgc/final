import { Agent } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  RefreshCw,
  StopCircle,
  CloudOff,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  agent: Agent;
  onStatusChange: (agentId: string, newStatus: Agent["status"]) => void;
  onDeploymentChange: (
    agentId: string,
    newType: Agent["deploymentType"]
  ) => void;
}

export function AgentCard({
  agent,
  onStatusChange,
  onDeploymentChange,
}: AgentCardProps) {
  const statusColorMap = {
    idle: "bg-gray-400",
    running: "bg-green-500",
    paused: "bg-yellow-500",
    error: "bg-red-500",
  };

  const deploymentTypeMap = {
    local: {
      label: "Local",
      icon: <CloudOff size={14} />,
      action: "Deploy Online",
      newType: "online" as const,
    },
    online: {
      label: "Online (A2A)",
      icon: <Cloud size={14} />,
      action: "Deploy Local",
      newType: "local" as const,
    },
    mcp: {
      label: "MCP Server",
      icon: <Cloud size={14} />,
      action: "Deploy Local",
      newType: "local" as const,
    },
  };

  const handleStatusChange = (newStatus: Agent["status"]) => {
    onStatusChange(agent.id, newStatus);
  };

  const handleDeploymentChange = () => {
    const currentType = agent.deploymentType;
    const newType = deploymentTypeMap[currentType].newType;
    onDeploymentChange(agent.id, newType);
  };

  const getStatusActions = () => {
    switch (agent.status) {
      case "idle":
        return (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => handleStatusChange("running")}
          >
            <Play size={14} /> Start
          </Button>
        );
      case "running":
        return (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => handleStatusChange("paused")}
            >
              <Pause size={14} /> Pause
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => handleStatusChange("idle")}
            >
              <StopCircle size={14} /> Stop
            </Button>
          </>
        );
      case "paused":
        return (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => handleStatusChange("running")}
            >
              <Play size={14} /> Resume
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => handleStatusChange("idle")}
            >
              <StopCircle size={14} /> Stop
            </Button>
          </>
        );
      case "error":
        return (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => handleStatusChange("idle")}
          >
            <RefreshCw size={14} /> Restart
          </Button>
        );
    }
  };

  const currentDeployment = deploymentTypeMap[agent.deploymentType];

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{agent.config.name}</CardTitle>
            <CardDescription className="line-clamp-1">
              {agent.config.description}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn("ml-2 capitalize", statusColorMap[agent.status])}
          >
            {agent.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Type:</span>{" "}
            <span className="capitalize">{agent.config.type}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Model:</span>{" "}
            <span>{agent.config.model}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Deployment:</span>{" "}
            <Badge variant="outline" className="gap-1 font-normal">
              {currentDeployment.icon}
              {currentDeployment.label}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>{" "}
            <span>{new Date(agent.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="secondary" size="sm" onClick={handleDeploymentChange}>
          {currentDeployment.action}
        </Button>
        <div className="flex gap-2">{getStatusActions()}</div>
      </CardFooter>
    </Card>
  );
}
