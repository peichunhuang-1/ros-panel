# ── frontend-test stage (plain Node — no ROS2 needed) ────────────────
FROM node:20-slim AS frontend-test

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json vite.config.ts ./
COPY src/ ./src/
CMD ["npm", "run", "test:components"]

# ── ROS2 Humble + Node.js 20 image for ros-panel server ──────────────
FROM ros:humble AS base

SHELL ["/bin/bash", "-c"]

# Install Node.js 20 and extra ROS2 packages used in tests
RUN apt-get update && apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs \
        ros-humble-example-interfaces \
        ros-humble-nav2-msgs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies only (avoids pulling in dev/frontend deps)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev 2>/dev/null || npm install

# Generate rclnodejs JS bindings from the ROS2 message definitions
RUN source /opt/ros/humble/setup.bash && \
    node node_modules/rclnodejs/scripts/generate_messages.js

# Copy server source and tests
COPY bin/ ./bin/
COPY server/ ./server/
COPY test/ ./test/

ENV PORT=3000
ENV SCHEMA_DIR=/app/.ros-panel-schemas

EXPOSE 3000

CMD ["/bin/bash", "-c", "source /opt/ros/humble/setup.bash && node bin/server.js"]
