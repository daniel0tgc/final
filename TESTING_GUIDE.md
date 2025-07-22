# Testing Guide for Enhanced Agent Communication System

## Overview
This guide helps you test the new enhanced agent communication features that bring your system up to CrewAI-level capabilities.

## Prerequisites

1. **Backend Setup**
   ```bash
   cd backend
   npm install
   # Ensure Redis is running
   # Ensure PostgreSQL is running with agent_facts table
   npm start
   ```

2. **Frontend Setup**
   ```bash
   cd final
   npm install
   npm run dev
   ```

## Testing Scenarios

### 1. Basic Agent Communication

**Test Enhanced Messaging:**
1. Navigate to `/collaboration`
2. Select source and target agents
3. Choose message type (direct, delegation, request, etc.)
4. Set priority level
5. Send message and verify delivery

**Expected Results:**
- Message appears in target agent's message queue
- Message is logged in global A2A communication log
- Message includes metadata (type, priority, timestamp)

### 2. Shared Context Testing

**Test Shared Context Creation:**
1. Go to Collaboration page → Shared Context tab
2. Create a new shared context with multiple agents
3. Add context description and select participants
4. Verify context appears in all participant agents' shared contexts

**Expected Results:**
- Context is created with unique ID
- All participant agents can access the context
- Context versioning works properly

### 3. Collaborative Task Management

**Test Task Creation and Assignment:**
1. Navigate to Collaboration → Tasks tab
2. Create a new collaborative task
3. Assign to specific agent or leave for auto-assignment
4. Set priority and approval requirements
5. Monitor task status updates

**Expected Results:**
- Task is created and assigned appropriately
- Agent workload is updated
- Task appears in assigned agent's task list
- Status transitions work correctly

### 4. Human Approval Workflow

**Test Approval Process:**
1. Create a task or message requiring approval
2. Navigate to Collaboration → Approvals tab
3. Review pending approval requests
4. Approve or reject items with reasons
5. Verify status updates propagate correctly

**Expected Results:**
- Approval requests appear in pending queue
- Approval/rejection updates task/message status
- Audit trail is maintained
- Notifications work properly

### 5. Agent State Monitoring

**Test Agent State Tracking:**
1. Go to Collaboration → Agent States tab
2. Verify agent availability, workload, and capabilities
3. Create tasks and watch workload changes
4. Monitor performance metrics updates

**Expected Results:**
- Real-time agent state updates
- Workload calculations are accurate
- Performance metrics track correctly
- Agent discovery works for task assignment

### 6. Crew Collaboration

**Test Crew Management:**
1. Navigate to Collaboration → Crews tab
2. Create a new crew with multiple agents
3. Add goals and select process type
4. Add tasks to the crew
5. Execute crew workflow

**Expected Results:**
- Crew is created with shared context
- Agent assignments work correctly
- Workflow execution follows selected process
- Progress monitoring shows accurate status

## API Testing

### Backend Endpoints

Test these new endpoints directly:

```bash
# Enhanced memory
POST /api/memory/set
GET /api/memory/get/:key

# Agent communication
POST /api/agents/message
GET /api/agents/:agentId/messages

# Approvals
GET /api/approvals/pending
POST /api/approvals/:id/process
```

### Example API Tests

```bash
# Test memory storage
curl -X POST http://localhost:4000/api/memory/set \
  -H "Content-Type: application/json" \
  -d '{"key": "test:shared_context", "value": {"topic": "test", "participants": ["agent1", "agent2"]}}'

# Test message sending
curl -X POST http://localhost:4000/api/agents/message \
  -H "Content-Type: application/json" \
  -d '{"sourceAgentId": "agent1", "targetAgentId": "agent2", "message": "Hello", "messageType": "direct", "priority": "medium"}'

# Test pending approvals
curl http://localhost:4000/api/approvals/pending
```

## Performance Testing

### Load Testing Scenarios

1. **High-Volume Messaging**
   - Send 100+ messages between multiple agents
   - Monitor Redis performance
   - Check message delivery consistency

2. **Concurrent Task Creation**
   - Create multiple tasks simultaneously
   - Verify auto-assignment works under load
   - Monitor agent state updates

3. **Large Crew Execution**
   - Create crew with 10+ agents
   - Execute complex workflows
   - Monitor execution time and success rate

## Troubleshooting Common Issues

### 1. Memory Storage Issues
- **Problem**: Shared contexts not appearing
- **Solution**: Check Redis connection and memory endpoints
- **Debug**: Monitor browser network tab for API calls

### 2. Agent Communication Failures
- **Problem**: Messages not being delivered
- **Solution**: Verify agent IDs exist in system
- **Debug**: Check message queue in Redis

### 3. Approval System Not Working
- **Problem**: Approvals not showing up
- **Solution**: Check approval endpoint configuration
- **Debug**: Monitor pending_approvals key in Redis

### 4. Agent State Inconsistencies
- **Problem**: Agent states not updating
- **Solution**: Verify state update API calls
- **Debug**: Check global:agent_states in Redis

## Expected Behavior vs. Issues

### ✅ Working Features
- Enhanced message types and priorities
- Shared context creation and management
- Basic task creation and assignment
- Approval workflow interface
- Agent state monitoring
- Crew creation and basic management

### ⚠️ Known Limitations
- Some crew execution patterns may need refinement
- Agent capability auto-detection needs tuning
- Performance metrics calculation needs optimization
- Complex dependency handling may require adjustments

## Performance Benchmarks

### Expected Performance
- **Message Delivery**: < 100ms
- **Context Creation**: < 200ms
- **Task Assignment**: < 300ms
- **Agent State Update**: < 50ms
- **Approval Processing**: < 150ms

## Success Criteria

Your enhanced system should demonstrate:

1. **Superior Communication**: More message types than basic systems
2. **Human Oversight**: Complete approval workflow functionality
3. **Context Awareness**: Agents sharing context across interactions
4. **Intelligent Assignment**: Optimal task distribution based on capabilities
5. **Real-time Monitoring**: Live updates of all agent activities
6. **Scalable Architecture**: Support for multiple agents and complex workflows

## Next Steps

After successful testing:

1. **Performance Optimization**: Optimize any slow operations
2. **Feature Refinement**: Enhance based on testing feedback
3. **Documentation Updates**: Update user documentation
4. **Production Deployment**: Deploy to production environment
5. **Monitoring Setup**: Implement production monitoring

This enhanced system now provides CrewAI-level capabilities with additional human oversight and control features.
