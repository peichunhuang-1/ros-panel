# ros-panel

A React component library + Node.js server for controlling ROS2 robots via a web UI.

Components automatically discover topics, services, and actions from a running ROS2 graph and render JSON Schema–driven forms for publishing and calling them.

## Requirements

- Docker + Docker Compose (all commands run inside containers — no local ROS2 or Node.js install required)

---

## Running the server

The backend connects to your ROS2 environment via rclnodejs and exposes a REST + SSE API.

```bash
docker compose up server
```

Server starts at **http://localhost:3000**. Source files under `server/` and `bin/` are mounted, so edits take effect on restart without rebuilding.

```bash
docker compose restart server
```

Stop:

```bash
docker compose down
```

---

## Demo UI

A Vite dev server that renders `RosControlPanel` connected to the server at `localhost:3000`.

```bash
# Start server first (if not already running)
docker compose up server --detach

# Start the demo frontend
docker compose --profile demo up demo
```

Open **http://localhost:5173** in your browser. The sidebar polls the server every 2 seconds and populates with Nodes, Topics, and Services as they are discovered.

Hot reload is active — edits to files under `src/` reflect immediately in the browser.

Stop:

```bash
docker compose --profile demo down
```

---

## Tests

### Schema generation tests

Runs inside the ROS2 container against real message definitions installed via `apt`. Output JSON files are written to `test-output/`.

```bash
docker compose --profile test run --rm test
```

### Integration tests (server API with live ROS2 nodes)

Starts Python test nodes (topic publisher, service server, action server) alongside the ros-panel server and exercises the full HTTP API including SSE streaming for action feedback.

```bash
docker compose --profile integration-test run --rm integration-test
```

### React component tests

Runs Vitest + React Testing Library in a plain Node.js container (no ROS2 needed).

```bash
docker compose --profile frontend-test run --rm frontend-test
```

---

## Publishing to npm

### 1. Build the library

Build runs inside Docker — no local Node.js install required.

```bash
docker compose --profile build-lib run --rm build-lib
```

This writes the compiled output to `dist/` on your host machine.

### 2. Preview what will be published

```bash
npm pack --dry-run
```

The package ships `dist/` (compiled components + types), `server/` (Express API), `bin/` (CLI entry), `README.md`, and `LICENSE`.

### 3. Log in and publish

```bash
npm login
npm publish --ignore-scripts   # dist/ already built in step 1
```

`--ignore-scripts` skips the `prepublishOnly` build step since you already ran it in Docker.

To publish a new version, bump the version first:

```bash
npm version patch   # or minor / major
npm publish --ignore-scripts
```

> **Note:** If the name `ros-panel` is already taken on the public registry, use a scoped name instead — update the `"name"` field in `package.json` to `"@your-npm-username/ros-panel"` and pass `--access public` on first publish:
> ```bash
> npm publish --ignore-scripts --access public
> ```

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/topics` | List discovered topics |
| `GET` | `/services` | List discovered services |
| `GET` | `/actions` | List discovered action servers |
| `GET` | `/nodes` | List active ROS2 nodes |
| `POST` | `/add/topic` | Register a topic publisher, returns JSON schema |
| `POST` | `/add/service` | Register a service client, returns JSON schema |
| `POST` | `/add/action` | Register an action client, returns JSON schema |
| `POST` | `/delete/topic` | Deregister a topic publisher |
| `POST` | `/delete/service` | Deregister a service client |
| `POST` | `/delete/action` | Deregister an action client |
| `POST` | `/call/service` | Publish to a topic or call a service, returns result |
| `POST` | `/call/action` | Send an action goal — SSE stream of `feedback` events then a `result` event |

### SSE action stream format

`POST /call/action` responds with `Content-Type: text/event-stream`. Each line is one of:

```
event: feedback
data: {"sequence":[0,1,1,2]}

event: result
data: {"sequence":[0,1,1,2,3]}
```

---

## Project layout

```
bin/            Server entry point (bin/server.js)
server/         Server source
  server.js     Express app — REST + SSE endpoints
  schema_gen.js ROS2 IDL → JSON Schema parser
src/            React component library source
  components/   RosProvider, RosControlPanel, TopicPublisher, ServiceCaller, Form
  context/      RosContext
  demo.tsx      Demo app entry (used by the demo Docker service)
  __tests__/    Vitest component tests
test/           Server-side tests
  schema_gen.test.js    Schema generation unit + integration tests
  server_api.test.js    HTTP API integration tests
  ros_test_nodes.py     Python ROS2 test nodes (topic / service / action)
  integration.sh        Integration test runner script
```