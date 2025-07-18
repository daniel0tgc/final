#!/bin/bash
#to run server
#./start-platform.sh

#to make command executable:
#chmod +x start-platform.sh stop-platform.sh

# to view redis
#docker exec -it $(docker ps -qf "ancestor=redis:7") redis-cli

set -e

# Start Redis and PostgreSQL using Docker Compose (use docker compose if docker-compose is not available)
if command -v docker-compose &> /dev/null; then
  docker-compose up -d
else
  docker compose up -d
fi

echo "[+] Redis and PostgreSQL (and pgAdmin) started."

# Build agent containers
if [ -d backend/agent-node ]; then
  docker build -t agent-node:latest backend/agent-node
fi
if [ -d backend/agent-python ]; then
  docker build -t agent-python:latest backend/agent-python
fi

echo "[+] Agent containers built."

# Start backend
cd backend
npm install
npm start &
BACKEND_PID=$!
cd ..

echo "[+] Backend started."

# Start frontend (assume root or src/)
if [ -f package.json ]; then
  npm install
  npm run dev &
  FRONTEND_PID=$!
elif [ -d src ] && [ -f src/package.json ]; then
  cd src
  npm install
  npm run dev &
  FRONTEND_PID=$!
  cd ..
else
  echo "[!] Could not find frontend package.json."
fi

echo "[+] Frontend started."

echo "---"
echo "Platform is running!"
echo "- Redis: localhost:6379"
echo "- PostgreSQL: localhost:5432 (user: postgres, pass: postgres, db: agentdb)"
echo "- Backend: http://localhost:4000 (default)"
echo "- Frontend: http://localhost:5173 (default for Vite)"
echo "- pgAdmin (PostgreSQL GUI): http://localhost:5050"
echo "    Login: admin@admin.com / admin"
echo "    After login, add a new server with:"
echo "      Host: postgres   Port: 5432   User: postgres   Password: postgres   DB: agentdb"
echo "---"
echo "To stop everything, run ./stop-platform.sh"
