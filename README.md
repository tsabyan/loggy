# Loggy

Chat-first personal project manager: describe your work in chat, and the board, timeline and stats update themselves.

- Product: [docs/PRD.md](docs/PRD.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Build order: [docs/TASKS.md](docs/TASKS.md)
- Agent rules: [CLAUDE.md](CLAUDE.md)

## Local dev

Requires Node 24+ and pnpm 10.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`pnpm check` runs lint, format check, typecheck and tests.
