function aggregate(snapshot) {
  const files = snapshot.files || [];
  const lines = files.reduce((sum, f) => sum + f.lines, 0);
  const size = files.reduce((sum, f) => sum + f.size, 0);
  return {
    lines,
    size,
    fileCount: files.length,
  };
}

function derivative(values) {
  if (values.length < 2) return [];
  const out = [];
  for (let i = 1; i < values.length; i += 1) {
    out.push(values[i] - values[i - 1]);
  }
  return out;
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function simulateTrajectory(currentSnapshot, historicalSnapshots) {
  const timeline = [...historicalSnapshots, currentSnapshot].slice(-24);
  const aggregates = timeline.map(aggregate);

  const lineSeries = aggregates.map((a) => a.lines);
  const sizeSeries = aggregates.map((a) => a.size);
  const fileSeries = aggregates.map((a) => a.fileCount);

  const lineVelocitySeries = derivative(lineSeries);
  const sizeVelocitySeries = derivative(sizeSeries);
  const fileVelocitySeries = derivative(fileSeries);

  const lineAccelerationSeries = derivative(lineVelocitySeries);
  const sizeAccelerationSeries = derivative(sizeVelocitySeries);
  const fileAccelerationSeries = derivative(fileVelocitySeries);

  const lineVelocity = average(lineVelocitySeries.slice(-6));
  const sizeVelocity = average(sizeVelocitySeries.slice(-6));
  const fileVelocity = average(fileVelocitySeries.slice(-6));

  const lineAcceleration = average(lineAccelerationSeries.slice(-6));
  const sizeAcceleration = average(sizeAccelerationSeries.slice(-6));
  const fileAcceleration = average(fileAccelerationSeries.slice(-6));

  const now = aggregate(currentSnapshot);
  const horizons = [1, 3, 6, 12];

  const projections = horizons.map((h) => {
    const projectedLines = Math.max(0, now.lines + lineVelocity * h + 0.5 * lineAcceleration * h ** 2);
    const projectedSize = Math.max(0, now.size + sizeVelocity * h + 0.5 * sizeAcceleration * h ** 2);
    const projectedFiles = Math.max(0, now.fileCount + fileVelocity * h + 0.5 * fileAcceleration * h ** 2);

    return {
      horizonRuns: h,
      projectedLines: Math.round(projectedLines),
      projectedSize: Math.round(projectedSize),
      projectedFiles: Math.round(projectedFiles),
    };
  });

  const growthRisk = Math.max(
    0,
    Math.min(
      1,
      (Math.abs(lineVelocity) / Math.max(1, now.lines)) * 12 +
        (Math.abs(lineAcceleration) / Math.max(1, now.lines)) * 36 +
        (Math.abs(fileVelocity) / Math.max(1, now.fileCount)) * 8,
    ),
  );

  return {
    current: now,
    dynamics: {
      lineVelocity: Number(lineVelocity.toFixed(4)),
      lineAcceleration: Number(lineAcceleration.toFixed(4)),
      sizeVelocity: Number(sizeVelocity.toFixed(4)),
      sizeAcceleration: Number(sizeAcceleration.toFixed(4)),
      fileVelocity: Number(fileVelocity.toFixed(4)),
      fileAcceleration: Number(fileAcceleration.toFixed(4)),
    },
    projections,
    growthRisk: Number(growthRisk.toFixed(4)),
  };
}
