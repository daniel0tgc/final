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
  const [loading, setLoading] = useState(false);
  const [maxDepth, setMaxDepth] = useState(2);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [lastDepth, setLastDepth] = useState<number>(2);

  // Load conversation history when component mounts
  useEffect(() => {
    const loadChat = async () => {
      setLoading(true);
      try {
        const conversation = await AgentExecution.getConversation(agent.id);
        setMessages(conversation.messages.filter((m) => m.role !== "system"));
        const active = await AgentExecution.isAgentActive(agent.id);
        setIsActive(active);
      } catch (error) {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };
    loadChat();
  }, [agent.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
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
      setInputMessage("");
      setThoughtSteps((prev) => [...prev, "Checking for tool calls..."]);
      setLastUserMessage(userMsg.content);
      setLastDepth(maxDepth);
      // Send to agent and get response (with tool call detection)
      const response = await AgentExecution.sendMessage(
        agent.id,
        userMsg.content,
        (step) => setThoughtSteps((prev) => [...prev, step]),
        0,
        maxDepth
      );
      setMessages((prev) => [...prev, response]);
      setThoughtSteps([]);
    } catch (error) {
      setThoughtSteps(["Error occurred while processing."]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for 'Continue' button when maxDepth is reached
  const handleContinue = async () => {
    if (!lastUserMessage) return;
    setIsLoading(true);
    setThoughtSteps(["Continuing conversation..."]);
    try {
      const newDepth = lastDepth + 2;
      setMaxDepth(newDepth);
      setLastDepth(newDepth);
      const response = await AgentExecution.sendMessage(
        agent.id,
        lastUserMessage,
        (step) => setThoughtSteps((prev) => [...prev, step]),
        0,
        newDepth
      );
      setMessages((prev) => [...prev, response]);
      setThoughtSteps([]);
    } catch (error) {
      setThoughtSteps(["Error occurred while continuing."]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAgent = async () => {
    try {
      if (isActive) {
        const updatedAgent = await AgentExecution.stopAgent(agent);
        setIsActive(false);
        if (onStatusChange) {
          onStatusChange(agent.id, updatedAgent.status);
        }
      } else {
        const updatedAgent = await AgentExecution.startAgent(agent);
        setIsActive(true);
        if (onStatusChange) {
          onStatusChange(agent.id, updatedAgent.status);
        }
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
    } catch (error) {}
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
        <div className="flex items-center justify-between gap-4 w-full">
          <CardTitle className="flex items-center gap-2">
            <Bot size={18} />
            <span>{agent.config.name}</span>
          </CardTitle>
          <Button
            size="sm"
            className="mx-2 bg-gray-300 text-gray-800 hover:bg-gray-400 border-none shadow-none"
            onClick={() => setShowThoughts((v) => !v)}
          >
            {showThoughts ? "Hide Thoughts" : "Show Thoughts"}
          </Button>
          <Button
            variant={isActive ? "destructive" : "default"}
            size="sm"
            onClick={handleToggleAgent}
            className="gap-1 ml-2"
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
      {/* Max Depth input row, always visible below header */}
      <div className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
        <label htmlFor="maxDepth" className="text-xs text-gray-500">
          Max A2A Depth:
        </label>
        <input
          id="maxDepth"
          type="number"
          min={1}
          max={10}
          value={maxDepth}
          onChange={(e) => setMaxDepth(Number(e.target.value))}
          className="w-16 border rounded px-1 py-0.5 text-xs"
        />
        <span className="text-xs text-gray-400">(Current: {maxDepth})</span>
      </div>

      <CardContent className="p-4 flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="flex flex-col space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <Loader size={24} className="mb-2 animate-spin opacity-50" />
                <p>Loading chat...</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
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
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
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
                        <div className="whitespace-pre-wrap">
                          {message.content}
                          {/* Tool call error feedback */}
                          {message.content &&
                            message.content.includes(
                              "not valid JSON and could not be parsed"
                            ) && (
                              <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-xs">
                                <b>Tool Call Error:</b> The agent tried to use a
                                tool, but its response was not valid JSON and
                                could not be parsed. Please try rephrasing your
                                request or check the agent's configuration.
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
              </>
            )}
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
        {/* Show 'Continue' button if last message hit maxDepth */}
        {messages.length > 0 &&
          messages[messages.length - 1].content?.includes(
            "has reached its current limit"
          ) && (
            <div className="my-2">
              <button
                onClick={handleContinue}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={isLoading}
              >
                Continue Conversation
              </button>
            </div>
          )}
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
