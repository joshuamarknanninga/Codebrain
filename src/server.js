import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRepository } from './scanner.js';
import { loadSnapshots, saveSnapshot } from './store.js';
import { buildMemoryModel } from './memory.js';
import { generateInsights } from './reasoner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

export async function generateSystemSnapshot(rootDir = repoRoot) {
  const history = await loadSnapshots(rootDir);
  const scan = await scanRepository(rootDir);
  const memory = buildMemoryModel(scan, history);
  const insights = generateInsights(memory);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    scan,
    memory,
    insights,
  };

  await saveSnapshot(rootDir, snapshot);
  return snapshot;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function createServer(rootDir = repoRoot) {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/api/snapshot') {
        const snapshot = await generateSystemSnapshot(rootDir);
        sendJson(res, 200, snapshot);
        return;
      }

      if (req.method === 'GET' && req.url === '/api/health') {
        sendJson(res, 200, { ok: true, service: 'CodeBrain', time: new Date().toISOString() });
        return;
      }

      sendJson(res, 404, {
        error: 'Not found',
        hint: 'Use GET /api/snapshot to generate a full system snapshot.',
      });
    } catch (error) {
      sendJson(res, 500, {
        error: 'Failed to generate snapshot',
        message: error.message,
      });
    }
  });
}

async function main() {
  const once = process.argv.includes('--once');

  if (once) {
    const snapshot = await generateSystemSnapshot(repoRoot);
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  const port = Number(process.env.PORT || 8787);
  const server = createServer(repoRoot);
  server.listen(port, () => {
    process.stdout.write(`CodeBrain server listening on http://localhost:${port}\n`);
  });
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    process.stderr.write(`Fatal: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
