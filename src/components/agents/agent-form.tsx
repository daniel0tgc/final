import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Agent, AgentConfig, AgentType } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { mockTools, mockPermissions } from "@/lib/mock-data";

// Define form schema with zod
const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  type: z.enum(["assistant", "researcher", "coder", "analyst", "custom"]),
  model: z.string().min(1, "Model is required"),
  systemPrompt: z
    .string()
    .min(10, "System prompt must be at least 10 characters"),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().min(100).max(8192),
  deploymentType: z.enum(["local", "online"]),
  tools: z.array(z.string()),
  permissions: z.array(z.string()),
});

interface AgentFormProps {
  initialData?: Agent;
  onSubmit: (agent: Agent) => void;
  onCancel?: () => void;
}

export function AgentForm({ initialData, onSubmit, onCancel }: AgentFormProps) {
  const [availableTools] = useState(mockTools);
  const [availablePermissions] = useState(mockPermissions);

  // Set up form with default values from initialData or defaults
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          name: initialData.config.name,
          description: initialData.config.description,
          type: initialData.config.type,
          model: initialData.config.model,
          systemPrompt: initialData.config.systemPrompt,
          temperature: initialData.config.temperature,
          maxTokens: initialData.config.maxTokens,
          deploymentType: initialData.deploymentType,
          tools: initialData.config.tools.map((t) => t.id),
          permissions: initialData.config.permissions.map((p) => p.id),
        }
      : {
          name: "",
          description: "",
          type: "assistant",
          model: "gpt-4",
          systemPrompt: "You are a helpful AI assistant.",
          temperature: 0.7,
          maxTokens: 2048,
          deploymentType: "local",
          tools: [],
          permissions: [],
        },
  });

  const handleFormSubmit = (values: z.infer<typeof formSchema>) => {
    const configId = initialData?.config.id || uuidv4();
    const agentId = initialData?.id || uuidv4();

    // Build the tools and permissions arrays based on selected IDs
    const selectedTools = availableTools
      .filter((tool) => values.tools.includes(tool.id))
      .map((tool) => ({ ...tool }));

    const selectedPermissions = availablePermissions
      .filter((perm) => values.permissions.includes(perm.id))
      .map((perm) => ({ ...perm }));

    // Create the new agent config
    const config: AgentConfig = {
      id: configId,
      name: values.name,
      description: values.description,
      type: values.type as AgentType,
      model: values.model,
      systemPrompt: values.systemPrompt,
      temperature: values.temperature,
      maxTokens: values.maxTokens,
      tools: selectedTools,
      permissions: selectedPermissions,
    };

    // Create the complete agent
    const agent: Agent = {
      id: agentId,
      config,
      status: initialData?.status || "idle",
      deploymentType: values.deploymentType,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      lastActive: initialData?.lastActive || new Date().toISOString(),
      collaboratingAgents: initialData?.collaboratingAgents || [],
      mcpServerId: initialData?.mcpServerId,
    };

    onSubmit(agent);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)}>
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Define the basic details for your AI agent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My AI Agent" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for your agent
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="This agent helps with..."
                        className="min-h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A detailed description of what this agent does
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select agent type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="assistant">Assistant</SelectItem>
                          <SelectItem value="researcher">Researcher</SelectItem>
                          <SelectItem value="coder">Coder</SelectItem>
                          <SelectItem value="analyst">Analyst</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The type of agent defines its primary capabilities
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language Model</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-3.5-turbo">
                            GPT-3.5 Turbo
                          </SelectItem>
                          <SelectItem value="claude-3">Claude 3</SelectItem>
                          <SelectItem value="llama-3">Llama 3</SelectItem>
                          <SelectItem value="custom-model">
                            Custom Model
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The language model powering your agent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="deploymentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deployment Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select deployment type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="local">Local Only</SelectItem>
                        <SelectItem value="online">Online (A2A)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Whether the agent runs locally or connects to the A2A
                      network
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>
                Customize how your agent thinks and responds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="You are a helpful AI assistant..."
                        className="min-h-32"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Instructions that define the agent's behavior and
                      knowledge
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature: {field.value.toFixed(2)}</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Controls randomness: lower for focused responses, higher
                      for creative ones
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxTokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Response Length: {field.value}</FormLabel>
                    <FormControl>
                      <Slider
                        min={100}
                        max={8192}
                        step={1}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      The maximum number of tokens in the model's response
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tools & Permissions</CardTitle>
              <CardDescription>
                Configure what your agent can access and use
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="tools"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Tools</FormLabel>
                    <FormDescription>
                      Select which tools this agent can use
                    </FormDescription>
                    <div className="space-y-2 mt-2">
                      {availableTools.map((tool) => (
                        <div
                          key={tool.id}
                          className="flex items-center space-x-2 border p-2 rounded-md"
                        >
                          <Switch
                            id={`tool-${tool.id}`}
                            checked={field.value.includes(tool.id)}
                            onCheckedChange={(checked) => {
                              const updatedTools = checked
                                ? [...field.value, tool.id]
                                : field.value.filter((id) => id !== tool.id);
                              field.onChange(updatedTools);
                            }}
                          />
                          <div className="grid gap-1">
                            <label
                              htmlFor={`tool-${tool.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {tool.name}
                            </label>
                            <p className="text-xs text-muted-foreground">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permissions</FormLabel>
                    <FormDescription>
                      Select what this agent is allowed to access
                    </FormDescription>
                    <div className="space-y-2 mt-2">
                      {availablePermissions.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-center space-x-2 border p-2 rounded-md"
                        >
                          <Switch
                            id={`permission-${permission.id}`}
                            checked={field.value.includes(permission.id)}
                            onCheckedChange={(checked) => {
                              const updatedPermissions = checked
                                ? [...field.value, permission.id]
                                : field.value.filter(
                                    (id) => id !== permission.id
                                  );
                              field.onChange(updatedPermissions);
                            }}
                          />
                          <div className="grid gap-1">
                            <label
                              htmlFor={`permission-${permission.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {permission.name}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <CardFooter className="flex justify-between pt-6">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit">
              {initialData ? "Update Agent" : "Create Agent"}
            </Button>
          </CardFooter>
        </div>
      </form>
    </Form>
  );
}
