#!/bin/bash
# Enhanced Platform Stop Script
# Cleanly stops both enhanced and original systems

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

set +e

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║               Stopping AI Agent Platform                    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to stop process by PID file
stop_by_pid() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${CYAN}🛑 Stopping $service_name (PID: $pid)...${NC}"
            kill "$pid" 2>/dev/null
            sleep 2
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "${YELLOW}⚠️  Force stopping $service_name...${NC}"
                kill -9 "$pid" 2>/dev/null
            fi
            echo -e "${GREEN}✅ $service_name stopped.${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name was not running.${NC}"
        fi
        rm -f "$pid_file"
    fi
}

# Read platform status if available
if [ -f ".platform_status" ]; then
    source .platform_status
    echo -e "${PURPLE}📊 Platform started: $START_TIME${NC}"
    echo -e "${PURPLE}🎯 Mode: $SYSTEM_MODE${NC}"
    echo ""
fi

# Stop Enhanced System processes
if [ -f ".enhanced_backend.pid" ] || [ -f ".enhanced_frontend.pid" ]; then
    echo -e "${GREEN}🚀 Stopping Enhanced System...${NC}"
    stop_by_pid ".enhanced_backend.pid" "Enhanced Backend"
    stop_by_pid ".enhanced_frontend.pid" "Enhanced Frontend"
    echo ""
fi

# Stop Original System processes
if [ -f ".original_backend.pid" ] || [ -f ".original_frontend.pid" ]; then
    echo -e "${BLUE}🔄 Stopping Original System...${NC}"
    stop_by_pid ".original_backend.pid" "Original Backend"
    stop_by_pid ".original_frontend.pid" "Original Frontend"
    echo ""
fi

# Fallback: Stop any remaining npm and node processes
echo -e "${CYAN}🧹 Cleaning up remaining processes...${NC}"
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "node index.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Stop Docker Compose services
echo -e "${CYAN}🐳 Stopping Docker services...${NC}"
if command -v docker-compose &> /dev/null; then
  docker-compose down
else
  docker compose down
fi

# Optionally stop/remove agent containers (if any are running)
AGENT_CONTAINERS=$(docker ps -a --filter "name=agent_" --format "{{.ID}}")
if [ ! -z "$AGENT_CONTAINERS" ]; then
  echo -e "${CYAN}🤖 Stopping/removing agent containers...${NC}"
  docker rm -f $AGENT_CONTAINERS
fi

# Clean up status files
echo -e "${CYAN}🧽 Cleaning up temporary files...${NC}"
rm -f .platform_status
rm -f .enhanced_ports
rm -f .original_ports
rm -f .enhanced_backend.pid
rm -f .enhanced_frontend.pid
rm -f .original_backend.pid
rm -f .original_frontend.pid

# Final status check
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    🏁 Shutdown Complete                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}✅ All services stopped successfully!${NC}"
echo ""
echo -e "${PURPLE}🚀 To restart the platform:${NC}"
echo -e "   ./start-platform.sh enhanced    # Enhanced system only"
echo -e "   ./start-platform.sh old         # Original system only"
echo -e "   ./start-platform.sh both        # Both systems side-by-side"
echo ""
echo -e "${CYAN}💡 Infrastructure services (Redis, PostgreSQL) are stopped${NC}"
echo -e "${CYAN}   Use 'docker-compose up -d' to restart just the infrastructure${NC}"
