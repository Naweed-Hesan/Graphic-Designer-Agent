# Contributing to Ligature

Thanks for helping build the open-source brand identity studio.

## Ground rules
- Be kind. Reviews are about the work, not the person.
- Keep Ligature free to run: new providers must have a genuinely free tier or run locally. Paid-only providers are welcome as optional plugins, never as defaults.
- Local-first is a feature: no accounts, no server-side storage of user data, no telemetry.

## Development
```bash
pnpm install
pnpm dev
pnpm tsc --noEmit && pnpm lint && pnpm test
```
`CLAUDE.md` is the architecture map and coding contract — read it before touching a lab.

## Where things go
- Pure logic (no React): `src/lib/<area>/` with unit tests in `src/lib/<area>/__tests__/`.
- UI for a stage: `src/components/labs/<stage>/`.
- Providers: `src/lib/providers/{image,video}/<name>.ts`, registered in the matching `index.ts`.
- Creative Director tools: `src/lib/ai/tools.ts` (one definition serves Claude and OpenAI-compatible models).

## Changing the Brand Genome
The schema in `src/lib/genome/schema.ts` is the contract for every lab and every export. Additive changes with defaults are fine; breaking changes need a `schemaVersion` bump plus a migration in `parseGenome`.

## Pull requests
- One topic per PR, with a short description of the user-facing change and screenshots for UI.
- `pnpm tsc --noEmit`, `pnpm lint` and `pnpm test` must pass.
- Don't commit keys or `.env*` files.
