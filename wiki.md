# Project Summary
The AI Agent Deployment Platform enables users to deploy and manage AI agents both locally and online, leveraging Google's A2A (Agent-to-Agent) communication for efficient inter-agent collaboration. This platform integrates with Multi-Agent Communication Protocol (MCP) servers, allowing agents to function cohesively as teams. Users can interact with agents through a chat interface, assign tasks, and monitor agent memory, enhancing the overall experience in managing AI functionalities.

# Project Module Description
- **Dashboard:** Displays agent statistics, recent activities, and MCP server status.
- **Agents Management:** View, filter, and manage AI agents with various deployment options.
- **Crews:** Create and manage collaborative agent teams.
- **MCP Server Integration:** Connect to and manage Multi-Agent Communication Protocol servers.
- **Settings:** Configure default behaviors and Google A2A integration.
- **Agent Memory:** Retain memory of interactions and tasks.
- **Chat Interface:** Interact with agents through a chat interface.
- **Autonomous Task Execution:** Delegate tasks to agents for autonomous execution.

# Directory Tree
```plaintext
shadcn-ui/
├── README.md               # Project overview and setup instructions
├── components.json         # JSON configuration for components
├── eslint.config.js        # ESLint configuration file
├── index.html              # Main HTML file for the application
├── package.json            # Project dependencies and scripts
├── postcss.config.js       # PostCSS configuration
├── public/                 # Public assets (favicon, robots.txt)
│   ├── favicon.svg
│   └── robots.txt
├── src/                    # Source code for the application
│   ├── App.css
│   ├── App.tsx
│   ├── components/         # Reusable UI components
│   │   ├── agents/         # Components related to agent functionalities
│   │   ├── dashboard/
│   │   └── layout/
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utility functions and core logic
│   ├── pages/              # Application pages
│   ├── types/              # TypeScript type definitions
│   ├── vite-env.d.ts       # Vite environment type definitions
│   ├── vite.config.ts      # Vite configuration file
└── tailwind.config.ts      # Tailwind CSS configuration
```

# File Description Inventory
- **README.md:** Overview and instructions for the project.
- **index.html:** The entry point for the web application.
- **App.tsx:** Main application component that sets up routing and context providers.
- **components/**: Contains reusable UI components for different functionalities.
- **pages/**: Contains components for each page of the application (Dashboard, Agents, Crews, etc.).
- **types/**: TypeScript type definitions for the application.
- **lib/**: Core functionalities including agent execution, memory management, and A2A communication.
- **vite.config.ts:** Configuration file for Vite, now includes the node-resolve plugin to fix module resolution issues.

# Technology Stack
- **React:** Frontend library for building user interfaces.
- **TypeScript:** For type safety and better development experience.
- **Vite:** Build tool for faster development and optimized production builds.
- **Tailwind CSS:** Utility-first CSS framework for styling.
- **TanStack Query:** For data fetching and state management.
- **Lucide React:** Icons for UI components.
- **@rollup/plugin-node-resolve:** Plugin to resolve Node.js modules during the build process.

# Usage
1. **Install Dependencies:** Run `pnpm install` to install the required packages.
2. **Build the Project:** Use `pnpm run build` to create a production build.
3. **Run the Application:** Start the development server with `pnpm run dev`.
