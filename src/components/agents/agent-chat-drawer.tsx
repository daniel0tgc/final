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
import { Bot, Send, X, User, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { Agent } from "@/types";
import { AgentExecution, AgentMessage } from "@/lib/agent-execution";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const [thoughtSteps, setThoughtSteps] = useState<string[]>([]);
  const [showThoughts, setShowThoughts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation when agent changes or drawer opens
  useEffect(() => {
    if (agent && open) {
      const loadConversation = async () => {
        setLoading(true);
        try {
          const agentConversation = await AgentExecution.getConversation(
            agent.id
          );
          setConversation(
            agentConversation.messages.filter((msg) => msg.role !== "system")
          );
        } catch (error) {
          setConversation([]);
        } finally {
          setLoading(false);
        }
      };
      loadConversation();
      loadPendingApprovals();
    }
  }, [agent, open]);

  // Load pending approvals for this agent
  const loadPendingApprovals = async () => {
    if (!agent) return;
    
    try {
      const response = await fetch(`/api/approvals/pending?agentId=${agent.id}`);
      if (response.ok) {
        const approvals = await response.json();
        setPendingApprovals(approvals);
      }
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
    }
  };

  // Handle tool approval
  const handleToolApproval = async (approvalId: string, approved: boolean, reason?: string) => {
    try {
      const result = await AgentExecution.approveToolCall(approvalId, approved, reason);
      
      if (result.success) {
        // Remove from pending approvals
        setPendingApprovals(prev => prev.filter(approval => approval.id !== approvalId));
        
        // Refresh conversation to show updated results
        if (agent) {
          const agentConversation = await AgentExecution.getConversation(agent.id);
          setConversation(
            agentConversation.messages.filter((msg) => msg.role !== "system")
          );
        }
      }
    } catch (error) {
      console.error('Failed to process approval:', error);
    }
  };

  // Scroll to bottom when conversation updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Send message to agent
  const handleSendMessage = async () => {
    if (!agent || !userMessage.trim() || isAgentResponding) return;
    if (agent.status !== "active") {
      await AgentExecution.startAgent(agent);
    }
    setIsAgentResponding(true);
    setThoughtSteps(["Received input", "Analyzing message..."]);
    try {
      setConversation((prev) => [
        ...prev,
        {
          role: "user",
          content: userMessage,
          timestamp: new Date().toISOString(),
        },
      ]);
      setUserMessage("");
      const response = await AgentExecution.sendMessage(
        agent.id,
        userMessage,
        (step) => setThoughtSteps((prev) => [...prev, step])
      );
      setConversation((prev) => [...prev, response]);
      setThoughtSteps([]);
    } catch (error) {
      setConversation((prev) => [
        ...prev,
        {
          role: "agent",
          content: "Sorry, I encountered an error processing your request.",
          timestamp: new Date().toISOString(),
        },
      ]);
      setThoughtSteps(["Error occurred while processing."]);
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
          <div className="flex items-center gap-2">
            <Bot className="mr-2 h-5 w-5" />
            <h2 className="text-lg font-semibold">
              {agent?.config.name || "Agent Chat"}
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowThoughts((v) => !v)}
              className="ml-2"
            >
              {showThoughts ? "Hide Thoughts" : "Show Thoughts"}
            </Button>
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
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <Loader2 size={24} className="mb-2 animate-spin opacity-50" />
                <p>Loading chat...</p>
              </div>
            ) : (
              <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col space-y-4">
                  {/* Pending Approvals Section */}
                  {pendingApprovals.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-orange-600 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Pending Tool Approvals ({pendingApprovals.length})
                      </h4>
                      {pendingApprovals.map((approval) => (
                        <Card key={approval.id} className="border-orange-200 bg-orange-50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center justify-between">
                              <span>Tool: {approval.toolCall.tool_call}</span>
                              <Badge variant="outline" className="text-orange-600">
                                Pending Approval
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <p className="text-xs font-medium text-gray-600 mb-1">Arguments:</p>
                              <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                                {JSON.stringify(approval.toolCall.args, null, 2)}
                              </pre>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleToolApproval(approval.id, true, 'Approved by user')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToolApproval(approval.id, false, 'Rejected by user')}
                                className="border-red-500 text-red-600 hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Chat Messages */}
                  {(showThoughts
                    ? conversation
                    : conversation.filter((msg) => msg.role !== "system")
                  ).map((message, index) => (
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
                            : message.role === "system"
                            ? "bg-muted text-muted-foreground text-center w-full"
                            : "bg-primary text-primary-foreground"
                        }`}
                      >
                        <div className="flex items-center mb-1 text-xs">
                          {message.role === "agent" ? (
                            <>
                              <Bot className="h-3 w-3 mr-1" />
                              <span>{agent?.config.name}</span>
                            </>
                          ) : message.role === "user" ? (
                            <>
                              <User className="h-3 w-3 mr-1" />
                              <span>You</span>
                            </>
                          ) : null}
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
                  {isAgentResponding && (
                    <div className="flex flex-col items-start gap-2 p-3 rounded-lg bg-secondary">
                      <Loader2 size={16} className="animate-spin" />
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
            )}
            {/* Footer: Always show input, send button, and thoughts toggle when agent is selected */}
            <Separator />
            <div className="mt-auto p-4 pt-2 border-t">
              <div className="flex gap-3 items-end">
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
                  className="h-[80px] w-[60px] flex-shrink-0"
                >
                  <Send className="h-5 w-5" />
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
          <div className="p-4 text-center">
            <p>Select an agent to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
}
