import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Network, ArrowDownIcon, ArrowUpIcon, TrashIcon } from "lucide-react";
import { Agent } from "@/types";
import { getCrossAgentLogs } from "@/lib/a2a-communication";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface A2ACommunicationViewProps {
  agent: Agent;
  allAgents: Agent[];
}

export function A2ACommunicationView({
  agent,
  allAgents,
}: A2ACommunicationViewProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | "all">("all");
  const [activeTab, setActiveTab] = useState<"all" | "sent" | "received">(
    "all"
  );
  const [loading, setLoading] = useState(false);

  // Load messages when component mounts or agent changes
  useEffect(() => {
    loadMessages();

    // Set up interval to refresh messages
    const interval = setInterval(loadMessages, 5000);

    return () => clearInterval(interval);
  }, [agent.id, selectedAgentId, activeTab]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      let filteredMessages: any[] = [];

      // Fetch cross-agent logs from long-term memory
      const allLogs = await getCrossAgentLogs(agent.id);
      if (selectedAgentId === "all") {
        filteredMessages = allLogs;
      } else {
        filteredMessages = allLogs.filter(
          (msg) =>
            (msg.from === selectedAgentId && msg.to === agent.id) ||
            (msg.from === agent.id && msg.to === selectedAgentId)
        );
      }

      // Filter based on active tab
      if (activeTab === "sent") {
        filteredMessages = filteredMessages.filter(
          (msg) => msg.from === agent.id
        );
      } else if (activeTab === "received") {
        filteredMessages = filteredMessages.filter(
          (msg) => msg.to === agent.id
        );
      }

      filteredMessages.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setMessages(filteredMessages);
    } catch (error) {
      console.error("Error loading cross-agent messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      // Placeholder for actual deletion logic
      console.log(`Attempting to delete message with ID: ${messageId}`);
      // In a real app, you would call an API to delete the message
      // For now, we'll just remove it from the UI if the placeholder works
      setMessages(messages.filter((msg) => msg.id !== messageId));
    }
  };

  const handleClearLogs = async () => {
    if (
      confirm(
        "Are you sure you want to clear all communication logs for this agent?"
      )
    ) {
      // Placeholder for actual clearing logic
      console.log(`Attempting to clear logs for agent with ID: ${agent.id}`);
      // In a real app, you would call an API to clear logs
      // For now, we'll just remove all messages from the UI
      setMessages([]);
    }
  };

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), "MMM d, h:mm a");
  };

  // Helper to get agent name from ID
  function getAgentName(agentId: string, allAgents: any[]): string {
    return allAgents.find((a) => a.id === agentId)?.config.name || agentId;
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Network size={18} />
            Agent-to-Agent Communication
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearLogs}
                  className="h-8"
                >
                  <TrashIcon size={14} className="mr-1" />
                  Clear Logs
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete all communication logs for this agent</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <div className="px-4 pb-2">
        <Tabs
          defaultValue="all"
          onValueChange={(value) => setActiveTab(value as any)}
        >
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="received">Received</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="my-2">
          <select
            className="w-full p-2 border rounded-md text-sm"
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
          >
            <option value="all">All Agents</option>
            {allAgents
              .filter((a) => a.id !== agent.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.config.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <Network size={24} className="mb-2 opacity-50" />
              <p>Loading messages...</p>
            </div>
          ) : messages.length > 0 ? (
            <div className="p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.timestamp + msg.from + msg.to + msg.direction}
                  className="mb-2 p-2 border rounded-md"
                >
                  <div className="text-xs text-gray-500 mb-1">
                    <span className="font-semibold">
                      {getAgentName(msg.from, allAgents)}
                    </span>
                    {msg.direction === "response"
                      ? " responded to "
                      : msg.direction === "sent"
                      ? " sent to "
                      : " to "}
                    <span className="font-semibold">
                      {getAgentName(msg.to, allAgents)}
                    </span>
                    <span className="ml-2">
                      {new Date(msg.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-line">
                    {msg.message}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {msg.direction}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <Network size={24} className="mb-2 opacity-50" />
              <p>
                {activeTab === "all"
                  ? "No messages found"
                  : activeTab === "sent"
                  ? "No outgoing messages"
                  : "No incoming messages"}
              </p>
              <p className="text-sm mt-1">
                {selectedAgentId === "all"
                  ? "This agent hasn't communicated with other agents yet"
                  : `No communication with ${getAgentName(
                      selectedAgentId,
                      allAgents
                    )}`}
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
