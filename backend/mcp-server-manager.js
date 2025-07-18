import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createClient } from "redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const redis = createClient();
redis.connect().catch(console.error);

// MCP Server configurations
const MCP_SERVERS = {
  "web-search": {
    name: "Web Search MCP Server",
    package: "@modelcontextprotocol/server-web-search",
    port: 8001,
    env: {
      SERPAPI_API_KEY: process.env.SERPAPI_API_KEY || "",
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || "",
      GOOGLE_CSE_ID: process.env.GOOGLE_CSE_ID || "",
    },
  },
  filesystem: {
    name: "File System MCP Server",
    package: "@modelcontextprotocol/server-filesystem",
    port: 8002,
    env: {
      MCP_SERVER_FILESYSTEM_ROOT:
        process.env.MCP_SERVER_FILESYSTEM_ROOT || "/tmp",
    },
  },
  telegram: {
    name: "Telegram Messaging MCP Server",
    package: "@modelcontextprotocol/server-telegram",
    port: 8003,
    env: {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || "",
    },
  },
};

class MCPServerManager {
  constructor() {
    this.runningServers = new Map();
    this.serverStatus = new Map();
  }

  async startServer(serverType) {
    if (this.runningServers.has(serverType)) {
      console.log(`Server ${serverType} is already running`);
      return this.runningServers.get(serverType);
    }

    const config = MCP_SERVERS[serverType];
    if (!config) {
      throw new Error(`Unknown server type: ${serverType}`);
    }

    try {
      // Check if the package is installed
      const { execSync } = await import("child_process");
      try {
        execSync(`npm list ${config.package}`, { stdio: "ignore" });
      } catch (error) {
        console.log(`Installing ${config.package}...`);
        execSync(`npm install ${config.package}`, { stdio: "inherit" });
      }

      // Start the MCP server
      const serverProcess = spawn("npx", [config.package], {
        env: {
          ...process.env,
          ...config.env,
          PORT: config.port.toString(),
        },
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Store server info
      const serverInfo = {
        type: serverType,
        name: config.name,
        port: config.port,
        url: `http://localhost:${config.port}`,
        process: serverProcess,
        startTime: new Date().toISOString(),
      };

      this.runningServers.set(serverType, serverInfo);
      this.serverStatus.set(serverType, "starting");

      // Handle server output
      serverProcess.stdout.on("data", (data) => {
        console.log(`[${serverType}] ${data.toString().trim()}`);
        if (
          data.toString().includes("listening") ||
          data.toString().includes("started")
        ) {
          this.serverStatus.set(serverType, "online");
          this.updateServerStatus(serverType, "online");
        }
      });

      serverProcess.stderr.on("data", (data) => {
        console.error(`[${serverType}] ERROR: ${data.toString().trim()}`);
      });

      serverProcess.on("close", (code) => {
        console.log(`[${serverType}] Server process exited with code ${code}`);
        this.runningServers.delete(serverType);
        this.serverStatus.set(serverType, "offline");
        this.updateServerStatus(serverType, "offline");
      });

      serverProcess.on("error", (error) => {
        console.error(`[${serverType}] Failed to start server:`, error);
        this.runningServers.delete(serverType);
        this.serverStatus.set(serverType, "error");
        this.updateServerStatus(serverType, "error");
      });

      // Wait a bit for server to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return serverInfo;
    } catch (error) {
      console.error(`Failed to start ${serverType} server:`, error);
      throw error;
    }
  }

  async stopServer(serverType) {
    const serverInfo = this.runningServers.get(serverType);
    if (!serverInfo) {
      console.log(`Server ${serverType} is not running`);
      return;
    }

    try {
      serverInfo.process.kill("SIGTERM");
      this.runningServers.delete(serverType);
      this.serverStatus.set(serverType, "offline");
      this.updateServerStatus(serverType, "offline");
      console.log(`Stopped ${serverType} server`);
    } catch (error) {
      console.error(`Error stopping ${serverType} server:`, error);
    }
  }

  async getServerStatus(serverType) {
    const serverInfo = this.runningServers.get(serverType);
    if (!serverInfo) {
      return { status: "offline", url: MCP_SERVERS[serverType]?.url };
    }

    try {
      const response = await fetch(`${serverInfo.url}/health`);
      if (response.ok) {
        return {
          status: "online",
          url: serverInfo.url,
          info: await response.json(),
        };
      } else {
        return { status: "error", url: serverInfo.url };
      }
    } catch (error) {
      return { status: "offline", url: serverInfo.url };
    }
  }

  async getServerTools(serverType) {
    const serverInfo = this.runningServers.get(serverType);
    if (!serverInfo) {
      throw new Error(`Server ${serverType} is not running`);
    }

    try {
      const response = await fetch(`${serverInfo.url}/tools`);
      if (!response.ok) {
        throw new Error(`Failed to get tools from ${serverType}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error getting tools from ${serverType}:`, error);
      throw error;
    }
  }

  async executeTool(serverType, toolName, args) {
    const serverInfo = this.runningServers.get(serverType);
    if (!serverInfo) {
      throw new Error(`Server ${serverType} is not running`);
    }

    try {
      const response = await fetch(`${serverInfo.url}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolName, arguments: args }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to execute tool ${toolName}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(
        `Error executing tool ${toolName} on ${serverType}:`,
        error
      );
      throw error;
    }
  }

  async updateServerStatus(serverType, status) {
    try {
      await redis.set(`mcp_server:${serverType}:status`, status);
      await redis.set(
        `mcp_server:${serverType}:last_update`,
        new Date().toISOString()
      );
    } catch (error) {
      console.error("Error updating server status in Redis:", error);
    }
  }

  getRunningServers() {
    return Array.from(this.runningServers.values());
  }

  async stopAllServers() {
    const promises = Array.from(this.runningServers.keys()).map((serverType) =>
      this.stopServer(serverType)
    );
    await Promise.all(promises);
  }
}

export const mcpServerManager = new MCPServerManager();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down MCP servers...");
  await mcpServerManager.stopAllServers();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down MCP servers...");
  await mcpServerManager.stopAllServers();
  process.exit(0);
});
