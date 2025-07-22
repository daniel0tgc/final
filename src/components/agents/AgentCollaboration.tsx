import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { A2ACommunication, AgentTask, SharedContext, AgentState } from '@/lib/a2a-communication';
import { AlertCircle, MessageSquare, Users, CheckCircle, Clock, X } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  status: string;
}

export function AgentCollaboration() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});
  const [collaborativeTasks, setCollaborativeTasks] = useState<AgentTask[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  // Form states
  const [messageForm, setMessageForm] = useState({
    sourceAgent: '',
    targetAgent: '',
    message: '',
    messageType: 'direct' as const,
    priority: 'medium' as const,
    requiresApproval: false,
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium' as const,
    approvalRequired: false,
  });

  useEffect(() => {
    loadAgents();
    loadAgentStates();
    loadCollaborativeTasks();
    loadPendingApprovals();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();
      setAgents(data);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadAgentStates = async () => {
    try {
      const states = await A2ACommunication.getAllAgentStates();
      setAgentStates(states);
    } catch (error) {
      console.error('Failed to load agent states:', error);
    }
  };

  const loadCollaborativeTasks = async () => {
    try {
      const allTasks: AgentTask[] = [];
      for (const agent of agents) {
        const agentTasks = await A2ACommunication.getAgentTasks(agent.id);
        allTasks.push(...agentTasks);
      }
      // Remove duplicates
      const uniqueTasks = allTasks.filter((task, index) => 
        allTasks.findIndex(t => t.id === task.id) === index
      );
      setCollaborativeTasks(uniqueTasks);
    } catch (error) {
      console.error('Failed to load collaborative tasks:', error);
    }
  };

  const loadPendingApprovals = async () => {
    try {
      const response = await fetch('/api/approvals/pending');
      const data = await response.json();
      setPendingApprovals(data);
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
    }
  };

  const sendMessage = async () => {
    try {
      await A2ACommunication.sendMessage(
        messageForm.sourceAgent,
        \`Agent-\${messageForm.sourceAgent}\`,
        messageForm.targetAgent,
        \`Agent-\${messageForm.targetAgent}\`,
        messageForm.message,
        {
          messageType: messageForm.messageType,
          priority: messageForm.priority,
          requiresApproval: messageForm.requiresApproval,
        }
      );
      
      setMessageForm({
        sourceAgent: '',
        targetAgent: '',
        message: '',
        messageType: 'direct',
        priority: 'medium',
        requiresApproval: false,
      });

      alert('Message sent successfully!');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  };

  const createTask = async () => {
    try {
      await A2ACommunication.createCollaborativeTask({
        title: taskForm.title,
        description: taskForm.description,
        assigneeAgentId: taskForm.assignedTo,
        assignerAgentId: agents[0]?.id || 'system',
        priority: taskForm.priority,
        approvalRequired: taskForm.approvalRequired,
      });

      setTaskForm({
        title: '',
        description: '',
        assignedTo: '',
        priority: 'medium',
        approvalRequired: false,
      });

      loadCollaborativeTasks();
      alert('Task created successfully!');
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task');
    }
  };

  const processApproval = async (approvalId: string, approved: boolean, reason?: string) => {
    try {
      const response = await fetch(\`/api/approvals/\${approvalId}/process\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved,
          reason,
          approverName: 'Human Supervisor'
        }),
      });

      if (response.ok) {
        loadPendingApprovals();
        loadCollaborativeTasks();
        alert(\`Approval \${approved ? 'granted' : 'denied'} successfully!\`);
      }
    } catch (error) {
      console.error('Failed to process approval:', error);
      alert('Failed to process approval');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: 'bg-yellow-500',
      assigned: 'bg-blue-500',
      in_progress: 'bg-purple-500',
      completed: 'bg-green-500',
      failed: 'bg-red-500',
      requires_approval: 'bg-orange-500',
    };

    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || 'bg-gray-500'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Enhanced Agent Collaboration</h1>
        <Button onClick={() => {
          loadAgentStates();
          loadCollaborativeTasks();
          loadPendingApprovals();
        }}>
          Refresh All
        </Button>
      </div>

      <Tabs defaultValue="communication" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="states">Agent States</TabsTrigger>
        </TabsList>

        <TabsContent value="communication">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Agent-to-Agent Communication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Source Agent</label>
                  <Select value={messageForm.sourceAgent} onValueChange={(value) => 
                    setMessageForm(prev => ({ ...prev, sourceAgent: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name} ({agent.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Target Agent</label>
                  <Select value={messageForm.targetAgent} onValueChange={(value) => 
                    setMessageForm(prev => ({ ...prev, targetAgent: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name} ({agent.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  value={messageForm.message}
                  onChange={(e) => setMessageForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Enter your message..."
                  rows={3}
                />
              </div>

              <Button onClick={sendMessage} className="w-full">
                Send Message
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create Collaborative Task</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={taskForm.title}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Task title..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Task description..."
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Assigned To</label>
                  <Select value={taskForm.assignedTo} onValueChange={(value) => 
                    setTaskForm(prev => ({ ...prev, assignedTo: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name} ({agent.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={createTask} className="w-full">
                  Create Task
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Collaborative Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {collaborativeTasks.map(task => (
                    <div key={task.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{task.title}</h4>
                        <div className="flex gap-2">
                          {getStatusBadge(task.status)}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                      <div className="text-xs text-gray-500">
                        Assigned to: Agent-{task.assigneeAgentId} • Created: {new Date(task.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Pending Approvals ({pendingApprovals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingApprovals.map(approval => (
                  <div key={approval.id} className="p-4 border rounded-lg bg-yellow-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">
                        {approval.itemType === 'task' ? 'Task' : 'Message'} Approval Required
                      </h4>
                      <Badge className="bg-orange-500">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">
                      <strong>Reason:</strong> {approval.reason}
                    </p>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => processApproval(approval.id, true, 'Approved by human supervisor')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => processApproval(approval.id, false, 'Rejected by human supervisor')}
                        className="border-red-500 text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
                
                {pendingApprovals.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No pending approvals
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="states">
          <Card>
            <CardHeader>
              <CardTitle>Agent States</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(agentStates).map(([agentId, state]) => (
                  <div key={agentId} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{state.agentName}</h4>
                      <div className="flex gap-2">
                        <Badge className={
                          state.availability === 'available' ? 'bg-green-500' :
                          state.availability === 'busy' ? 'bg-orange-500' : 'bg-red-500'
                        }>
                          {state.availability}
                        </Badge>
                        <Badge className={
                          state.workload === 'idle' ? 'bg-gray-500' :
                          state.workload === 'light' ? 'bg-blue-500' :
                          state.workload === 'medium' ? 'bg-yellow-500' :
                          state.workload === 'heavy' ? 'bg-orange-500' : 'bg-red-500'
                        }>
                          {state.workload}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Current Tasks:</strong> {state.currentTasks.length}</p>
                      <p><strong>Capabilities:</strong> {state.capabilities.join(', ') || 'None specified'}</p>
                      <p><strong>Success Rate:</strong> {(state.performance.successRate * 100).toFixed(1)}%</p>
                      <p><strong>Tasks Completed:</strong> {state.performance.tasksCompleted}</p>
                      <p><strong>Last Activity:</strong> {new Date(state.lastActivity).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
