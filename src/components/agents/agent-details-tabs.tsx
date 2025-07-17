import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentMemoryView } from './agent-memory-view';
import { A2ACommunicationView } from './a2a-communication-view';
import { A2AMessageComposer } from './a2a-message-composer';
import { Agent } from '@/types';

interface AgentDetailsTabsProps {
  agent: Agent;
}

export function AgentDetailsTabs({ agent }: AgentDetailsTabsProps) {
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  
  useEffect(() => {
    // Load all agents for A2A communication
    const loadAgents = () => {
      try {
        const storedAgents = localStorage.getItem('agents');
        if (storedAgents) {
          setAllAgents(JSON.parse(storedAgents));
        }
      } catch (error) {
        console.error('Error loading agents:', error);
      }
    };
    
    loadAgents();
  }, []);

  return (
    <Tabs defaultValue="memory" className="mt-6">
      <TabsList className="grid grid-cols-3 w-full max-w-md">
        <TabsTrigger value="memory">Memory</TabsTrigger>
        <TabsTrigger value="a2a">A2A Communication</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      
      <TabsContent value="memory" className="mt-4">
        <AgentMemoryView agent={agent} />
      </TabsContent>
      
      <TabsContent value="a2a" className="mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <A2ACommunicationView agent={agent} allAgents={allAgents} />
          </div>
          
          <div className="lg:col-span-1">
            <A2AMessageComposer 
              sourceAgent={agent} 
              allAgents={allAgents} 
            />
          </div>
        </div>
      </TabsContent>
      
      <TabsContent value="settings" className="mt-4">
        <div className="bg-muted/50 border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">Agent Settings</h3>
          <p className="text-muted-foreground">
            Advanced agent configuration options will be available here in a future update.
          </p>
          <div className="mt-4 space-y-4">
            <div className="bg-background border rounded p-4">
              <h4 className="font-medium mb-2">Agent Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">ID:</div>
                <div className="font-mono">{agent.id}</div>
                
                <div className="text-muted-foreground">Type:</div>
                <div>{agent.config.type}</div>
                
                <div className="text-muted-foreground">Created:</div>
                <div>{new Date(agent.createdAt).toLocaleDateString()}</div>
                
                <div className="text-muted-foreground">Deployment:</div>
                <div>{agent.deploymentType}</div>
                
                <div className="text-muted-foreground">Current Status:</div>
                <div>{agent.status}</div>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}