# AI Agent Deployment Platform

A platform for deploying and managing AI agents with local deployment and online connectivity via Google's A2A.

## Features

- **Deploy AI Agents**: Create and configure different types of AI agents
- **Agent Memory**: Agents retain memory of their interactions and tasks
- **MCP Server Integration**: Connect agents to Multi-Agent Communication Protocol servers
- **Crew Collaboration**: Group agents together for collaborative tasks
- **A2A Communication**: Connect online agents to Google's Agent-to-Agent network
- **Chat Interface**: Interact with agents through a chat interface
- **Autonomous Task Execution**: Delegate autonomous tasks to agents

## Tech Stack

- **React**: Frontend UI library
- **TypeScript**: Type safety for development
- **Shadcn UI**: Component library
- **Tailwind CSS**: Styling
- **React Router**: Navigation
- **localStorage**: Client-side storage for memory and settings

## Getting Started

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

```bash
# Start development server
pnpm run dev
```

### Building

```bash
# Build for production
pnpm run build
```

## Agent Types

- **Assistant**: General purpose AI agent for various tasks
- **Researcher**: Specialized in gathering and analyzing information
- **Coder**: Focused on writing and optimizing code
- **Analyst**: Data analysis and visualization
- **Custom**: User-defined specialized agents

## Deployment Options

- **Local**: Deploy agents locally on your device or server
- **Online (A2A)**: Deploy with connectivity to Google's A2A network for inter-agent communication

## Project Structure

The codebase is organized as follows:

- `/src/components`: UI components
  - `/src/components/agents`: Agent-related components
  - `/src/components/dashboard`: Dashboard components
  - `/src/components/layout`: Layout components
  
- `/src/pages`: Application pages
  - `/src/pages/Index.tsx`: Dashboard page
  - `/src/pages/agents`: Agent management pages
  - `/src/pages/crews`: Crew management pages
  - `/src/pages/mcp-servers`: MCP server management
  - `/src/pages/settings`: Application settings

- `/src/lib`: Core functionality
  - `/src/lib/agent-execution.ts`: Agent execution logic
  - `/src/lib/agent-memory.ts`: Agent memory management
  - `/src/lib/a2a-communication.ts`: A2A communication
  - `/src/lib/mock-data.ts`: Mock data for demo purposes

- `/src/types`: TypeScript type definitions

## License

MIT