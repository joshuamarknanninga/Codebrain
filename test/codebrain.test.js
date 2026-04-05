import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { scanRepository } from '../src/scanner.js';
import { computeGravity } from '../src/engines/gravity.js';
import { computeClimate } from '../src/engines/climate.js';
import { simulateTrajectory } from '../src/engines/simulator.js';
import { buildMemoryModel } from '../src/memory.js';
import { generateInsights } from '../src/reasoner.js';
import { loadSnapshots, saveSnapshot } from '../src/store.js';

async function makeTempRepo() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'codebrain-'));
  await fs.writeFile(path.join(dir, 'a.js'), "import x from './b.js';\nexport const a = x + 1;\n", 'utf8');
  await fs.writeFile(path.join(dir, 'b.js'), "const c = require('./c.js');\nmodule.exports = c + 1;\n", 'utf8');
  await fs.writeFile(path.join(dir, 'c.js'), "export default 1;\n", 'utf8');
  return dir;
}

test('scanner collects files and dependencies', async () => {
  const repo = await makeTempRepo();
  const scan = await scanRepository(repo);

  assert.equal(scan.fileCount, 3);
  const aFile = scan.files.find((f) => f.path === 'a.js');
  assert.ok(aFile);
  assert.deepEqual(aFile.localDependencies, ['b.js']);
  assert.ok(typeof aFile.fingerprint === 'string');
});

test('gravity ranks dependencies by influence', async () => {
  const files = [
    { path: 'a.js', localDependencies: ['b.js'], externalDependencies: [], size: 10, lines: 1 },
    { path: 'b.js', localDependencies: ['c.js'], externalDependencies: [], size: 10, lines: 1 },
    { path: 'c.js', localDependencies: [], externalDependencies: [], size: 10, lines: 1 },
  ];

  const gravity = computeGravity(files);
  assert.ok(gravity['c.js'].influence >= gravity['a.js'].influence);
});

test('climate and simulator use historical snapshots', async () => {
  const history = [
    { files: [{ path: 'x.js', lines: 10, size: 100, fingerprint: 'aa' }] },
    { files: [{ path: 'x.js', lines: 20, size: 150, fingerprint: 'bb' }] },
    { files: [{ path: 'x.js', lines: 25, size: 170, fingerprint: 'cc' }] },
  ];
  const current = { files: [{ path: 'x.js', lines: 30, size: 200, fingerprint: 'dd', localDependencies: [], externalDependencies: [] }] };

  const climate = computeClimate(current.files, history);
  assert.ok(climate['x.js'].volatility > 0);

  const trajectory = simulateTrajectory(current, history);
  assert.ok(Array.isArray(trajectory.projections));
  assert.equal(trajectory.projections.length, 4);
});

test('memory + reasoner generate rich diagnosis', async () => {
  const scan = {
    files: [
      {
        path: 'core.js',
        size: 1000,
        lines: 60,
        localDependencies: ['leaf.js'],
        externalDependencies: ['fs'],
        dependencyCount: 2,
        fingerprint: 'a1',
      },
      {
        path: 'leaf.js',
        size: 200,
        lines: 20,
        localDependencies: [],
        externalDependencies: [],
        dependencyCount: 0,
        fingerprint: 'a2',
      },
    ],
  };

  const history = [
    { files: [{ path: 'core.js', lines: 10, size: 100, fingerprint: '0' }, { path: 'leaf.js', lines: 20, size: 200, fingerprint: 'a2' }] },
  ];

  const memory = buildMemoryModel(scan, history);
  const insights = generateInsights(memory);

  assert.equal(memory.files.length, 2);
  assert.ok(insights.systemDiagnosis);
  assert.ok(insights.recommendations.length >= 1);
});

test('store persists and reloads snapshots', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'codebrain-store-'));
  const snapshot = { generatedAt: new Date().toISOString(), files: [] };

  await saveSnapshot(repo, snapshot);
  const history = await loadSnapshots(repo);

  assert.equal(history.length, 1);
  assert.equal(history[0].generatedAt, snapshot.generatedAt);
});
