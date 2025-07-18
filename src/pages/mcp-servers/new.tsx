import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ArrowLeft,
  Plus,
  Server,
  Globe,
  Search,
  FolderOpen,
  MessageCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";

const BUILT_IN_SERVERS = [
  {
    type: "web-search",
    name: "Web Search MCP Server",
    description: "Search the web using Google and other search engines",
    icon: Search,
    requires: ["SERPAPI_API_KEY or GOOGLE_API_KEY + GOOGLE_CSE_ID"],
  },
  {
    type: "filesystem",
    name: "File System MCP Server",
    description: "Read and write files on the local filesystem",
    icon: FolderOpen,
    requires: ["MCP_SERVER_FILESYSTEM_ROOT (optional)"],
  },
  {
    type: "telegram",
    name: "Telegram Messaging MCP Server",
    description: "Send messages to Telegram channels and users",
    icon: MessageCircle,
    requires: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  },
];

export default function NewMCPServerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [serverType, setServerType] = useState<"built-in" | "custom">(
    "built-in"
  );
  const [selectedBuiltInServer, setSelectedBuiltInServer] =
    useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    maxAgents: 10,
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (serverType === "built-in" && !selectedBuiltInServer) {
      toast({
        title: "Validation Error",
        description: "Please select a built-in server type",
        variant: "destructive",
      });
      return;
    }

    if (serverType === "custom" && (!formData.name || !formData.url)) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const serverData = {
        id: uuidv4(),
        name:
          serverType === "built-in"
            ? BUILT_IN_SERVERS.find((s) => s.type === selectedBuiltInServer)
                ?.name || selectedBuiltInServer
            : formData.name,
        url: formData.url,
        capacity: {
          currentAgents: 0,
          maxAgents: parseInt(formData.maxAgents.toString()),
        },
        features: [],
        ...(serverType === "built-in" && { serverType: selectedBuiltInServer }),
      };

      const response = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        throw new Error("Failed to create MCP server");
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: `MCP server created successfully${
          result.tools?.length ? ` with ${result.tools.length} tools` : ""
        }`,
      });

      navigate("/mcp-servers");
    } catch (error) {
      console.error("Error creating MCP server:", error);
      toast({
        title: "Error",
        description: "Failed to create MCP server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/mcp-servers")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to MCP Servers
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New MCP Server
            </CardTitle>
            <CardDescription>
              Configure a new Multi-Compute Platform server to extend your agent
              capabilities with external tools.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <Label>Server Type</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant={serverType === "built-in" ? "default" : "outline"}
                    onClick={() => setServerType("built-in")}
                    className="h-auto p-4 flex flex-col items-center gap-2"
                  >
                    <Server className="h-6 w-6" />
                    <span>Built-in Server</span>
                    <span className="text-xs text-muted-foreground">
                      Pre-configured MCP servers
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant={serverType === "custom" ? "default" : "outline"}
                    onClick={() => setServerType("custom")}
                    className="h-auto p-4 flex flex-col items-center gap-2"
                  >
                    <Globe className="h-6 w-6" />
                    <span>Custom Server</span>
                    <span className="text-xs text-muted-foreground">
                      External MCP server URL
                    </span>
                  </Button>
                </div>
              </div>

              {serverType === "built-in" && (
                <div className="space-y-4">
                  <Label>Select Built-in Server</Label>
                  <div className="grid gap-3">
                    {BUILT_IN_SERVERS.map((server) => {
                      const Icon = server.icon;
                      return (
                        <Button
                          key={server.type}
                          type="button"
                          variant={
                            selectedBuiltInServer === server.type
                              ? "default"
                              : "outline"
                          }
                          onClick={() => setSelectedBuiltInServer(server.type)}
                          className="h-auto p-4 justify-start gap-3"
                        >
                          <Icon className="h-5 w-5" />
                          <div className="text-left">
                            <div className="font-medium">{server.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {server.description}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Requires: {server.requires.join(", ")}
                            </div>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {serverType === "custom" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Server Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="e.g., Local Development Server"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="url">Server URL *</Label>
                    <Input
                      id="url"
                      type="url"
                      value={formData.url}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          url: e.target.value,
                        }))
                      }
                      placeholder="e.g., http://localhost:8000 or https://mcp.example.com"
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      The URL where your MCP server is running. The server
                      should expose a /tools endpoint for tool discovery.
                    </p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="maxAgents">Maximum Agents</Label>
                <Input
                  id="maxAgents"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.maxAgents}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxAgents: parseInt(e.target.value) || 10,
                    }))
                  }
                  placeholder="10"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum number of agents that can connect to this server
                  simultaneously.
                </p>
              </div>

              {serverType === "custom" && (
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">MCP Server Requirements</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>
                      • Must expose a <code>/tools</code> endpoint (GET) for
                      tool discovery
                    </li>
                    <li>
                      • Must expose an <code>/execute</code> endpoint (POST) for
                      tool execution
                    </li>
                    <li>• Should return JSON responses</li>
                    <li>
                      • Should handle CORS if running on a different domain
                    </li>
                  </ul>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/mcp-servers")}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Server className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Server
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
