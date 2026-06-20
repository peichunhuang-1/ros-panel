#!/usr/bin/env bash
set -eo pipefail

source /opt/ros/humble/setup.bash

SCHEMA_DIR=/tmp/integration-schemas
export SCHEMA_DIR
export SERVER_URL=http://localhost:3000

cleanup() {
  echo "[integration] Stopping background processes..."
  kill "$ROS_PID" "$SERVER_PID" 2>/dev/null || true
  wait "$ROS_PID" "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "[integration] Starting ROS2 test nodes..."
python3 /app/test/ros_test_nodes.py &
ROS_PID=$!

echo "[integration] Starting ros-panel server (will generate schemas)..."
PORT=3000 node /app/bin/server.js &
SERVER_PID=$!

echo "[integration] Waiting for server to be ready..."
until curl -sf "$SERVER_URL/" > /dev/null 2>&1; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[integration] ERROR: server process died"
    exit 1
  fi
  sleep 1
done

echo "[integration] Server ready. Waiting for ROS2 graph discovery..."
sleep 3

echo "[integration] Running API tests..."
node --test /app/test/server_api.test.js