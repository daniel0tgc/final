import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Agent } from '@/types';
import { AgentExecution } from '@/lib/agent-execution';
import { AgentChatDrawer } from '@/components/agents/agent-chat-drawer';
import { AgentDetailsTabs } from '@/components/agents/agent-details-tabs';
import { ArrowLeft, Bot, Play, Pause, MessageSquare, AlertCircle, Terminal } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AgentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [taskResult, setTaskResult] = useState('');
  const [taskInProgress, setTaskInProgress] = useState(false);
  
  useEffect(() => {
    const loadAgent = () => {
      try {
        setIsLoading(true);
        
        // Try to get agent from localStorage
        const storedAgents = localStorage.getItem('agents');
        if (storedAgents) {
          const agents = JSON.parse(storedAgents);
          const foundAgent = agents.find((a: Agent) => a.id === id);
          
          if (foundAgent) {
            setAgent(foundAgent);
          } else {
            setError('Agent not found');
          }
        } else {
          setError('No agents found');
        }
      } catch (error) {
        console.error('Error loading agent:', error);
        setError('Failed to load agent details');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      loadAgent();
    }
  }, [id]);
  
  const toggleAgentStatus = () => {
    if (!agent) return;
    
    const newStatus = agent.status === 'active' ? 'stopped' : 'active';
    
    // Start or stop agent in execution engine
    let updatedAgent;
    if (newStatus === 'active') {
      updatedAgent = AgentExecution.startAgent({...agent, status: newStatus});
    } else {
      updatedAgent = AgentExecution.stopAgent(agent.id);
    }
    
    setAgent(updatedAgent);
    
    // Update in localStorage
    try {
      const storedAgents = localStorage.getItem('agents');
      if (storedAgents) {
        const agents = JSON.parse(storedAgents);
        const updatedAgents = agents.map((a: Agent) => 
          a.id === agent.id ? updatedAgent : a
        );
        localStorage.setItem('agents', JSON.stringify(updatedAgents));
      }
    } catch (error) {
      console.error('Error updating agent status:', error);
    }
  };
  
  const openAgentChat = () => {
    setChatDrawerOpen(true);
  };
  
  const openTaskDrawer = () => {
    setTaskDrawerOpen(true);
  };
  
  const executeTask = async () => {
    if (!agent || !taskInput.trim() || taskInProgress) return;
    
    setTaskInProgress(true);
    setTaskResult('');
    
    try {
      const result = await AgentExecution.runAutonomousTask(agent, taskInput.trim());
      setTaskResult(result);
    } catch (error) {
      console.error('Error executing task:', error);
      setTaskResult(`Error: ${error instanceof Error ? error.message : 'Failed to execute task'}`);
    } finally {
      setTaskInProgress(false);
    }
  };
  
  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center">
            <Bot className="animate-pulse h-8 w-8 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading agent details...</p>
          </div>
        </div>
      </MainLayout>
    );
  }
  
  if (error || !agent) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Agent</h2>
          <p className="text-muted-foreground mb-4">{error || 'Agent not found'}</p>
          <Button variant="outline" onClick={() => navigate('/agents')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Agents
          </Button>
        </div>
      </MainLayout>
    );
  }
  
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header with navigation */}
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/agents')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          <div className="flex-grow">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot size={24} />
              {agent.config.name}
            </h1>
            <p className="text-muted-foreground">{agent.config.description}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={agent.status === 'active' ? 'default' : 'outline'}>
              {agent.status}
            </Badge>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={agent.status === 'active' ? 'secondary' : 'default'}
            onClick={toggleAgentStatus}
          >
            {agent.status === 'active' ? (
              <>
                <Pause size={16} className="mr-2" />
                Stop Agent
              </>
            ) : (
              <>
                <Play size={16} className="mr-2" />
                Start Agent
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={openAgentChat}
          >
            <MessageSquare size={16} className="mr-2" />
            Chat with Agent
          </Button>
          
          <Button 
            variant="outline"
            onClick={openTaskDrawer}
          >
            <Terminal size={16} className="mr-2" />
            Run Task
          </Button>
        </div>
        
        {/* Agent details tabs */}
        <AgentDetailsTabs agent={agent} />
        
        {/* Chat drawer */}
        <AgentChatDrawer 
          agent={agent}
          open={chatDrawerOpen}
          onOpenChange={setChatDrawerOpen}
        />
        
        {/* Task execution dialog */}
        <Dialog open={taskDrawerOpen} onOpenChange={setTaskDrawerOpen}>
          <DialogContent className="sm:max-w-[525px] max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Run Task with {agent.config.name}</DialogTitle>
            </DialogHeader>
            
            <div className="flex flex-col space-y-4 my-4 flex-grow overflow-hidden">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Enter a task for the agent to execute autonomously.
                </p>
                <Textarea
                  placeholder="Enter task description..."
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  className="min-h-[100px]"
                  disabled={taskInProgress}
                />
              </div>
              
              {taskResult && (
                <div className="border rounded-md flex-grow overflow-hidden">
                  <div className="bg-muted py-1 px-3 text-sm font-medium border-b">
                    Task Result
                  </div>
                  <ScrollArea className="max-h-[250px]">
                    <div className="p-4 whitespace-pre-wrap">
                      {taskResult}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setTaskDrawerOpen(false)}>
                Close
              </Button>
              <Button 
                onClick={executeTask} 
                disabled={!taskInput.trim() || taskInProgress}
              >
                {taskInProgress ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <Terminal size={16} className="mr-2" />
                    Execute Task
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}