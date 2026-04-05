import fs from 'node:fs/promises';
import path from 'node:path';

function defaultStoreDir(rootDir) {
  return path.join(rootDir, '.codebrain');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function loadSnapshots(rootDir, options = {}) {
  const storeDir = options.storeDir || defaultStoreDir(rootDir);
  const file = path.join(storeDir, 'snapshots.jsonl');

  try {
    const content = await fs.readFile(file, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function saveSnapshot(rootDir, snapshot, options = {}) {
  const storeDir = options.storeDir || defaultStoreDir(rootDir);
  await ensureDir(storeDir);

  const lineFile = path.join(storeDir, 'snapshots.jsonl');
  const latestFile = path.join(storeDir, 'latest.json');

  await fs.appendFile(lineFile, `${JSON.stringify(snapshot)}\n`, 'utf8');
  await fs.writeFile(latestFile, JSON.stringify(snapshot, null, 2), 'utf8');

  return {
    storeDir,
    lineFile,
    latestFile,
  };
}

export async function loadLatestSnapshot(rootDir, options = {}) {
  const storeDir = options.storeDir || defaultStoreDir(rootDir);
  const latestFile = path.join(storeDir, 'latest.json');

  try {
    const content = await fs.readFile(latestFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}
