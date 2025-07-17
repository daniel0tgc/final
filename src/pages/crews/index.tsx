import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Crew, Agent } from '@/types';
import { Plus, Users, Settings, User, Play, Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function CrewsPage() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  
  useEffect(() => {
    // Load crews from localStorage
    const loadCrews = () => {
      try {
        const storedCrews = localStorage.getItem('crews');
        if (storedCrews) {
          setCrews(JSON.parse(storedCrews));
        }
      } catch (error) {
        console.error('Error loading crews:', error);
      }
    };
    
    // Load agents for member lookup
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
    
    loadCrews();
    loadAgents();
  }, []);
  
  // Find agent name by ID
  const getAgentName = (agentId: string) => {
    const agent = agents.find(agent => agent.id === agentId);
    return agent?.config.name || 'Unknown Agent';
  };
  
  // Toggle crew status
  const toggleCrewStatus = (crewId: string) => {
    setCrews(prevCrews => {
      const updatedCrews = prevCrews.map(crew => {
        if (crew.id === crewId) {
          const newStatus = crew.status === 'active' ? 'stopped' : 'active';
          return {...crew, status: newStatus};
        }
        return crew;
      });
      
      // Update localStorage
      localStorage.setItem('crews', JSON.stringify(updatedCrews));
      return updatedCrews;
    });
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Crews</h1>
          <p className="text-muted-foreground">Create and manage agent crews.</p>
        </div>
        <Button asChild>
          <Link to="/crews/new">
            <Plus className="mr-2 h-4 w-4" /> Create New Crew
          </Link>
        </Button>
      </div>
      
      {crews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No Crews Found</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            You haven't created any agent crews yet. Create your first crew to enhance collaborative agent capabilities.
          </p>
          <Button asChild>
            <Link to="/crews/new">
              <Plus className="mr-2 h-4 w-4" /> Create New Crew
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {crews.map(crew => (
            <Card key={crew.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users size={20} />
                      {crew.config.name}
                    </CardTitle>
                    <CardDescription>{crew.config.description}</CardDescription>
                  </div>
                  <Badge variant={crew.status === 'active' ? 'default' : 'outline'}>
                    {crew.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Objective</h3>
                    <p className="text-sm text-muted-foreground">{crew.config.objective}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Workflow</h3>
                    <Badge variant="secondary">{crew.config.workflowType}</Badge>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Members ({crew.members.length})</h3>
                    <ScrollArea className="h-24">
                      <div className="space-y-2">
                        {crew.members.map(member => (
                          <div key={member.agentId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <User size={14} />
                              <span className="text-sm">{getAgentName(member.agentId)}</span>
                            </div>
                            <Badge variant="outline">{member.role}</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t p-4 pt-4 flex justify-between">
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => toggleCrewStatus(crew.id)}
                >
                  {crew.status === 'active' ? (
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
                  variant="outline" 
                  asChild
                >
                  <Link to={`/crews/details/${crew.id}`}>
                    <Settings size={16} className="mr-1" />
                    Details
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}