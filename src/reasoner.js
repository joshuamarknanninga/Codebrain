function classifyFile(file, trajectoryRisk) {
  const influence = file.influence.influence;
  const volatility = file.climate.volatility;
  const fragility = file.health.fragility;
  const load = file.health.cognitiveLoad;
  const dependentCount = file.influence.incoming;

  if (influence >= 0.75 && dependentCount >= 2 && fragility >= 0.45) {
    return {
      type: 'critical dependency',
      severity: 'high',
      confidence: 0.9,
      reason: `High graph influence (${influence}) with ${dependentCount} dependents and fragility ${fragility}.`,
    };
  }

  if ((fragility >= 0.65 && volatility >= 0.6) || (trajectoryRisk >= 0.6 && influence >= 0.55)) {
    return {
      type: 'future failure risk',
      severity: 'high',
      confidence: 0.82,
      reason: `Fragility (${fragility}) and volatility (${volatility}) indicate likely instability under projected growth.`,
    };
  }

  if (volatility >= 0.55 || load >= 0.65) {
    return {
      type: 'unstable zone',
      severity: 'medium',
      confidence: 0.74,
      reason: `Mutation pressure (${volatility}) and cognitive load (${load}) exceed stable thresholds.`,
    };
  }

  return {
    type: 'stable',
    severity: 'low',
    confidence: 0.7,
    reason: `Low volatility (${volatility}) and manageable fragility (${fragility}) suggest structural resilience.`,
  };
}

function topN(items, n, sorter) {
  return [...items].sort(sorter).slice(0, n);
}

export function generateInsights(memory) {
  const trajectoryRisk = memory.system.trajectory.growthRisk;

  const perFile = memory.files.map((file) => ({
    path: file.path,
    ...classifyFile(file, trajectoryRisk),
    metrics: {
      influence: file.influence.influence,
      volatility: file.climate.volatility,
      fragility: file.health.fragility,
      resilience: file.health.resilience,
      cognitiveLoad: file.health.cognitiveLoad,
      dependents: file.influence.incoming,
    },
  }));

  const critical = perFile.filter((i) => i.type === 'critical dependency');
  const risks = perFile.filter((i) => i.type === 'future failure risk');
  const unstable = perFile.filter((i) => i.type === 'unstable zone');
  const stable = perFile.filter((i) => i.type === 'stable');

  const hotspots = topN(perFile, 5, (a, b) => {
    const scoreA = a.metrics.fragility * 0.4 + a.metrics.influence * 0.35 + a.metrics.volatility * 0.25;
    const scoreB = b.metrics.fragility * 0.4 + b.metrics.influence * 0.35 + b.metrics.volatility * 0.25;
    return scoreB - scoreA;
  }).map((x) => x.path);

  const systemDiagnosis = {
    criticalDependencies: critical.length,
    futureFailureRisks: risks.length,
    unstableZones: unstable.length,
    stableUnits: stable.length,
    dominantHotspots: hotspots,
    growthRisk: trajectoryRisk,
  };

  return {
    generatedAt: new Date().toISOString(),
    systemDiagnosis,
    perFile,
    recommendations: buildRecommendations(systemDiagnosis),
  };
}

function buildRecommendations(diagnosis) {
  const recommendations = [];

  if (diagnosis.criticalDependencies > 0) {
    recommendations.push('Decouple critical dependencies through boundary modules and narrower interfaces.');
  }

  if (diagnosis.futureFailureRisks > 0 || diagnosis.growthRisk > 0.5) {
    recommendations.push('Introduce guardrail tests for high-fragility paths and monitor trajectory drift at each snapshot.');
  }

  if (diagnosis.unstableZones > 0) {
    recommendations.push('Apply stabilization sprints to top unstable zones by reducing mutation surfaces and fan-out.');
  }

  if (recommendations.length === 0) {
    recommendations.push('System is currently stable; continue collecting snapshots to improve predictive confidence.');
  }

  return recommendations;
}
