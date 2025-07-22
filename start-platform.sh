#!/bin/bash
# Enhanced Platform Management Script
# Usage:
#   ./start-platform.sh               - Start enhanced system (default)
#   ./start-platform.sh enhanced      - Start enhanced system explicitly
#   ./start-platform.sh old           - Start old system for comparison
#   ./start-platform.sh both          - Start both systems side-by-side

#   pnpm install
#   pnpm run dev


# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

set -e

# Default to enhanced system
SYSTEM_MODE=${1:-enhanced}

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║               AI Agent Platform Manager                      ║${NC}"
echo -e "${CYAN}║          Enhanced vs Original System Comparison             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to find free port starting from given port
find_free_port() {
    local port=$1
    while check_port $port; do
        port=$((port + 1))
    done
    echo $port
}

case $SYSTEM_MODE in
    "enhanced"|"")
        echo -e "${GREEN}🚀 Starting Enhanced Agent Communication System${NC}"
        echo -e "${YELLOW}   Features: CrewAI-level collaboration, human oversight, shared memory${NC}"
        echo ""
        BACKEND_PORT=4000
        FRONTEND_PORT=5173
        ;;
    "old")
        echo -e "${BLUE}🔄 Starting Original System for Comparison${NC}"
        echo -e "${YELLOW}   Features: Basic agent communication, local storage${NC}"
        echo ""
        BACKEND_PORT=4001
        FRONTEND_PORT=5174
        ;;
    "both")
        echo -e "${PURPLE}🔀 Starting Both Systems Side-by-Side${NC}"
        echo -e "${YELLOW}   Enhanced: localhost:4000 (frontend: 5173)${NC}"
        echo -e "${YELLOW}   Original: localhost:4001 (frontend: 5174)${NC}"
        echo ""
        ;;
    *)
        echo -e "${RED}❌ Invalid option. Use: enhanced, old, or both${NC}"
        exit 1
        ;;
esac

# Start Redis and PostgreSQL using Docker Compose
if command -v docker-compose &> /dev/null; then
  docker-compose up -d
else
  docker compose up -d
fi
echo -e "${GREEN}✅ Redis and PostgreSQL (and pgAdmin) started.${NC}"

# Build agent containers
echo -e "${CYAN}🏗️  Building agent containers...${NC}"
if [ -d backend/agent-node ]; then
  docker build -t agent-node:latest backend/agent-node
fi
if [ -d backend/agent-python ]; then
  docker build -t agent-python:latest backend/agent-python
fi
echo -e "${GREEN}✅ Agent containers built.${NC}"

# Function to start backend
start_backend() {
    local port=$1
    local system_name=$2
    local working_dir=$3

    echo -e "${CYAN}🔧 Starting $system_name backend on port $port...${NC}"
    cd $working_dir

    # Check if node_modules exists, if not install
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📥 Installing backend dependencies...${NC}"
        npm install
    fi

    # Set port and start
    PORT=$port npm start &
    local pid=$!
    echo $pid > "../.${system_name,,}_backend.pid"
    cd ..

    echo -e "${GREEN}✅ $system_name backend started (PID: $pid, Port: $port).${NC}"
}

# Function to start frontend
start_frontend() {
    local port=$1
    local system_name=$2
    local working_dir=$3

    echo -e "${CYAN}🎨 Starting $system_name frontend on port $port...${NC}"
    cd $working_dir

    # Check if node_modules exists, if not install
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📥 Installing frontend dependencies...${NC}"
        npm install
    fi

    # Start with specific port
    npm run dev -- --port $port &
    local pid=$!
    echo $pid > "../.${system_name,,}_frontend.pid"
    cd ..

    echo -e "${GREEN}✅ $system_name frontend started (PID: $pid, Port: $port).${NC}"
}

# Start systems based on mode
if [ "$SYSTEM_MODE" = "enhanced" ] || [ "$SYSTEM_MODE" = "both" ]; then
    echo -e "\n${GREEN}🚀 Starting Enhanced System...${NC}"

    # Check if enhanced system ports are available
    if [ "$SYSTEM_MODE" = "enhanced" ]; then
        BACKEND_PORT=$(find_free_port 4000)
        FRONTEND_PORT=$(find_free_port 5173)
    else
        BACKEND_PORT=4000
        FRONTEND_PORT=5173
    fi

    # Start enhanced backend
    start_backend $BACKEND_PORT "Enhanced" "backend"

    # Start enhanced frontend (current directory)
    start_frontend $FRONTEND_PORT "Enhanced" "."

    # Store enhanced system info
    echo "ENHANCED_BACKEND_PORT=$BACKEND_PORT" > .enhanced_ports
    echo "ENHANCED_FRONTEND_PORT=$FRONTEND_PORT" >> .enhanced_ports
fi

if [ "$SYSTEM_MODE" = "old" ] || [ "$SYSTEM_MODE" = "both" ]; then
    echo -e "\n${BLUE}🔄 Starting Original System...${NC}"

    # Check if we have the original system in a separate directory
    if [ ! -d "../original" ] && [ -d "../backend" ]; then
        echo -e "${YELLOW}📁 Original system detected in parent directory...${NC}"
        ORIGINAL_BACKEND="../backend"
        ORIGINAL_FRONTEND="../"
    elif [ -d "./original-backend" ]; then
        ORIGINAL_BACKEND="./original-backend"
        ORIGINAL_FRONTEND="./original-frontend"
    else
        echo -e "${YELLOW}⚠️  Original system not found. Using current system on different ports...${NC}"
        ORIGINAL_BACKEND="backend"
        ORIGINAL_FRONTEND="."
    fi

    # Set ports for original system
    if [ "$SYSTEM_MODE" = "old" ]; then
        BACKEND_PORT=$(find_free_port 4000)
        FRONTEND_PORT=$(find_free_port 5173)
    else
        BACKEND_PORT=4001
        FRONTEND_PORT=5174
    fi

    # Start original backend
    start_backend $BACKEND_PORT "Original" "$ORIGINAL_BACKEND"

    # Start original frontend
    start_frontend $FRONTEND_PORT "Original" "$ORIGINAL_FRONTEND"

    # Store original system info
    echo "ORIGINAL_BACKEND_PORT=$BACKEND_PORT" > .original_ports
    echo "ORIGINAL_FRONTEND_PORT=$FRONTEND_PORT" >> .original_ports
fi

# Wait a moment for services to start
echo -e "\n${CYAN}⏳ Waiting for services to initialize...${NC}"
sleep 3

# Display status and access information
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    🎉 Platform Status                       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${PURPLE}📊 Infrastructure Services:${NC}"
echo -e "   🔴 Redis: localhost:6379"
echo -e "   🐘 PostgreSQL: localhost:5432 (user: postgres, pass: postgres, db: agentdb)"
echo -e "   🌐 pgAdmin: http://localhost:5050 (admin@admin.com / admin)"
echo ""

if [ "$SYSTEM_MODE" = "enhanced" ] || [ "$SYSTEM_MODE" = "both" ]; then
    source .enhanced_ports 2>/dev/null || true
    echo -e "${GREEN}🚀 Enhanced System (CrewAI-level features):${NC}"
    echo -e "   🔧 Backend API: http://localhost:${ENHANCED_BACKEND_PORT:-4000}"
    echo -e "   🎨 Frontend UI: http://localhost:${ENHANCED_FRONTEND_PORT:-5173}"
    echo -e "   🤝 Collaboration: http://localhost:${ENHANCED_FRONTEND_PORT:-5173}/collaboration"
    echo -e "   ✨ Features: Multi-agent workflows, human approval, shared memory"
    echo ""
fi

if [ "$SYSTEM_MODE" = "old" ] || [ "$SYSTEM_MODE" = "both" ]; then
    source .original_ports 2>/dev/null || true
    echo -e "${BLUE}🔄 Original System (comparison baseline):${NC}"
    echo -e "   🔧 Backend API: http://localhost:${ORIGINAL_BACKEND_PORT:-4001}"
    echo -e "   🎨 Frontend UI: http://localhost:${ORIGINAL_FRONTEND_PORT:-5174}"
    echo -e "   📝 Features: Basic agent communication, local storage"
    echo ""
fi

echo -e "${PURPLE}🛠️  Useful Commands:${NC}"
echo -e "   🔍 View Redis data: docker exec -it \$(docker ps -qf \"ancestor=redis:7\") redis-cli"
echo -e "   📊 Check running processes: ps aux | grep -E '(node|npm)'"
echo -e "   🛑 Stop platform: ./stop-platform.sh"
echo ""

echo -e "${YELLOW}🧪 Testing Enhanced Features:${NC}"
echo -e "   1. Navigate to the Collaboration page"
echo -e "   2. Create agents and test cross-agent communication"
echo -e "   3. Set up shared contexts and collaborative tasks"
echo -e "   4. Test human approval workflows"
echo -e "   5. Monitor agent states and performance"
echo ""

echo -e "${GREEN}✅ Platform startup complete!${NC}"

# Create a status file for the stop script
cat > .platform_status << EOF
SYSTEM_MODE=$SYSTEM_MODE
ENHANCED_RUNNING=$([[ "$SYSTEM_MODE" =~ enhanced|both ]] && echo "true" || echo "false")
ORIGINAL_RUNNING=$([[ "$SYSTEM_MODE" =~ old|both ]] && echo "true" || echo "false")
START_TIME=$(date)
EOF

echo -e "${CYAN}💡 Tip: Use './stop-platform.sh' to cleanly shutdown all services${NC}"
