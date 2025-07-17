import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MCPServer } from '@/types';
import { Plus, Server, Settings, Globe, Activity, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function MCPServersPage() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  
  useEffect(() => {
    // Load MCP servers from localStorage
    const loadServers = () => {
      try {
        const storedServers = localStorage.getItem('mcpServers');
        if (storedServers) {
          setServers(JSON.parse(storedServers));
        }
      } catch (error) {
        console.error('Error loading MCP servers:', error);
      }
    };
    
    loadServers();
  }, []);
  
  // Toggle server status (simulation only)
  const toggleServerStatus = (serverId: string) => {
    setServers(prevServers => {
      const updatedServers = prevServers.map(server => {
        if (server.id === serverId) {
          const newStatus = server.status === 'online' ? 'offline' : 'online';
          return {...server, status: newStatus};
        }
        return server;
      });
      
      // Update localStorage
      localStorage.setItem('mcpServers', JSON.stringify(updatedServers));
      return updatedServers;
    });
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Servers</h1>
          <p className="text-muted-foreground">Manage your Multi-Compute Platform servers.</p>
        </div>
        <Button asChild>
          <Link to="/mcp-servers/new">
            <Plus className="mr-2 h-4 w-4" /> Add New Server
          </Link>
        </Button>
      </div>
      
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Server className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No MCP Servers Found</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            You haven't added any MCP servers yet. Add a server to enable remote agent deployment and execution.
          </p>
          <Button asChild>
            <Link to="/mcp-servers/new">
              <Plus className="mr-2 h-4 w-4" /> Add New Server
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map(server => (
            <Card key={server.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Server size={20} />
                      {server.name}
                    </CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <Globe size={14} className="mr-1" />
                      {server.url}
                    </CardDescription>
                  </div>
                  <Badge variant={server.status === 'online' ? 'default' : 'outline'}>
                    {server.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <Activity size={14} className="mr-1" />
                    <span className="text-muted-foreground">Capacity</span>
                  </div>
                  <span>
                    {server.capacity.currentAgents} / {server.capacity.maxAgents} agents
                  </span>
                </div>
                
                <Progress 
                  value={(server.capacity.currentAgents / server.capacity.maxAgents) * 100}
                  className="h-2"
                />
                
                <div className="space-y-2">
                  <div className="text-sm font-medium">Features</div>
                  <div className="flex flex-wrap gap-1">
                    {server.features.map((feature, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t p-4 pt-4 flex justify-between">
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => toggleServerStatus(server.id)}
                >
                  {server.status === 'online' ? (
                    <>
                      <WifiOff size={16} className="mr-1" />
                      Disconnect
                    </>
                  ) : (
                    <>
                      <Wifi size={16} className="mr-1" />
                      Connect
                    </>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  asChild
                >
                  <Link to={`/mcp-servers/details/${server.id}`}>
                    <Settings size={16} className="mr-1" />
                    Configure
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