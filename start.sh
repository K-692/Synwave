#!/usr/bin/env bash
# ==============================================================================
# Synwave Unified Development Runner
# Launches the Python Audio Intelligence Microservice (port 8765) and Vite
# Frontend Dev Server (port 5173) concurrently with unified logging and graceful
# shutdown on Ctrl+C.
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "  ___ _   _ _  ___          ___ __   _____ "
echo " / __| | | | \| \ \        / / /_\ \ / / __|"
echo " \__ \ |_| | .  |\ \  /\  / / / _ \ V /| _|  "
echo " |___/\__, |_|\_| \_\/  \/ / /_/ \_\_/ |___| "
echo "      |___/                                  "
echo -e "${NC}"
echo -e "${CYAN}Starting Synwave Unified Development Environment...${NC}\n"

# Resolve Project Root Directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Check for and Activate Python Virtual Environment
VENV_PATH=""
if [ -d "$PROJECT_ROOT/.venv" ]; then
    VENV_PATH="$PROJECT_ROOT/.venv"
elif [ -d "$PROJECT_ROOT/venv" ]; then
    VENV_PATH="$PROJECT_ROOT/venv"
fi

if [ -z "$VENV_PATH" ]; then
    echo -e "${RED}[ERROR] Python virtual environment not found (.venv or venv).${NC}"
    echo -e "${YELLOW}Please create and configure the environment first:${NC}"
    echo "  python3 -m venv .venv"
    echo "  source .venv/bin/activate"
    echo "  pip install -r requirements.txt"
    exit 1
fi

echo -e "${GREEN}[1/2] Activating Python virtual environment: ${VENV_PATH}${NC}"
# shellcheck disable=SC1090,SC1091
source "$VENV_PATH/bin/activate"

# Check Python and dependencies
if ! python3 -c "import fastapi, uvicorn, yt_dlp, demucs" 2>/dev/null; then
    echo -e "${YELLOW}[WARN] Required Python packages missing. Installing from requirements.txt...${NC}"
    pip install -r requirements.txt
fi

# Track child PIDs for cleanup
PY_PID=""
VITE_PID=""

cleanup() {
    echo -e "\n${YELLOW}Stopping Synwave services...${NC}"
    if [ -n "$PY_PID" ] && kill -0 "$PY_PID" 2>/dev/null; then
        echo -e "${CYAN}Stopping Python microservice (PID: $PY_PID)...${NC}"
        kill "$PY_PID" 2>/dev/null || true
    fi
    if [ -n "$VITE_PID" ] && kill -0 "$VITE_PID" 2>/dev/null; then
        echo -e "${CYAN}Stopping Vite frontend server (PID: $VITE_PID)...${NC}"
        kill "$VITE_PID" 2>/dev/null || true
    fi
    wait 2>/dev/null || true
    echo -e "${GREEN}Synwave services stopped cleanly.${NC}"
}

trap cleanup INT TERM EXIT

# Start Python Microservice
echo -e "${GREEN}[2/2] Launching Python YouTube Audio & Demucs Microservice (port 8765)...${NC}"
python3 server.py &
PY_PID=$!

# Brief pause to let python microservice initialize
sleep 1

# Start Frontend Vite Server
echo -e "${GREEN}Launching Vite Frontend Server...${NC}"
npx vite &
VITE_PID=$!

# Wait for both processes
wait $PY_PID $VITE_PID
