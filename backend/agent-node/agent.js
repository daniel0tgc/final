import express from "express";
import { createClient } from "redis";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const AGENT_ID = process.env.AGENT_ID || "unknown";
const AGENT_CONFIG = process.env.AGENT_CONFIG
  ? JSON.parse(
      Buffer.from(process.env.AGENT_CONFIG, "base64").toString("utf-8")
    )
  : {};
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redis = createClient({ url: REDIS_URL });
redis.connect().catch(console.error);

// Cleaned: Removed agentContext and agentTools, and mock response logic

app.post("/message", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Missing message" });

  // Store message in shared memory (Redis)
  await redis.lPush(
    `agent:${AGENT_ID}:messages`,
    JSON.stringify({ role: "user", content: message, timestamp: Date.now() })
  );

  // Retrieve last 10 messages
  const history = (await redis.lRange(`agent:${AGENT_ID}:messages`, 0, 9)).map(
    JSON.parse
  );

  // Return the message as-is (future: parse for tool_call JSON if needed)
  const response = {
    role: "agent",
    content: message,
    timestamp: Date.now(),
    memory: history,
  };

  // Store agent response in memory
  await redis.lPush(`agent:${AGENT_ID}:messages`, JSON.stringify(response));

  res.json(response);
});

/**
 * Set a long-term fact for this agent (stored in backend PostgreSQL)
 * Usage: POST /fact/set { key, value }
 */
app.post("/fact/set", async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined)
    return res.status(400).json({ error: "Missing key or value" });
  try {
    const backendUrl =
      process.env.BACKEND_URL || "http://host.docker.internal:4000";
    const resp = await fetch(`${backendUrl}/api/longterm/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: AGENT_ID, key, value }),
    });
    if (!resp.ok) throw new Error("Failed to set fact");
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get a long-term fact for this agent (from backend PostgreSQL)
 * Usage: GET /fact/get/:key
 */
app.get("/fact/get/:key", async (req, res) => {
  const { key } = req.params;
  try {
    const backendUrl =
      process.env.BACKEND_URL || "http://host.docker.internal:4000";
    const resp = await fetch(
      `${backendUrl}/api/longterm/get/${AGENT_ID}/${key}`
    );
    if (!resp.ok) throw new Error("Failed to get fact");
    const data = await resp.json();
    res.json({ value: data.value ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(8000, () => {
  console.log(`Node.js agent ${AGENT_ID} listening on port 8000`);
});
