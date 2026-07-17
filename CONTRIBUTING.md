# Contributing

EOE Chat is currently a fixed-level Private Text Beta. Contributions should
preserve ordinary conversation quality and must not enable Adaptive
Progression, image input, or public anonymous provider access without a
separate reviewed proposal.

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

The default configuration uses `MockProvider` and does not make live requests.

## Required checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Do not run live-provider commands unless you own the credentials, understand
the cost, and have explicitly enabled the isolated live execution guard.

## Pull requests

Keep changes focused, include tests for behavior changes, and state whether any
live provider request was executed. Never attach `.env.local`, private
conversation data, or files from `artifacts/`.
