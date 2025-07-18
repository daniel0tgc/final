import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MCPServer } from "@/types";
import {
  Plus,
  Server,
  Settings,
  Globe,
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export default function MCPServersPage() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingServer, setTestingServer] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mcp-servers");
      if (!response.ok) {
        throw new Error("Failed to load MCP servers");
      }
      const data = await response.json();
      setServers(data);
    } catch (error) {
      console.error("Error loading MCP servers:", error);
      toast({
        title: "Error",
        description: "Failed to load MCP servers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testServerConnection = async (serverId: string) => {
    setTestingServer(serverId);
    try {
      const response = await fetch(`/api/mcp-servers/${serverId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to test server connection");
      }

      const result = await response.json();

      // Update the server status in the local state
      setServers((prevServers) =>
        prevServers.map((server) =>
          server.id === serverId
            ? { ...server, status: result.status, tools: result.tools || [] }
            : server
        )
      );

      toast({
        title: "Server Test Complete",
        description: `Server is ${result.status}`,
        variant: result.status === "online" ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Error testing server:", error);
      toast({
        title: "Test Failed",
        description: "Failed to test server connection",
        variant: "destructive",
      });
    } finally {
      setTestingServer(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MCP Servers</h1>
            <p className="text-muted-foreground">
              Manage your Multi-Compute Platform servers.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading MCP servers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Servers</h1>
          <p className="text-muted-foreground">
            Manage your Multi-Compute Platform servers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadServers}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button asChild>
            <Link to="/mcp-servers/new">
              <Plus className="mr-2 h-4 w-4" /> Add New Server
            </Link>
          </Button>
        </div>
      </div>

      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Server className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No MCP Servers Found</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            You haven't added any MCP servers yet. Add a server to enable
            external tool access and remote agent deployment.
          </p>
          <Button asChild>
            <Link to="/mcp-servers/new">
              <Plus className="mr-2 h-4 w-4" /> Add New Server
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <Card key={server.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Server size={20} />
                      {server.name}
                    </CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <Globe size={14} className="mr-1" />
                      {server.url}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={server.status === "online" ? "default" : "outline"}
                  >
                    {server.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <Activity size={14} className="mr-1" />
                    <span className="text-muted-foreground">Capacity</span>
                  </div>
                  <span>
                    {server.capacity?.currentAgents || 0} /{" "}
                    {server.capacity?.maxAgents || 10} agents
                  </span>
                </div>

                <Progress
                  value={
                    ((server.capacity?.currentAgents || 0) /
                      (server.capacity?.maxAgents || 10)) *
                    100
                  }
                  className="h-2"
                />

                <div className="space-y-2">
                  <div className="text-sm font-medium">Available Tools</div>
                  <div className="flex flex-wrap gap-1">
                    {server.tools && server.tools.length > 0 ? (
                      server.tools
                        .slice(0, 3)
                        .map((tool: any, index: number) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tool.name || tool}
                          </Badge>
                        ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No tools discovered
                      </span>
                    )}
                    {server.tools && server.tools.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{server.tools.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {server.features && server.features.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Features</div>
                    <div className="flex flex-wrap gap-1">
                      {server.features.map((feature: string, index: number) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs"
                        >
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t p-4 pt-4 flex justify-between">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => testServerConnection(server.id)}
                  disabled={testingServer === server.id}
                >
                  {testingServer === server.id ? (
                    <>
                      <RefreshCw size={16} className="mr-1 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Wifi size={16} className="mr-1" />
                      Test Connection
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/mcp-servers/details/${server.id}`}>
                    <Settings size={16} className="mr-1" />
                    Configure
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
