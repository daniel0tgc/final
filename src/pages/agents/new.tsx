import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Agent, MCPServer, AgentConfig } from "@/types";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Bot, Server, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { AgentExecution } from "@/lib/agent-execution";

export default function NewAgentPage() {
  const navigate = useNavigate();

  // Basic agent config
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    name: "",
    description: "",
    type: "conversational",
    systemPrompt: "",
    model: "gpt-3.5-turbo",
    contextLength: 4096,
    maxTokens: 1024,
    tools: [],
    features: {
      memory: false,
      a2a: false,
      websearch: false,
      fileStorage: false,
    },
  });

  // Deployment options
  const [deploymentType, setDeploymentType] = useState<"local" | "mcp">(
    "local"
  );
  const [selectedMCPServerId, setSelectedMCPServerId] = useState<string>("");

  // Advanced settings
  const [advancedSettings, setAdvancedSettings] = useState({
    contextData: "",
  });

  // Form state
  const [isLoading, setIsLoading] = useState(false);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Load MCP servers and available models
  useState(() => {
    try {
      const storedServers = localStorage.getItem("mcpServers");
      if (storedServers) {
        setMcpServers(JSON.parse(storedServers));
      }
    } catch (error) {
      console.error("Error loading MCP servers:", error);
    }

    // Load available models from AI service
    const loadAvailableModels = async () => {
      try {
        const { AIService } = await import("../../lib/ai-service");
        const models = AIService.getAvailableModels();
        setAvailableModels(models);
      } catch (error) {
        console.error("Error loading available models:", error);
      }
    };

    loadAvailableModels();
  });

  // Handle form changes
  const handleBasicConfigChange = (key: string, value: any) => {
    setAgentConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleFeaturesChange = (key: string, value: boolean) => {
    setAgentConfig((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: value },
    }));
  };

  // Go to next step
  const goToNextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  // Go to previous step
  const goToPrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Deploy agent
  const handleDeployAgent = async () => {
    setIsLoading(true);

    try {
      // Generate agent ID
      const agentId = uuidv4();

      // Create agent object
      const newAgent: Agent = {
        id: agentId,
        config: {
          ...agentConfig,
          contextData: advancedSettings.contextData || undefined,
        },
        deploymentType,
        status: "stopped",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };

      // Add MCP server details if using MCP
      if (deploymentType === "mcp" && selectedMCPServerId) {
        const server = mcpServers.find((s) => s.id === selectedMCPServerId);
        if (server) {
          newAgent.mcpServer = server;
        }
      }

      // Save agent to backend
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAgent),
      });
      // Initialize agent in execution engine
      await AgentExecution.startAgent(newAgent);
      // Navigate to agent details page
      setTimeout(() => {
        navigate(`/agents/details/${agentId}`);
      }, 1000);
    } catch (error) {
      console.error("Error deploying agent:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if current step is valid to proceed
  const isCurrentStepValid = () => {
    switch (currentStep) {
      case 1: // Basic configuration
        return (
          agentConfig.name.trim() !== "" &&
          agentConfig.description.trim() !== "" &&
          agentConfig.systemPrompt.trim() !== ""
        );
      case 2: // Deployment options
        if (deploymentType === "mcp") {
          return selectedMCPServerId !== "";
        }
        return true;
      case 3: // Review
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" className="mr-2" asChild>
          <Link to="/agents">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <Bot className="mr-2 h-6 w-6" />
            Deploy New Agent
          </h1>
          <p className="text-muted-foreground">
            Configure and deploy a new agent.
          </p>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
            <div key={step} className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                  step < currentStep
                    ? "bg-primary text-primary-foreground"
                    : step === currentStep
                    ? "border-primary text-primary"
                    : "border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {step < currentStep ? <Check className="h-4 w-4" /> : step}
              </div>
              <span
                className={`text-xs mt-1 ${
                  step <= currentStep
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step === 1 && "Configuration"}
                {step === 2 && "Deployment"}
                {step === 3 && "Review"}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-2">
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted rounded-full">
            <div
              className="absolute top-0 left-0 h-1 bg-primary rounded-full"
              style={{
                width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      <Card className="mb-8">
        {currentStep === 1 && (
          <>
            <CardHeader>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>
                Configure the basic settings and capabilities of your agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agentName">Agent Name</Label>
                    <Input
                      id="agentName"
                      placeholder="e.g., Research Assistant"
                      value={agentConfig.name}
                      onChange={(e) =>
                        handleBasicConfigChange("name", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agentType">Agent Type</Label>
                    <Select
                      value={agentConfig.type}
                      onValueChange={(value) =>
                        handleBasicConfigChange("type", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conversational">
                          Conversational
                        </SelectItem>
                        <SelectItem value="analytical">Analytical</SelectItem>
                        <SelectItem value="assistant">Assistant</SelectItem>
                        <SelectItem value="retrieval">Retrieval</SelectItem>
                        <SelectItem value="autonomous">Autonomous</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agentModel">AI Model</Label>
                  <Select
                    value={agentConfig.model}
                    onValueChange={(value) =>
                      handleBasicConfigChange("model", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select AI model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.length > 0 ? (
                        availableModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="gpt-4" disabled>
                          No models available - configure API keys first
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {availableModels.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Configure API keys in Settings to see available models
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agentDescription">Description</Label>
                  <Input
                    id="agentDescription"
                    placeholder="Brief description of the agent's purpose"
                    value={agentConfig.description}
                    onChange={(e) =>
                      handleBasicConfigChange("description", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">System Prompt</Label>
                  <Textarea
                    id="systemPrompt"
                    placeholder="Instructions defining the agent's behavior and capabilities"
                    className="min-h-[150px]"
                    value={agentConfig.systemPrompt}
                    onChange={(e) =>
                      handleBasicConfigChange("systemPrompt", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    The system prompt defines how the agent behaves and what
                    capabilities it has.
                  </p>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Features & Capabilities
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Memory</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable long-term memory storage for the agent
                        </p>
                      </div>
                      <Switch
                        checked={agentConfig.features?.memory}
                        onCheckedChange={(checked) =>
                          handleFeaturesChange("memory", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Agent-to-Agent Communication</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow this agent to communicate with other agents
                        </p>
                      </div>
                      <Switch
                        checked={agentConfig.features?.a2a}
                        onCheckedChange={(checked) =>
                          handleFeaturesChange("a2a", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Web Search</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow agent to search the web for information
                        </p>
                      </div>
                      <Switch
                        checked={agentConfig.features?.websearch}
                        onCheckedChange={(checked) =>
                          handleFeaturesChange("websearch", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>File Storage</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow agent to store and access files
                        </p>
                      </div>
                      <Switch
                        checked={agentConfig.features?.fileStorage}
                        onCheckedChange={(checked) =>
                          handleFeaturesChange("fileStorage", checked)
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Advanced Configuration
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contextLength">
                        Context Length (tokens)
                      </Label>
                      <Input
                        id="contextLength"
                        type="number"
                        min="512"
                        max="16384"
                        value={agentConfig.contextLength}
                        onChange={(e) =>
                          handleBasicConfigChange(
                            "contextLength",
                            parseInt(e.target.value)
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxTokens">Max Output Tokens</Label>
                      <Input
                        id="maxTokens"
                        type="number"
                        min="16"
                        max="4096"
                        value={agentConfig.maxTokens}
                        onChange={(e) =>
                          handleBasicConfigChange(
                            "maxTokens",
                            parseInt(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor="contextData">Context Data</Label>
                    <Textarea
                      id="contextData"
                      placeholder="Additional data or knowledge to provide to the agent (optional)"
                      className="min-h-[100px]"
                      value={advancedSettings.contextData}
                      onChange={(e) =>
                        setAdvancedSettings({
                          ...advancedSettings,
                          contextData: e.target.value,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide additional knowledge or context that the agent can
                      access.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 2 && (
          <>
            <CardHeader>
              <CardTitle>Deployment Options</CardTitle>
              <CardDescription>
                Choose how and where to deploy your agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Deployment Type</h3>

                <Tabs
                  defaultValue="local"
                  value={deploymentType}
                  onValueChange={(value) =>
                    setDeploymentType(value as "local" | "mcp")
                  }
                >
                  <TabsList className="grid grid-cols-2 mb-4">
                    <TabsTrigger value="local">Local Deployment</TabsTrigger>
                    <TabsTrigger value="mcp">MCP Server</TabsTrigger>
                  </TabsList>
                  <TabsContent value="local" className="border rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 border rounded-md">
                        <Bot size={24} />
                      </div>
                      <div>
                        <h4 className="text-base font-medium">
                          Browser-based Deployment
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Agent runs directly in your browser using local
                          resources. No data leaves your device.
                        </p>
                        <ul className="text-sm space-y-1">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Private and secure</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>No setup required</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Browser persistence</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="mcp" className="border rounded-lg p-4">
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 border rounded-md">
                          <Server size={24} />
                        </div>
                        <div>
                          <h4 className="text-base font-medium">
                            MCP Server Deployment
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Deploy to a Multi-Compute Platform server for
                            improved performance and persistence.
                          </p>
                        </div>
                      </div>

                      {mcpServers.length > 0 ? (
                        <div className="space-y-2">
                          <Label htmlFor="mcpServer">Select MCP Server</Label>
                          <Select
                            value={selectedMCPServerId}
                            onValueChange={setSelectedMCPServerId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a server" />
                            </SelectTrigger>
                            <SelectContent>
                              {mcpServers.map((server) => (
                                <SelectItem key={server.id} value={server.id}>
                                  {server.name} ({server.status})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {selectedMCPServerId && (
                            <div className="mt-4 border rounded-md p-3">
                              <h4 className="text-sm font-medium mb-2">
                                Server Details
                              </h4>
                              {(() => {
                                const server = mcpServers.find(
                                  (s) => s.id === selectedMCPServerId
                                );
                                if (!server) return null;

                                return (
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Status:
                                      </span>
                                      <span
                                        className={
                                          server.status === "online"
                                            ? "text-green-500"
                                            : "text-red-500"
                                        }
                                      >
                                        {server.status}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Capacity:
                                      </span>
                                      <span>
                                        {server.capacity.currentAgents} /{" "}
                                        {server.capacity.maxAgents} agents
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        URL:
                                      </span>
                                      <span>{server.url}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center p-4 border border-dashed rounded-lg">
                          <p className="text-muted-foreground mb-2">
                            No MCP servers configured
                          </p>
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/mcp-servers/new">Add MCP Server</Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 3 && (
          <>
            <CardHeader>
              <CardTitle>Review & Deploy</CardTitle>
              <CardDescription>
                Review your agent configuration before deployment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">
                    Basic Configuration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{agentConfig.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-medium">{agentConfig.type}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Deployment:
                        </span>
                        <span className="font-medium">
                          {deploymentType === "local"
                            ? "Local (Browser)"
                            : `MCP: ${
                                mcpServers.find(
                                  (s) => s.id === selectedMCPServerId
                                )?.name || "Unknown"
                              }`}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Context Length:
                        </span>
                        <span className="font-medium">
                          {agentConfig.contextLength} tokens
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Max Output:
                        </span>
                        <span className="font-medium">
                          {agentConfig.maxTokens} tokens
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-2">Description</h3>
                  <p className="text-sm">{agentConfig.description}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-2">System Prompt</h3>
                  <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                    {agentConfig.systemPrompt}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-2">Features</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full ${
                          agentConfig.features?.memory
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                      <span>Memory</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full ${
                          agentConfig.features?.a2a ? "bg-primary" : "bg-muted"
                        }`}
                      />
                      <span>A2A Communication</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full ${
                          agentConfig.features?.websearch
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                      <span>Web Search</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full ${
                          agentConfig.features?.fileStorage
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                      <span>File Storage</span>
                    </div>
                  </div>
                </div>

                {advancedSettings.contextData && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-lg font-medium mb-2">Context Data</h3>
                      <div className="bg-muted p-4 rounded-md text-sm max-h-32 overflow-y-auto">
                        {advancedSettings.contextData}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </>
        )}

        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={goToPrevStep}
            disabled={currentStep === 1}
          >
            Previous
          </Button>

          <div className="flex gap-2">
            {currentStep < totalSteps ? (
              <Button onClick={goToNextStep} disabled={!isCurrentStepValid()}>
                Next
              </Button>
            ) : (
              <Button
                onClick={handleDeployAgent}
                disabled={isLoading || !isCurrentStepValid()}
              >
                {isLoading ? "Deploying..." : "Deploy Agent"}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
