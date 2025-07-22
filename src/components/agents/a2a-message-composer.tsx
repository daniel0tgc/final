import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Agent } from "@/types";
import { Network, Send, Loader2 } from "lucide-react";
import { agentToolRegistry } from "@/lib/agent-tools";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentMemory } from "@/lib/agent-memory";

interface A2AMessageComposerProps {
  sourceAgent: Agent;
  allAgents: Agent[];
  onMessageSent?: () => void;
}

export function A2AMessageComposer({
  sourceAgent,
  allAgents,
  onMessageSent,
}: A2AMessageComposerProps) {
  const [targetAgentId, setTargetAgentId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (!targetAgentId || !message.trim() || isSending) return;

    setIsSending(true);
    try {
      await agentToolRegistry.SEND_MESSAGE(
        {
          to_id: targetAgentId,
          message,
        },
        { agent: sourceAgent }
      );

      // Add an observation to agent memory
      AgentMemory.addMemory(sourceAgent.id, {
        type: "observation",
        content: `Message sent to ${
          allAgents.find((a) => a.id === targetAgentId)?.config.name
        }: ${message}`,
        importance: 6,
      });

      // Clear form after successful send
      setMessage("");

      // Callback to refresh parent components if needed
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (error) {
      console.error("Error sending A2A message:", error);
      alert("Failed to send message to agent");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Network size={18} />
          Send Agent-to-Agent Message
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            From: <span className="font-bold">{sourceAgent.config.name}</span>
          </label>
        </div>

        <div>
          <label
            htmlFor="targetAgent"
            className="block text-sm font-medium mb-1"
          >
            To:
          </label>
          <select
            id="targetAgent"
            className="w-full p-2 border rounded-md"
            value={targetAgentId}
            onChange={(e) => setTargetAgentId(e.target.value)}
            disabled={isSending}
          >
            <option value="">Select an agent...</option>
            {allAgents
              .filter((agent) => agent.id !== sourceAgent.id)
              .map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.config.name} ({agent.config.type})
                </option>
              ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="messageContent"
            className="block text-sm font-medium mb-1"
          >
            Message:
          </label>
          <Textarea
            id="messageContent"
            placeholder="Enter your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSending}
            rows={4}
            className="resize-none"
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleSendMessage}
          disabled={!targetAgentId || !message.trim() || isSending}
          className="w-full"
        >
          {isSending ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send size={16} className="mr-2" />
              Send Message
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
