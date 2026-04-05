import { computeGravity } from './engines/gravity.js';
import { computeClimate } from './engines/climate.js';
import { simulateTrajectory } from './engines/simulator.js';

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function buildMemoryModel(scan, history) {
  const gravity = computeGravity(scan.files);
  const climate = computeClimate(scan.files, history);
  const trajectory = simulateTrajectory(scan, history);

  const files = scan.files.map((file) => {
    const g = gravity[file.path] || {
      influence: 0,
      gravityRank: 0,
      incoming: 0,
      outgoing: 0,
      dependents: [],
    };
    const c = climate[file.path] || {
      volatility: 0,
      raw: 0,
      activity: 0,
      mutationRate: 0,
      lineJitter: 0,
      sizeJitter: 0,
    };

    const normalizedSize = clamp01(file.size / 10000);
    const normalizedLines = clamp01(file.lines / 500);

    const fragility = clamp01(c.volatility * 0.5 + normalizedLines * 0.2 + normalizedSize * 0.1 + g.influence * 0.2);
    const resilience = clamp01(1 - fragility + g.incoming * 0.015 - c.mutationRate * 0.1);

    const cognitiveLoad = clamp01(g.outgoing / 20 + normalizedLines * 0.35 + c.volatility * 0.35);

    return {
      ...file,
      influence: g,
      climate: c,
      health: {
        fragility: Number(fragility.toFixed(4)),
        resilience: Number(resilience.toFixed(4)),
        cognitiveLoad: Number(cognitiveLoad.toFixed(4)),
      },
    };
  });

  const byPath = Object.fromEntries(files.map((f) => [f.path, f]));

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      fileCount: files.length,
      historyDepth: history.length,
    },
    system: {
      trajectory,
    },
    files,
    byPath,
  };
}
