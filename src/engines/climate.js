function toMap(snapshot) {
  const map = new Map();
  for (const file of snapshot.files || []) {
    map.set(file.path, file);
  }
  return map;
}

function stddev(values) {
  if (values.length <= 1) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function normalizeSeries(values) {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  if (max === 0) return values.map(() => 0);
  return values.map((v) => v / max);
}

export function computeClimate(currentFiles, historicalSnapshots) {
  const history = [...historicalSnapshots].slice(-12);
  const currentPaths = currentFiles.map((f) => f.path);
  const volatilityRaw = [];
  const perFileDetails = {};

  for (const path of currentPaths) {
    const changes = [];
    const lineDeltas = [];
    const sizeDeltas = [];
    const fingerprintChanges = [];

    let prev = null;
    for (const snapshot of history) {
      const map = toMap(snapshot);
      const now = map.get(path);
      if (now && prev) {
        lineDeltas.push(Math.abs(now.lines - prev.lines));
        sizeDeltas.push(Math.abs(now.size - prev.size));
        fingerprintChanges.push(now.fingerprint !== prev.fingerprint ? 1 : 0);
      } else if (now && !prev) {
        lineDeltas.push(now.lines);
        sizeDeltas.push(now.size);
        fingerprintChanges.push(1);
      }
      changes.push(now ? 1 : 0);
      prev = now || null;
    }

    const activity = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    const lineJitter = stddev(lineDeltas);
    const sizeJitter = stddev(sizeDeltas);
    const mutationRate = fingerprintChanges.length
      ? fingerprintChanges.reduce((a, b) => a + b, 0) / fingerprintChanges.length
      : 0;

    const raw = activity * 0.2 + mutationRate * 0.4 + (lineJitter / 100) * 0.25 + (sizeJitter / 1000) * 0.15;
    volatilityRaw.push(raw);

    perFileDetails[path] = {
      raw,
      activity: Number(activity.toFixed(4)),
      mutationRate: Number(mutationRate.toFixed(4)),
      lineJitter: Number(lineJitter.toFixed(4)),
      sizeJitter: Number(sizeJitter.toFixed(4)),
    };
  }

  const normalized = normalizeSeries(volatilityRaw);
  for (let i = 0; i < currentPaths.length; i += 1) {
    const p = currentPaths[i];
    perFileDetails[p].volatility = Number(Math.min(1, normalized[i]).toFixed(4));
  }

  return perFileDetails;
}
