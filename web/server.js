import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import next from 'next';
import { createPanel } from './api.js';

const port = Number(process.env.PORT || 6868);
const host = process.env.PANEL_BIND_HOST || '127.0.0.1';
const dir = fileURLToPath(new URL('.', import.meta.url));
const app = next({ dev: process.argv.includes('--dev'), dir });
const api = createPanel();
const handle = app.getRequestHandler();

await app.prepare();
createServer((request, response) => {
  if (request.url?.startsWith('/api/')) return api.emit('request', request, response);
  return handle(request, response);
}).listen(port, host, () => console.log(`Services Control Panel listening on ${host}:${port}`));
