import { spawn } from 'node:child_process';

console.log('[Next-Cash] Starting full-stack development environment...');

// Start Hono backend server with tsx watch
const server = spawn('npx', ['tsx', 'watch', 'server/src/index.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3001' },
});

// Start Vite dev server
const client = spawn('npx', ['vite', '--port', '5173'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
  client.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
  client.kill('SIGTERM');
  process.exit(0);
});
