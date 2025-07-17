import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Agent } from '@/types';
import { Bot, Plus, Settings, MessageSquare, Play, Pause, ExternalLink } from 'lucide-react';
import { AgentExecution } from '@/lib/agent-execution';
import { AgentChatDrawer } from '@/components/agents/agent-chat-drawer';
import { format } from 'date-fns';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  
  useEffect(() => {
    // Load agents from localStorage
    const loadAgents = () => {
      try {
        const storedAgents = localStorage.getItem('agents');
        if (storedAgents) {
          setAgents(JSON.parse(storedAgents));
        }
      } catch (error) {
        console.error('Error loading agents:', error);
      }
    };
    
    loadAgents();
  }, []);
  
  // Toggle agent status
  const toggleAgentStatus = (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'stopped' : 'active';
    
    // Start or stop agent in execution engine
    if (newStatus === 'active') {
      AgentExecution.startAgent({...agent, status: newStatus});
    } else {
      AgentExecution.stopAgent(agent.id);
    }
    
    // Update agent in state
    const updatedAgents = agents.map(a => {
      if (a.id === agent.id) {
        return {...a, status: newStatus};
      }
      return a;
    });
    
    setAgents(updatedAgents);
    
    // Update in localStorage
    localStorage.setItem('agents', JSON.stringify(updatedAgents));
  };
  
  // Open chat with an agent
  const openAgentChat = (agent: Agent) => {
    setSelectedAgent(agent);
    setChatDrawerOpen(true);
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">Deploy and manage your AI agents.</p>
        </div>
        <Button asChild>
          <Link to="/agents/new">
            <Plus className="mr-2 h-4 w-4" /> Deploy New Agent
          </Link>
        </Button>
      </div>
      
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No Agents Found</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            You haven't deployed any agents yet. Get started by deploying your first agent.
          </p>
          <Button asChild>
            <Link to="/agents/new">
              <Plus className="mr-2 h-4 w-4" /> Deploy New Agent
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map(agent => (
            <Card key={agent.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bot size={20} />
                      {agent.config.name}
                    </CardTitle>
                    <CardDescription>{agent.config.description}</CardDescription>
                  </div>
                  <Badge variant={agent.status === 'active' ? 'default' : 'outline'}>
                    {agent.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">{agent.config.type}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Deployment:</span>
                    <span className="font-medium">
                      {agent.deploymentType === 'local' ? (
                        'Local'
                      ) : (
                        <div className="flex items-center">
                          <span className="mr-1">MCP</span>
                          <ExternalLink size={12} />
                        </div>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">{formatDate(agent.createdAt)}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mt-2">
                    {agent.config.features?.memory && (
                      <Badge variant="outline" className="text-xs">Memory</Badge>
                    )}
                    {agent.config.features?.a2a && (
                      <Badge variant="outline" className="text-xs">A2A Comm</Badge>
                    )}
                    {agent.config.features?.websearch && (
                      <Badge variant="outline" className="text-xs">Web Search</Badge>
                    )}
                    {agent.config.features?.fileStorage && (
                      <Badge variant="outline" className="text-xs">File Storage</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t p-4 pt-4 flex justify-between">
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => toggleAgentStatus(agent)}
                  >
                    {agent.status === 'active' ? (
                      <>
                        <Pause size={16} className="mr-1" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play size={16} className="mr-1" />
                        Start
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => openAgentChat(agent)}
                  >
                    <MessageSquare size={16} className="mr-1" />
                    Chat
                  </Button>
                </div>
                
                <Button 
                  size="sm" 
                  variant="outline" 
                  asChild
                >
                  <Link to={`/agents/details/${agent.id}`}>
                    <Settings size={16} className="mr-1" />
                    Details
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      {/* Chat drawer */}
      <AgentChatDrawer 
        agent={selectedAgent}
        open={chatDrawerOpen}
        onOpenChange={setChatDrawerOpen}
      />
    </div>
  );
}