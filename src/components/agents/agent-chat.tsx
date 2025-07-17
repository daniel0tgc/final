import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Agent } from "@/types";
import {
  Send,
  Bot,
  User,
  Play,
  StopCircle,
  Loader,
  ListTodo,
} from "lucide-react";
import { AgentExecution, AgentMessage } from "@/lib/agent-execution";
import { AgentMemory } from "@/lib/agent-memory";

interface AgentChatProps {
  agent: Agent;
  onStatusChange?: (agentId: string, status: Agent["status"]) => void;
}

export function AgentChat({ agent, onStatusChange }: AgentChatProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoTask, setAutoTask] = useState("");
  const [isRunningTask, setIsRunningTask] = useState(false);
  const [thoughtSteps, setThoughtSteps] = useState<string[]>([]);
  const [showThoughts, setShowThoughts] = useState(false);

  // Load conversation history when component mounts
  useEffect(() => {
    const conversation = AgentExecution.getConversation(agent.id);
    setMessages(conversation.messages.filter((m) => m.role !== "system"));
    setIsActive(AgentExecution.isAgentActive(agent.id));
  }, [agent.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Ensure agent is active
    if (!isActive) {
      await handleToggleAgent();
    }

    setIsLoading(true);
    setThoughtSteps(["Received input", "Analyzing message..."]);
    try {
      // Add user message to UI immediately
      const userMsg: AgentMessage = {
        role: "user",
        content: inputMessage,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Clear input
      setInputMessage("");

      // Simulate step: tool detection
      setThoughtSteps((prev) => [...prev, "Checking for tool calls..."]);
      // Send to agent and get response (with tool call detection)
      const response = await AgentExecution.sendMessage(
        agent.id,
        userMsg.content,
        (step) => setThoughtSteps((prev) => [...prev, step])
      );

      // Update messages with agent response
      setMessages((prev) => [...prev, response]);
      setThoughtSteps([]);
    } catch (error) {
      console.error("Error sending message:", error);
      setThoughtSteps(["Error occurred while processing."]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAgent = async () => {
    try {
      if (isActive) {
        // Stop agent
        const updatedAgent = await AgentExecution.stopAgent(agent);
        setIsActive(false);
        if (onStatusChange) {
          onStatusChange(agent.id, updatedAgent.status);
        }
      } else {
        // Start agent
        const updatedAgent = await AgentExecution.startAgent(agent);
        setIsActive(true);
        if (onStatusChange) {
          onStatusChange(agent.id, updatedAgent.status);
        }

        // Add system message if first time starting
        if (messages.length === 0) {
          setMessages([
            {
              role: "system",
              content: `I am ${agent.config.name}, ready to assist you.`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Error toggling agent:", error);
    }
  };

  const handleRunTask = async () => {
    if (!autoTask.trim() || isRunningTask) return;

    setIsRunningTask(true);
    try {
      // Ensure agent is active
      if (!isActive) {
        await handleToggleAgent();
      }

      // Add task message to UI
      const taskMsg: AgentMessage = {
        role: "user",
        content: `Run autonomous task: ${autoTask}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, taskMsg]);

      // Run the task
      const result = await AgentExecution.runAutonomousTask(agent, autoTask);

      // Add result to messages
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: result,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Clear task input
      setAutoTask("");
    } catch (error) {
      console.error("Error running task:", error);
    } finally {
      setIsRunningTask(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Bot size={18} />
            <span>{agent.config.name}</span>
          </CardTitle>

          <Button
            variant={isActive ? "destructive" : "default"}
            size="sm"
            onClick={handleToggleAgent}
            className="gap-1"
          >
            {isActive ? (
              <>
                <StopCircle size={16} /> Stop Agent
              </>
            ) : (
              <>
                <Play size={16} /> Start Agent
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowThoughts((v) => !v)}
              >
                {showThoughts ? "Hide Thoughts" : "Show Thoughts"}
              </Button>
            </div>
            {messages
              .filter((m) => showThoughts || m.role !== "system")
              .map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-lg max-w-[80%] ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : message.role === "system"
                        ? "bg-muted text-muted-foreground text-center w-full"
                        : "bg-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {message.role === "user" ? (
                        <User size={14} />
                      ) : message.role === "agent" ? (
                        <Bot size={14} />
                      ) : null}
                      <span className="text-xs opacity-70">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}

            {isLoading && (
              <div className="flex flex-col items-start gap-2 p-3 rounded-lg bg-secondary">
                <Loader size={16} className="animate-spin" />
                <span>Thinking...</span>
                <ul className="list-disc ml-4 text-xs text-muted-foreground animate-pulse">
                  {thoughtSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <div className="p-4 border-t">
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Specify an autonomous task..."
            value={autoTask}
            onChange={(e) => setAutoTask(e.target.value)}
            disabled={isRunningTask || !isActive}
          />
          <Button
            size="icon"
            onClick={handleRunTask}
            disabled={isRunningTask || !isActive || !autoTask.trim()}
          >
            {isRunningTask ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <ListTodo size={16} />
            )}
          </Button>
        </div>
      </div>

      <CardFooter className="pt-0">
        <div className="flex items-center w-full gap-2">
          <Input
            placeholder={
              isActive ? "Type a message..." : "Start the agent to chat"
            }
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={!isActive || isLoading}
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={!isActive || isLoading || !inputMessage.trim()}
          >
            {isLoading ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
