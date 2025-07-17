import { useState, useEffect, useRef } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, X, User, Loader2 } from "lucide-react";
import { Agent } from "@/types";
import { AgentExecution, AgentMessage } from "@/lib/agent-execution";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface AgentChatDrawerProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentChatDrawer({
  agent,
  open,
  onOpenChange,
}: AgentChatDrawerProps) {
  const [userMessage, setUserMessage] = useState("");
  const [conversation, setConversation] = useState<AgentMessage[]>([]);
  const [isAgentResponding, setIsAgentResponding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation when agent changes or drawer opens
  useEffect(() => {
    if (agent && open) {
      loadConversation();
    }
  }, [agent, open]);

  // Scroll to bottom when conversation updates
  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  // Load conversation from agent execution
  const loadConversation = () => {
    if (!agent) return;

    try {
      const agentConversation = AgentExecution.getConversation(agent.id);
      // Filter out system messages for display
      setConversation(
        agentConversation.messages.filter((msg) => msg.role !== "system")
      );
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Send message to agent
  const handleSendMessage = async () => {
    if (!agent || !userMessage.trim() || isAgentResponding) return;

    // Check if agent is active
    if (agent.status !== "active") {
      // Start the agent if it's not active
      AgentExecution.startAgent(agent);
    }

    setIsAgentResponding(true);

    try {
      // Add message to UI immediately
      setConversation((prev) => [
        ...prev,
        {
          role: "user",
          content: userMessage,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Clear input
      setUserMessage("");

      // Get response from agent
      const response = await AgentExecution.sendMessage(agent.id, userMessage);

      // Add response to conversation
      setConversation((prev) => [...prev, response]);
    } catch (error) {
      console.error("Error sending message:", error);

      // Show error in UI
      setConversation((prev) => [
        ...prev,
        {
          role: "agent",
          content: "Sorry, I encountered an error processing your request.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsAgentResponding(false);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), "h:mm a");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Chat Panel */}
      <div className="fixed right-0 top-0 h-full w-[600px] lg:w-[700px] bg-background border-l shadow-lg flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between">
          <div className="flex items-center">
            <Bot className="mr-2 h-5 w-5" />
            <h2 className="text-lg font-semibold">
              {agent?.config.name || "Agent Chat"}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="hover:bg-muted p-1 rounded-sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {agent ? (
          <>
            <ScrollArea className="flex-1 p-4">
              {conversation.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    Start a conversation
                  </h3>
                  <p className="text-muted-foreground max-w-sm">
                    Send a message to start chatting with {agent.config.name}.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversation.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === "agent"
                          ? "justify-start"
                          : "justify-end"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.role === "agent"
                            ? "bg-muted text-foreground border"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        <div className="flex items-center mb-1 text-xs">
                          {message.role === "agent" ? (
                            <>
                              <Bot className="h-3 w-3 mr-1" />
                              <span>{agent.config.name}</span>
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3 mr-1" />
                              <span>You</span>
                            </>
                          )}
                          <span className="ml-auto">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <Separator />

            {/* Footer */}
            <div className="mt-auto p-4 pt-2 border-t">
              <div className="flex gap-3">
                <Textarea
                  placeholder="Type your message..."
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="min-h-[80px] max-h-[120px] flex-1 resize-none"
                  disabled={isAgentResponding}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!userMessage.trim() || isAgentResponding}
                  className="self-end h-[80px] w-[60px] flex-shrink-0"
                >
                  {isAgentResponding ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {agent.status === "active"
                  ? "Agent is active and ready to respond"
                  : "Agent is currently stopped. Sending a message will activate it."}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No agent selected</p>
          </div>
        )}
      </div>
    </div>
  );
}
