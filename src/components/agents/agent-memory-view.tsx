import { useEffect, useState } from 'react';
import { Brain, Search, TrashIcon, BookmarkIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentMemory, MemoryEntry } from '@/lib/agent-memory';
import { Agent } from '@/types';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AgentMemoryViewProps {
  agent: Agent;
}

export function AgentMemoryView({ agent }: AgentMemoryViewProps) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [filteredMemories, setFilteredMemories] = useState<MemoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  
  const refreshMemories = () => {
    try {
      const allMemories = AgentMemory.getMemories(agent.id);
      setMemories(allMemories);
      applyFilters(allMemories, searchTerm, activeFilter, showBookmarkedOnly);
      
      // Load bookmarks from localStorage
      const storedBookmarks = localStorage.getItem(`bookmarked_memories_${agent.id}`);
      if (storedBookmarks) {
        setBookmarked(new Set(JSON.parse(storedBookmarks)));
      }
    } catch (error) {
      console.error('Error loading agent memories:', error);
    }
  };
  
  useEffect(() => {
    refreshMemories();
    
    // Set up interval to refresh memories periodically
    const interval = setInterval(refreshMemories, 5000);
    
    return () => clearInterval(interval);
  }, [agent.id]);
  
  useEffect(() => {
    applyFilters(memories, searchTerm, activeFilter, showBookmarkedOnly);
  }, [searchTerm, activeFilter, showBookmarkedOnly, bookmarked]);
  
  const applyFilters = (
    memoriesToFilter: MemoryEntry[],
    search: string,
    filter: string,
    bookmarkedOnly: boolean
  ) => {
    let results = [...memoriesToFilter];
    
    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(memory => 
        memory.content.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter by memory type
    if (filter !== 'all') {
      results = results.filter(memory => memory.type === filter);
    }
    
    // Filter by bookmarked status
    if (bookmarkedOnly) {
      results = results.filter(memory => bookmarked.has(memory.id));
    }
    
    // Sort by timestamp (newest first)
    results.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    setFilteredMemories(results);
  };
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleFilterChange = (value: string) => {
    setActiveFilter(value);
  };
  
  const handleClearMemories = () => {
    if (confirm('Are you sure you want to clear all memories for this agent? This cannot be undone.')) {
      AgentMemory.clearMemories(agent.id);
      refreshMemories();
    }
  };
  
  const handleBookmarkToggle = (memoryId: string) => {
    const newBookmarked = new Set(bookmarked);
    
    if (newBookmarked.has(memoryId)) {
      newBookmarked.delete(memoryId);
    } else {
      newBookmarked.add(memoryId);
    }
    
    setBookmarked(newBookmarked);
    
    // Save to localStorage
    localStorage.setItem(
      `bookmarked_memories_${agent.id}`,
      JSON.stringify([...newBookmarked])
    );
  };
  
  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'MMM d, h:mm a');
  };
  
  const getMemoryTypeLabel = (type: string) => {
    switch (type) {
      case 'user_message':
        return 'User Message';
      case 'agent_response':
        return 'Agent Response';
      case 'observation':
        return 'Observation';
      case 'reflection':
        return 'Reflection';
      case 'message_received':
        return 'Message Received';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };
  
  const getMemoryBadgeColor = (type: string) => {
    switch (type) {
      case 'user_message':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'agent_response':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'observation':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'reflection':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'message_received':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };
  
  const getImportanceColor = (importance: number) => {
    if (importance >= 8) return 'text-red-500';
    if (importance >= 6) return 'text-orange-500';
    if (importance >= 4) return 'text-yellow-600';
    return 'text-gray-500';
  };
  
  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Brain size={18} />
            Agent Memory Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              size="sm"
              className={`h-8 ${showBookmarkedOnly ? 'bg-blue-50' : ''}`}
              onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)}
            >
              <BookmarkIcon size={14} className="mr-1" />
              {showBookmarkedOnly ? 'Show All' : 'Bookmarked'}
            </Button>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={handleClearMemories}
                  >
                    <TrashIcon size={14} className="mr-1" />
                    Clear
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear all memories for this agent</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      
      <div className="px-4 pb-2">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 opacity-50 absolute ml-2" />
          <Input
            placeholder="Search memories..."
            className="pl-8"
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>
        
        <Tabs 
          className="mt-2" 
          defaultValue="all" 
          onValueChange={handleFilterChange}
        >
          <TabsList className="grid grid-cols-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="user_message">User</TabsTrigger>
            <TabsTrigger value="agent_response">Agent</TabsTrigger>
            <TabsTrigger value="observation">Observations</TabsTrigger>
            <TabsTrigger value="reflection">Reflections</TabsTrigger>
            <TabsTrigger value="message_received">Messages</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full">
          {filteredMemories.length > 0 ? (
            <div className="p-4 space-y-4">
              {filteredMemories.map((memory) => (
                <div 
                  key={memory.id} 
                  className="p-3 border rounded-md hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge 
                      variant="outline"
                      className={getMemoryBadgeColor(memory.type)}
                    >
                      {getMemoryTypeLabel(memory.type)}
                    </Badge>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(memory.timestamp)}
                      </span>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => handleBookmarkToggle(memory.id)}
                              className="text-muted-foreground hover:text-blue-500 transition-colors"
                            >
                              <BookmarkIcon 
                                size={14} 
                                fill={bookmarked.has(memory.id) ? 'currentColor' : 'none'} 
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {bookmarked.has(memory.id) ? 'Remove bookmark' : 'Bookmark this memory'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  
                  <p className="text-sm whitespace-pre-wrap">
                    {memory.content}
                  </p>
                  
                  {memory.importance !== undefined && (
                    <div className="mt-2 text-xs flex items-center">
                      <span className="text-muted-foreground mr-1">Importance:</span>
                      <span className={getImportanceColor(memory.importance)}>
                        {memory.importance}/10
                      </span>
                    </div>
                  )}
                  
                  {memory.metadata && Object.keys(memory.metadata).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-blue-500 transition-colors">
                        View metadata
                      </summary>
                      <pre className="text-xs bg-gray-50 p-2 mt-1 rounded overflow-x-auto">
                        {JSON.stringify(memory.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              <Brain size={24} className="mb-2 opacity-50" />
              <p>No memories found</p>
              <p className="text-sm mt-1">
                {searchTerm ? 'Try a different search term' : 'This agent has no memories yet'}
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}