import fs from 'node:fs/promises';
import path from 'node:path';

const CODE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const IMPORT_RE = /import\s+(?:[^'"\n]+\s+from\s+)?['"]([^'"\n]+)['"]/g;
const DYNAMIC_IMPORT_RE = /import\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const REQUIRE_RE = /require\(\s*['"]([^'"\n]+)['"]\s*\)/g;

function shouldSkipDir(name, skipDirs) {
  return skipDirs.has(name) || name.startsWith('.');
}

function countLines(content) {
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

function extractDependencies(content) {
  const dependencies = new Set();

  for (const regex of [IMPORT_RE, DYNAMIC_IMPORT_RE, REQUIRE_RE]) {
    regex.lastIndex = 0;
    let match = regex.exec(content);
    while (match) {
      dependencies.add(match[1]);
      match = regex.exec(content);
    }
  }

  return [...dependencies];
}

function isCodeFile(filePath) {
  return CODE_EXTENSIONS.has(path.extname(filePath));
}

function toPosixRelative(rootDir, absolutePath) {
  const rel = path.relative(rootDir, absolutePath);
  return rel.split(path.sep).join('/');
}

function tryResolveLocalDep(fromFile, dep, rootDir, knownFilesByAbsolutePath) {
  if (!dep.startsWith('.') && !dep.startsWith('/')) {
    return null;
  }

  const base = dep.startsWith('/') ? path.join(rootDir, dep) : path.resolve(path.dirname(fromFile), dep);
  const candidates = [
    base,
    ...[...CODE_EXTENSIONS].map((ext) => `${base}${ext}`),
    ...[...CODE_EXTENSIONS].map((ext) => path.join(base, `index${ext}`)),
  ];

  for (const candidate of candidates) {
    if (knownFilesByAbsolutePath.has(candidate)) {
      return toPosixRelative(rootDir, candidate);
    }
  }

  return null;
}

export async function scanRepository(rootDir, options = {}) {
  const skipDirs = new Set(options.skipDirs || ['node_modules', '.git', '.codebrain']);
  const allFiles = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!shouldSkipDir(entry.name, skipDirs)) {
            await walk(absolutePath);
          }
          return;
        }

        if (!entry.isFile() || !isCodeFile(absolutePath)) {
          return;
        }

        const content = await fs.readFile(absolutePath, 'utf8');
        allFiles.push({
          absolutePath,
          path: toPosixRelative(rootDir, absolutePath),
          size: Buffer.byteLength(content, 'utf8'),
          lines: countLines(content),
          dependenciesRaw: extractDependencies(content),
          hashSeed: content,
        });
      }),
    );
  }

  await walk(rootDir);

  const known = new Set(allFiles.map((f) => f.absolutePath));

  const files = allFiles
    .map((file) => {
      const localDependencies = [];
      const externalDependencies = [];

      for (const dep of file.dependenciesRaw) {
        const resolved = tryResolveLocalDep(file.absolutePath, dep, rootDir, known);
        if (resolved) {
          localDependencies.push(resolved);
        } else {
          externalDependencies.push(dep);
        }
      }

      const fingerprint = createFingerprint(file.hashSeed);

      return {
        path: file.path,
        size: file.size,
        lines: file.lines,
        localDependencies,
        externalDependencies,
        dependencyCount: file.dependenciesRaw.length,
        fingerprint,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    rootDir,
    scannedAt: new Date().toISOString(),
    fileCount: files.length,
    files,
  };
}

function createFingerprint(content) {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
