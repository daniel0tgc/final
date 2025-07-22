import express from "express";
import Docker from "dockerode";
import { createClient } from "redis";
import pkg from "pg";
const { Pool } = pkg;
// MCP server manager removed - not needed for core functionality

const app = express();
const docker = new Docker();
const redis = createClient();

app.use(express.json());

// Connect to Redis
redis.connect().catch(console.error);

// In-memory map of running agent containers (agentId -> container)
const agentContainers = new Map();

// PostgreSQL connection setup
const pgPool = new Pool({
  connectionString:
    process.env.PG_URL ||
    "postgresql://postgres:postgres@localhost:5432/agentdb",
});

// Ensure table for agents exists
async function ensureAgentsTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id VARCHAR(64) PRIMARY KEY,
      agent_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}
ensureAgentsTable();

// Ensure table for long-term facts exists
async function ensureFactsTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS agent_facts (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL,
      fact_key VARCHAR(128) NOT NULL,
      fact_value TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(agent_id, fact_key)
    );
  `);
}
ensureFactsTable();

// Ensure table for MCP servers exists
async function ensureMCPServersTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      url VARCHAR(500) NOT NULL,
      status VARCHAR(50) DEFAULT 'offline',
      capacity JSONB DEFAULT '{"currentAgents": 0, "maxAgents": 10}',
      features JSONB DEFAULT '[]',
      tools JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}
ensureMCPServersTable();

// Ensure table for MCP tools exists
async function ensureMCPToolsTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS mcp_tools (
      id SERIAL PRIMARY KEY,
      server_id VARCHAR(64) NOT NULL,
      tool_name VARCHAR(255) NOT NULL,
      tool_description TEXT,
      tool_schema JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
    );
  `);
}
ensureMCPToolsTable();

// Start an agent container
app.post("/api/agents/start", async (req, res) => {
  const { agent } = req.body;
  if (!agent || !agent.id)
    return res.status(400).json({ error: "Missing agent config" });

  try {
    // Select image based on agent.config.runtime
    const runtime = agent.config.runtime || "node";
    const image =
      runtime === "python" ? "agent-python:latest" : "agent-node:latest";

    // Launch agent container
    const container = await docker.createContainer({
      Image: image,
      name: `agent_${agent.id}`,
      Env: [
        `AGENT_ID=${agent.id}`,
        `AGENT_CONFIG=${Buffer.from(JSON.stringify(agent.config)).toString(
          "base64"
        )}`,
        `REDIS_URL=redis://host.docker.internal:6379`,
      ],
      HostConfig: {
        NetworkMode: "bridge",
        AutoRemove: true,
      },
    });
    await container.start();
    agentContainers.set(agent.id, container.id);
    res.json({ status: "started", containerId: container.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a message to an agent (proxy to agent container HTTP API)
app.post("/api/agents/:id/message", async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Missing message" });
  try {
    // Assume agent container exposes HTTP API on mapped port (e.g., 8000)
    // In production, use service discovery or Docker API to get container IP/port
    const response = await fetch(`http://localhost:8${id.slice(-3)}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shared memory API (read/write via Redis)
app.post("/api/memory/set", async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: "Missing key" });
  try {
    await redis.set(key, JSON.stringify(value));
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/memory/get/:key", async (req, res) => {
  const { key } = req.params;
  try {
    const value = await redis.get(key);
    res.json({ value: value ? JSON.parse(value) : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to set a long-term fact for an agent
app.post("/api/longterm/set", async (req, res) => {
  const { agentId, key, value } = req.body;
  if (!agentId || !key || value === undefined) {
    return res.status(400).json({ error: "Missing agentId, key, or value" });
  }
  try {
    await pgPool.query(
      `INSERT INTO agent_facts (agent_id, fact_key, fact_value, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (agent_id, fact_key) DO UPDATE SET fact_value = EXCLUDED.fact_value, updated_at = NOW()`,
      [agentId, key, value]
    );
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get a long-term fact for an agent
app.get("/api/longterm/get/:agentId/:key", async (req, res) => {
  const { agentId, key } = req.params;
  try {
    const result = await pgPool.query(
      `SELECT fact_value FROM agent_facts WHERE agent_id = $1 AND fact_key = $2`,
      [agentId, key]
    );
    if (result.rows.length > 0) {
      res.json({ value: result.rows[0].fact_value });
    } else {
      res.json({ value: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enhanced memory endpoints for collaborative features

// Set shared memory data
app.post("/api/memory/set", async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined)
    return res.status(400).json({ error: "Missing key or value" });
  
  try {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    await redis.set(key, valueStr);
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get shared memory data
app.get("/api/memory/get/:key", async (req, res) => {
  const { key } = req.params;
  try {
    const value = await redis.get(key);
    if (value === null) {
      return res.json({ value: null });
    }
    
    try {
      const parsed = JSON.parse(value);
      res.json({ value: parsed });
    } catch {
      res.json({ value: value });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agent collaboration endpoints

// Send message between agents
app.post("/api/agents/message", async (req, res) => {
  const { sourceAgentId, targetAgentId, message, messageType, priority, metadata } = req.body;
  
  if (!sourceAgentId || !targetAgentId || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Store message in Redis for real-time delivery
    const messageData = {
      id: require('crypto').randomUUID(),
      sourceAgentId,
      targetAgentId,
      message,
      messageType: messageType || "direct",
      priority: priority || "medium",
      timestamp: new Date().toISOString(),
      status: "pending",
      metadata: metadata || {}
    };

    // Add to target agent's message queue
    await redis.lpush(`agent:${targetAgentId}:messages`, JSON.stringify(messageData));
    
    // Also store in global message log
    const allMessages = await redis.get("a2a:messages");
    const messages = allMessages ? JSON.parse(allMessages) : [];
    messages.push(messageData);
    await redis.set("a2a:messages", JSON.stringify(messages));

    res.json({ status: "sent", messageId: messageData.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get agent messages
app.get("/api/agents/:agentId/messages", async (req, res) => {
  const { agentId } = req.params;
  
  try {
    const messages = await redis.lrange(`agent:${agentId}:messages`, 0, -1);
    const parsedMessages = messages.map(msg => JSON.parse(msg));
    res.json(parsedMessages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Human approval endpoints

// Get pending approvals
app.get("/api/approvals/pending", async (req, res) => {
  try {
    const pendingApprovals = await redis.get("pending_approvals");
    const approvals = pendingApprovals ? JSON.parse(pendingApprovals) : [];
    res.json(approvals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process approval
app.post("/api/approvals/:id/process", async (req, res) => {
  const { id } = req.params;
  const { approved, reason, approverName } = req.body;
  
  try {
    const pendingApprovals = await redis.get("pending_approvals");
    const approvals = pendingApprovals ? JSON.parse(pendingApprovals) : [];
    
    const approvalIndex = approvals.findIndex(a => a.id === id);
    if (approvalIndex === -1) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    const approval = approvals[approvalIndex];
    approval.status = approved ? "approved" : "rejected";
    approval.processedAt = new Date().toISOString();
    approval.processedBy = approverName;
    approval.reason = reason;

    // Update the related item (task, message, etc.)
    if (approval.itemType === "task") {
      // Update task status in collaborative tasks
      const tasks = await redis.get("global:collaborative_tasks");
      const taskList = tasks ? JSON.parse(tasks) : [];
      const taskIndex = taskList.findIndex(t => t.id === approval.itemId);
      
      if (taskIndex >= 0) {
        taskList[taskIndex].approvalStatus = approval.status;
        taskList[taskIndex].approvedBy = approverName;
        if (approved) {
          taskList[taskIndex].status = "in_progress";
        } else {
          taskList[taskIndex].status = "failed";
        }
        await redis.set("global:collaborative_tasks", JSON.stringify(taskList));
      }
    }

    // Remove from pending approvals
    approvals.splice(approvalIndex, 1);
    await redis.set("pending_approvals", JSON.stringify(approvals));

    res.json({ status: "processed", approval });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all agents
app.get("/api/agents", async (req, res) => {
  try {
    const result = await pgPool.query("SELECT agent_data FROM agents");
    const agents = result.rows.map((row) => row.agent_data);
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new agent
app.post("/api/agents", async (req, res) => {
  const agent = req.body;
  if (!agent || !agent.id)
    return res.status(400).json({ error: "Missing agent data or id" });
  try {
    await pgPool.query(
      `INSERT INTO agents (id, agent_data, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())`,
      [agent.id, agent]
    );
    res.status(201).json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single agent
app.get("/api/agents/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pgPool.query(
      "SELECT agent_data FROM agents WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Agent not found" });
    res.json(result.rows[0].agent_data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an agent
app.put("/api/agents/:id", async (req, res) => {
  const { id } = req.params;
  const agent = req.body;
  if (!agent || !agent.id)
    return res.status(400).json({ error: "Missing agent data or id" });
  try {
    await pgPool.query(
      `UPDATE agents SET agent_data = $2, updated_at = NOW() WHERE id = $1`,
      [id, agent]
    );
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an agent
app.delete("/api/agents/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pgPool.query("DELETE FROM agents WHERE id = $1", [id]);
    res.json({ status: "deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MCP Server Management Endpoints

// List all MCP servers
app.get("/api/mcp-servers", async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT * FROM mcp_servers ORDER BY created_at DESC"
    );
    const servers = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      status: row.status,
      capacity: row.capacity,
      features: row.features,
      tools: row.tools,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json(servers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new MCP server
app.post("/api/mcp-servers", async (req, res) => {
  const { id, name, url, capacity, features, serverType } = req.body;
  if (!id || !name || (!url && !serverType)) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    let serverUrl = url;
    let serverTools = [];
    let serverStatus = "offline";

    // Use provided URL for MCP server configuration
    if (url) {
      // Try to discover tools from the provided URL
      try {
        const toolsResponse = await fetch(`${url}/tools`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          timeout: 5000,
        });

        if (toolsResponse.ok) {
          serverTools = await toolsResponse.json();
          serverStatus = "online";
        }
      } catch (toolError) {
        console.warn(
          `Could not discover tools from ${url}:`,
          toolError.message
        );
      }
    }

    await pgPool.query(
      `INSERT INTO mcp_servers (id, name, url, capacity, features, tools, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        id,
        name,
        serverUrl,
        capacity || { currentAgents: 0, maxAgents: 10 },
        features || [],
        serverTools,
        serverStatus,
      ]
    );

    res.status(201).json({
      id,
      name,
      url: serverUrl,
      status: serverStatus,
      tools: serverTools,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single MCP server
app.get("/api/mcp-servers/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pgPool.query(
      "SELECT * FROM mcp_servers WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "MCP server not found" });
    }
    const server = result.rows[0];
    res.json({
      id: server.id,
      name: server.name,
      url: server.url,
      status: server.status,
      capacity: server.capacity,
      features: server.features,
      tools: server.tools,
      createdAt: server.created_at,
      updatedAt: server.updated_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an MCP server
app.put("/api/mcp-servers/:id", async (req, res) => {
  const { id } = req.params;
  const { name, url, capacity, features } = req.body;
  try {
    await pgPool.query(
      `UPDATE mcp_servers SET name = $2, url = $3, capacity = $4, features = $5, updated_at = NOW() WHERE id = $1`,
      [id, name, url, capacity, features]
    );
    res.json({ status: "updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an MCP server
app.delete("/api/mcp-servers/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pgPool.query("DELETE FROM mcp_servers WHERE id = $1", [id]);
    res.json({ status: "deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test MCP server connection
app.post("/api/mcp-servers/:id/test", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pgPool.query(
      "SELECT url FROM mcp_servers WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "MCP server not found" });
    }

    const { url } = result.rows[0];

    // Test connection by trying to get tools
    const toolsResponse = await fetch(`${url}/tools`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });

    if (toolsResponse.ok) {
      const tools = await toolsResponse.json();
      await pgPool.query(
        `UPDATE mcp_servers SET tools = $1, status = 'online', updated_at = NOW() WHERE id = $2`,
        [tools, id]
      );
      res.json({ status: "online", tools });
    } else {
      await pgPool.query(
        `UPDATE mcp_servers SET status = 'offline', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      res.json({ status: "offline", error: "Server not responding" });
    }
  } catch (err) {
    await pgPool.query(
      `UPDATE mcp_servers SET status = 'offline', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    res.status(500).json({ error: err.message });
  }
});

// Execute MCP tool
app.post("/api/mcp-servers/:id/execute", async (req, res) => {
  const { id } = req.params;
  const { toolName, arguments: args } = req.body;

  if (!toolName) {
    return res.status(400).json({ error: "Missing tool name" });
  }

  try {
    const result = await pgPool.query(
      "SELECT url FROM mcp_servers WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "MCP server not found" });
    }

    const { url } = result.rows[0];

    // Execute tool on MCP server
    const executeResponse = await fetch(`${url}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: toolName, arguments: args || {} }),
      timeout: 30000,
    });

    if (executeResponse.ok) {
      const result = await executeResponse.json();
      res.json(result);
    } else {
      res.status(executeResponse.status).json({
        error: `MCP server error: ${executeResponse.statusText}`,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MCP server management endpoints removed - focusing on core agent functionality

// Tool Approval Management Endpoints

// Create tables for approvals and logs
async function ensureApprovalsTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS tool_approvals (
      id VARCHAR(64) PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL,
      tool_call JSONB NOT NULL,
      context JSONB,
      status VARCHAR(20) DEFAULT 'pending',
      reason TEXT,
      result JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      processed_at TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );
  `);
}
ensureApprovalsTable();

async function ensureToolLogsTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS tool_logs (
      id VARCHAR(64) PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL,
      tool_name VARCHAR(255) NOT NULL,
      tool_args JSONB,
      result JSONB,
      status VARCHAR(20) NOT NULL,
      error TEXT,
      execution_time INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );
  `);
}
ensureToolLogsTable();

async function ensureSystemLogsTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id VARCHAR(64) PRIMARY KEY,
      timestamp TIMESTAMP DEFAULT NOW(),
      level VARCHAR(10) NOT NULL,
      category VARCHAR(20) NOT NULL,
      agent_id VARCHAR(64),
      agent_name VARCHAR(255),
      message TEXT NOT NULL,
      details JSONB,
      metadata JSONB
    );
  `);
}
ensureSystemLogsTable();

// Create a new approval request
app.post("/api/approvals", async (req, res) => {
  const { id, agentId, toolCall, context, status, timestamp } = req.body;
  
  try {
    await pgPool.query(
      `INSERT INTO tool_approvals (id, agent_id, tool_call, context, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, agentId, toolCall, context, status || 'pending', timestamp || new Date().toISOString()]
    );
    
    res.json({ success: true, id });
  } catch (err) {
    console.error('Failed to create approval:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get pending approvals for an agent
app.get("/api/approvals/pending", async (req, res) => {
  const { agentId } = req.query;
  
  try {
    let query = "SELECT * FROM tool_approvals WHERE status = 'pending'";
    let params = [];
    
    if (agentId) {
      query += " AND agent_id = $1";
      params.push(agentId);
    }
    
    query += " ORDER BY created_at DESC";
    
    const result = await pgPool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch pending approvals:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get specific approval
app.get("/api/approvals/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pgPool.query(
      "SELECT * FROM tool_approvals WHERE id = $1",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Approval not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to fetch approval:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update approval status
app.put("/api/approvals/:id", async (req, res) => {
  const { id } = req.params;
  const { status, reason, result, processedAt } = req.body;
  
  try {
    await pgPool.query(
      `UPDATE tool_approvals 
       SET status = $1, reason = $2, result = $3, processed_at = $4 
       WHERE id = $5`,
      [status, reason, result, processedAt || new Date().toISOString(), id]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update approval:', err);
    res.status(500).json({ error: err.message });
  }
});

// Log tool execution
app.post("/api/logs/tools", async (req, res) => {
  const { id, agentId, toolName, toolArgs, result, status, error, executionTime } = req.body;
  
  try {
    await pgPool.query(
      `INSERT INTO tool_logs (id, agent_id, tool_name, tool_args, result, status, error, execution_time) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, agentId, toolName, toolArgs, result, status, error, executionTime]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to log tool execution:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get tool logs
app.get("/api/logs/tools", async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT * FROM tool_logs ORDER BY created_at DESC LIMIT 1000"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch tool logs:', err);
    res.status(500).json({ error: err.message });
  }
});

// Log system events
app.post("/api/logs", async (req, res) => {
  const { id, level, category, agentId, agentName, message, details, metadata } = req.body;
  
  try {
    await pgPool.query(
      `INSERT INTO system_logs (id, level, category, agent_id, agent_name, message, details, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, level, category, agentId, agentName, message, details, metadata]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to log system event:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get system logs
app.get("/api/logs", async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 1000"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch system logs:', err);
    res.status(500).json({ error: err.message });
  }
});

// A2A Communication Logs Table
async function ensureA2ALogsTable() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS a2a_logs (
      id VARCHAR(64) PRIMARY KEY,
      timestamp TIMESTAMP DEFAULT NOW(),
      source_agent_id VARCHAR(64) NOT NULL,
      source_agent_name VARCHAR(255) NOT NULL,
      target_agent_id VARCHAR(64) NOT NULL,
      target_agent_name VARCHAR(255) NOT NULL,
      message_type VARCHAR(20) NOT NULL,
      priority VARCHAR(10) NOT NULL,
      status VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      requires_approval BOOLEAN DEFAULT FALSE,
      approval_status VARCHAR(20),
      context_id VARCHAR(64),
      task_id VARCHAR(64)
    );
  `);
}
ensureA2ALogsTable();

// Log A2A communication
app.post("/api/logs/a2a", async (req, res) => {
  const { 
    id, timestamp, sourceAgentId, sourceAgentName, targetAgentId, targetAgentName,
    messageType, priority, status, message, requiresApproval, approvalStatus,
    contextId, taskId 
  } = req.body;
  
  try {
    await pgPool.query(
      `INSERT INTO a2a_logs (
        id, timestamp, source_agent_id, source_agent_name, target_agent_id, target_agent_name,
        message_type, priority, status, message, requires_approval, approval_status,
        context_id, task_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id, timestamp || new Date().toISOString(), sourceAgentId, sourceAgentName, 
        targetAgentId, targetAgentName, messageType, priority, status, message,
        requiresApproval || false, approvalStatus, contextId, taskId
      ]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to log A2A communication:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get A2A communication logs
app.get("/api/logs/a2a", async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT * FROM a2a_logs ORDER BY timestamp DESC LIMIT 1000"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch A2A logs:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Agent backend listening on port ${PORT}`);
});
