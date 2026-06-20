#!/usr/bin/env node
import path from 'path';
import url from 'url';
import { generateAllSchemas } from '../server/schema_gen.js';
import { startServer } from '../server/server.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const port      = parseInt(process.env.PORT ?? '3000');
const schemaDir = process.env.SCHEMA_DIR ?? path.join(process.cwd(), '.ros-panel-schemas');
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3001'];

console.log('[ros-panel] Generating ROS2 message schemas...');
await generateAllSchemas(schemaDir);

console.log('[ros-panel] Starting server...');
await startServer({ port, schemaDir, corsOrigins });
