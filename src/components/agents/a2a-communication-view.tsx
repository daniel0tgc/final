import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Network, ArrowDownIcon, ArrowUpIcon, TrashIcon } from 'lucide-react';
import { Agent } from '@/types';
import { A2ACommunication, A2AMessage } from '@/lib/a2a-communication';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface A2ACommunicationViewProps {
  agent: Agent;
  allAgents: Agent[];
}

export function A2ACommunicationView({ agent, allAgents }: A2ACommunicationViewProps) {
  const [messages, setMessages] = useState<A2AMessage[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'sent' | 'received'>('all');
  
  // Load messages when component mounts or agent changes
  useEffect(() => {
    loadMessages();
    
    // Set up interval to refresh messages
    const interval = setInterval(loadMessages, 5000);
    
    return () => clearInterval(interval);
  }, [agent.id, selectedAgentId, activeTab]);
  
  const loadMessages = () => {
    try {
      let filteredMessages: A2AMessage[] = [];
      
      if (selectedAgentId === 'all') {
        // Get all messages for this agent
        filteredMessages = A2ACommunication.getAgentLogs(agent.id);
      } else {
        // Get conversation between these two specific agents
        filteredMessages = A2ACommunication.getConversation(agent.id, selectedAgentId);
      }
      
      // Filter based on active tab
      if (activeTab === 'sent') {
        filteredMessages = filteredMessages.filter(msg => msg.sourceAgentId === agent.id);
      } else if (activeTab === 'received') {
        filteredMessages = filteredMessages.filter(msg => msg.targetAgentId === agent.id);
      }
      
      // Sort by newest first
      filteredMessages.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setMessages(filteredMessages);
    } catch (error) {
      console.error('Error loading A2A messages:', error);
    }
  };
  
  const handleDeleteMessage = (messageId: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      const success = A2ACommunication.deleteMessage(messageId, agent.id);
      if (success) {
        // Remove from UI
        setMessages(messages.filter(msg => msg.id !== messageId));
      }
    }
  };
  
  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all communication logs for this agent?')) {
      const success = A2ACommunication.clearLogs(agent.id);
      if (success) {
        setMessages([]);
      }
    }
  };
  
  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'MMM d, h:mm a');
  };
  
  // Find agent name by ID
  const getAgentName = (agentId: string) => {
    const agent = allAgents.find(a => a.id === agentId);
    return agent ? agent.config.name : 'Unknown Agent';
  };
  
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
        <Tabs defaultValue="all" onValueChange={(value) => setActiveTab(value as any)}>
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
              .filter(a => a.id !== agent.id)
              .map(a => (
                <option key={a.id} value={a.id}>
                  {a.config.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full">
          {messages.length > 0 ? (
            <div className="p-4 space-y-4">
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`p-3 border rounded-md ${
                    message.status === 'error' ? 'border-red-300 bg-red-50' : 
                    message.sourceAgentId === agent.id ? 'border-blue-100' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {message.sourceAgentId === agent.id ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 flex items-center gap-1">
                          <ArrowUpIcon size={12} />
                          Sent
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 flex items-center gap-1">
                          <ArrowDownIcon size={12} />
                          Received
                        </Badge>
                      )}
                      
                      {message.status !== 'success' && (
                        <Badge variant={message.status === 'pending' ? 'outline' : 'destructive'}>
                          {message.status}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.timestamp)}
                      </span>
                      <button 
                        onClick={() => handleDeleteMessage(message.id)} 
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex text-xs text-muted-foreground mb-2">
                    <div className="flex-1">
                      <strong>From:</strong> {message.sourceAgentName || getAgentName(message.sourceAgentId)}
                    </div>
                    <div className="flex-1">
                      <strong>To:</strong> {message.targetAgentName || getAgentName(message.targetAgentId)}
                    </div>
                  </div>
                  
                  <p className="text-sm whitespace-pre-wrap border-l-2 pl-3 my-2 border-muted">
                    {message.message}
                  </p>
                  
                  {message.error && (
                    <p className="text-xs text-red-500 mt-1">
                      Error: {message.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <Network size={24} className="mb-2 opacity-50" />
              <p>{activeTab === 'all' ? 'No messages found' : 
                 activeTab === 'sent' ? 'No outgoing messages' : 'No incoming messages'}</p>
              <p className="text-sm mt-1">
                {selectedAgentId === 'all' 
                  ? 'This agent hasn\'t communicated with other agents yet'
                  : `No communication with ${getAgentName(selectedAgentId)}`
                }
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}