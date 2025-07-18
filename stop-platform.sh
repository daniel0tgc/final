#!/bin/bash
#to stop servers
#./stop-platform.sh
set +e

# Stop backend and frontend (find npm and node processes)
echo "[+] Stopping backend and frontend..."
kill $(ps aux | grep 'node index.js' | grep -v grep | awk '{print $2}') 2>/dev/null
kill $(ps aux | grep 'npm run dev' | grep -v grep | awk '{print $2}') 2>/dev/null

# Stop Docker Compose services (use docker compose if docker-compose is not available)
if command -v docker-compose &> /dev/null; then
  docker-compose down
else
  docker compose down
fi

# Optionally stop/remove agent containers (if any are running)
AGENT_CONTAINERS=$(docker ps -a --filter "name=agent_" --format "{{.ID}}")
if [ ! -z "$AGENT_CONTAINERS" ]; then
  echo "[+] Stopping/removing agent containers..."
  docker rm -f $AGENT_CONTAINERS
fi

echo "---"
echo "Platform stopped."
