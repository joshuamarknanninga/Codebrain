function normalizeScores(values) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

export function computeGravity(files) {
  const nodes = new Map(files.map((file) => [file.path, { ...file, outgoing: [], incoming: [] }]));

  for (const file of files) {
    const node = nodes.get(file.path);
    for (const dep of file.localDependencies) {
      if (nodes.has(dep)) {
        node.outgoing.push(dep);
        nodes.get(dep).incoming.push(file.path);
      }
    }
  }

  const paths = [...nodes.keys()];
  const indexOf = new Map(paths.map((p, i) => [p, i]));
  const baseScore = 1 / Math.max(paths.length, 1);
  let rank = new Array(paths.length).fill(baseScore);

  const damping = 0.85;
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const next = new Array(paths.length).fill((1 - damping) / paths.length);

    for (const p of paths) {
      const i = indexOf.get(p);
      const outgoing = nodes.get(p).outgoing;
      if (outgoing.length === 0) {
        const spread = (damping * rank[i]) / paths.length;
        for (let j = 0; j < paths.length; j += 1) next[j] += spread;
      } else {
        const contribution = (damping * rank[i]) / outgoing.length;
        for (const target of outgoing) {
          next[indexOf.get(target)] += contribution;
        }
      }
    }

    rank = next;
  }

  const incomingCounts = paths.map((p) => nodes.get(p).incoming.length);
  const outgoingCounts = paths.map((p) => nodes.get(p).outgoing.length);
  const rankNorm = normalizeScores(rank);
  const incomingNorm = normalizeScores(incomingCounts);
  const outgoingNorm = normalizeScores(outgoingCounts);

  const byFile = {};
  for (const p of paths) {
    const i = indexOf.get(p);
    const influence = Number((rankNorm[i] * 0.6 + incomingNorm[i] * 0.3 + outgoingNorm[i] * 0.1).toFixed(4));

    byFile[p] = {
      influence,
      gravityRank: Number(rank[i].toFixed(6)),
      incoming: nodes.get(p).incoming.length,
      outgoing: nodes.get(p).outgoing.length,
      dependents: [...nodes.get(p).incoming],
    };
  }

  return byFile;
}
