# ROS2 Humble + Node.js 20 image for ros-panel server
FROM osrf/ros:humble-desktop

SHELL ["/bin/bash", "-c"]

# Install Node.js 20
RUN apt-get update && apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies only (avoids pulling in dev/frontend deps)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev 2>/dev/null || npm install

# Copy server source
COPY bin/ ./bin/
COPY server/ ./server/

ENV PORT=3000
ENV SCHEMA_DIR=/app/.ros-panel-schemas

EXPOSE 3000

CMD ["/bin/bash", "-c", "source /opt/ros/humble/setup.bash && node bin/server.js"]
