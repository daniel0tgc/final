# MCP Servers Setup Guide

This guide explains how to set up and use real MCP (Model Context Protocol) servers with your AI Agent Deployment Platform.

## Available MCP Servers

### 1. Web Search MCP Server

**Package**: `@modelcontextprotocol/server-web-search`
**Port**: 8001
**Description**: Provides web search capabilities using Google and other search engines.

#### Setup Requirements

You need one of the following API keys:

**Option A: SerpAPI (Recommended)**

```bash
export SERPAPI_API_KEY="your_serpapi_key_here"
```

**Option B: Google Custom Search**

```bash
export GOOGLE_API_KEY="your_google_api_key_here"
export GOOGLE_CSE_ID="your_custom_search_engine_id_here"
```

#### How to Get API Keys

**SerpAPI:**

1. Go to [serpapi.com](https://serpapi.com)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Free tier includes 100 searches per month

**Google Custom Search:**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Custom Search API
3. Create credentials (API key)
4. Go to [Google Programmable Search Engine](https://programmablesearchengine.google.com)
5. Create a new search engine
6. Get your Search Engine ID (CSE ID)

### 2. File System MCP Server

**Package**: `@modelcontextprotocol/server-filesystem`
**Port**: 8002
**Description**: Provides file system access for reading and writing files.

#### Setup Requirements

```bash
export MCP_SERVER_FILESYSTEM_ROOT="/path/to/your/files"
```

**Note**: This is optional. If not set, it will use `/tmp` as the default root directory.

### 3. Telegram Messaging MCP Server

**Package**: `@modelcontextprotocol/server-telegram`
**Port**: 8003
**Description**: Provides Telegram messaging capabilities for sending messages to channels and users.

#### Setup Requirements

```bash
export TELEGRAM_BOT_TOKEN="your_telegram_bot_token_here"
export TELEGRAM_CHAT_ID="your_chat_id_here"
```

#### How to Get Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Start a conversation with BotFather
3. Send `/newbot` command
4. Follow the instructions to create your bot
5. BotFather will give you a bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

#### How to Get Chat ID

**For Personal Chat:**

1. Send a message to your bot
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for the `chat.id` field in the response

**For Channel:**

1. Add your bot to the channel as an admin
2. Send a message to the channel
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for the `chat.id` field (will be negative for channels)

**For Group:**

1. Add your bot to the group
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for the `chat.id` field (will be negative for groups)

## Installation

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Environment Variables

Create a `.env` file in the backend directory:

```env
# Web Search (choose one option)
SERPAPI_API_KEY=your_serpapi_key_here
# OR
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_CSE_ID=your_custom_search_engine_id_here

# File System (optional)
MCP_SERVER_FILESYSTEM_ROOT=/path/to/your/files

# Telegram Messaging
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Database
PG_URL=postgresql://postgres:postgres@localhost:5432/agentdb

# Redis
REDIS_URL=redis://localhost:6379
```

### 3. Start the Backend

```bash
npm start
```

## Using MCP Servers

### 1. Add MCP Servers via UI

1. Go to the MCP Servers page in your application
2. Click "Add New Server"
3. Choose "Built-in Server"
4. Select the server type you want to add
5. The server will be automatically started and tools will be discovered

### 2. Agent Tool Usage

Once MCP servers are running, agents can use them through the following tools:

#### Web Search

```json
{
  "tool_call": "EXECUTE_MCP_TOOL",
  "args": {
    "serverId": "web-search-server-id",
    "toolName": "search",
    "arguments": { "query": "latest AI developments" }
  }
}
```

#### File System

```json
{
  "tool_call": "EXECUTE_MCP_TOOL",
  "args": {
    "serverId": "filesystem-server-id",
    "toolName": "read_file",
    "arguments": { "path": "/path/to/file.txt" }
  }
}
```

#### Telegram Messaging

```json
{
  "tool_call": "EXECUTE_MCP_TOOL",
  "args": {
    "serverId": "telegram-server-id",
    "toolName": "send_message",
    "arguments": { "text": "Hello from AI Agent!", "chat_id": "your_chat_id" }
  }
}
```

### 3. Discover Available Tools

Agents can discover all available tools using:

```json
{ "tool_call": "DISCOVER_ALL_MCP_TOOLS", "args": {} }
```

## Security Considerations

### File System Access

- The filesystem MCP server is restricted to the directory specified in `MCP_SERVER_FILESYSTEM_ROOT`
- Never set this to a sensitive directory like `/etc` or `/home`
- Consider using a dedicated directory for agent file operations

### API Keys

- Keep your API keys secure and never commit them to version control
- Use environment variables for all API keys
- Regularly rotate your API keys
- Monitor API usage to avoid unexpected charges

### Telegram Bot Security

- Keep your bot token secure and never share it publicly
- Only add your bot to channels/groups you trust
- Consider using a dedicated bot for agent operations
- Monitor bot activity to ensure it's not being misused

## Troubleshooting

### Server Won't Start

1. Check that all required environment variables are set
2. Verify API keys are valid
3. Check the backend logs for error messages
4. Ensure ports 8001, 8002, and 8003 are available

### Tools Not Discovered

1. Wait a few seconds after server start for tool discovery
2. Check the server status in the UI
3. Test the server connection manually
4. Verify the MCP server is responding on the correct port

### Telegram Bot Issues

1. Verify your bot token is correct
2. Ensure your bot has permission to send messages to the specified chat
3. Check that the chat ID is correct (use getUpdates to verify)
4. Make sure your bot is not blocked by users or channels

### API Rate Limits

- SerpAPI: 100 searches/month on free tier
- Google Custom Search: 10,000 queries/day
- Telegram: 30 messages per second for bots

## Advanced Configuration

### Custom MCP Servers

You can also add custom MCP servers by providing their URL:

1. Choose "Custom Server" when adding a new server
2. Provide the server URL (must expose `/tools` and `/execute` endpoints)
3. The server will be tested and tools will be discovered automatically

### Multiple Instances

You can run multiple instances of the same MCP server type by:

1. Adding them as custom servers with different URLs
2. Configuring them to use different ports
3. Using different API keys for different instances

### Telegram Bot Features

- **Personal Messages**: Send messages to individual users
- **Group Messages**: Send messages to groups (bot must be member)
- **Channel Posts**: Post messages to channels (bot must be admin)
- **Rich Media**: Support for text, images, documents, and more
- **Markdown**: Format messages with markdown syntax

## Support

For issues with specific MCP servers:

- **Web Search**: Check [SerpAPI documentation](https://serpapi.com/docs) or [Google Custom Search API](https://developers.google.com/custom-search/v1/overview)
- **File System**: Check [MCP Filesystem Server](https://github.com/modelcontextprotocol/server-filesystem)
- **Telegram**: Check [Telegram Bot API](https://core.telegram.org/bots/api) or [MCP Telegram Server](https://github.com/modelcontextprotocol/server-telegram)
