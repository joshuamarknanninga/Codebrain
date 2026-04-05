# CodeBrain

CodeBrain is a local-first living codebase intelligence system. It scans a repository, builds persistent memory snapshots, merges structural + behavioral + predictive layers, and emits architecture-oriented insights.

## File Tree

```text
.
├── LICENSE
├── README.md
├── package.json
├── src
│   ├── server.js
│   ├── scanner.js
│   ├── memory.js
│   ├── reasoner.js
│   ├── store.js
│   └── engines
│       ├── gravity.js
│       ├── climate.js
│       └── simulator.js
└── test
    └── codebrain.test.js
```

## Requirements

- Node.js 18+
- No external runtime dependencies

## Run

```bash
npm start
```

Server endpoints:
- `GET /api/health`
- `GET /api/snapshot` (creates and persists a new system snapshot)

## Generate One Snapshot (CLI)

```bash
npm run snapshot
```

## Test

```bash
npm test
```

## Snapshot Persistence

Snapshots are persisted in `.codebrain/`:
- `snapshots.jsonl` (append-only historical timeline)
- `latest.json` (most recent snapshot)

Each run influences subsequent analyses by feeding historical signals into:
- volatility computation (`climate`)
- trajectory prediction (`simulator`)
- reasoning confidence and system diagnosis (`reasoner`)
