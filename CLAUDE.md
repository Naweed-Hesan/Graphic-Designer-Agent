# Ligature — contributor & agent guide

Ligature is an open-source, local-first brand identity studio (Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Zustand, Dexie/IndexedDB). One document — the **Brand Genome** — drives every stage: brief → strategy → logo → color → type → imagery → motion → mockups → guidelines → export.

## Commands
- `pnpm dev` (dev server on http://localhost:3000)
- `pnpm tsc --noEmit` — must pass with zero errors before you finish
- `pnpm lint` — must pass with zero errors (warnings are acceptable only if unavoidable)
- `pnpm build` — production build
- `pnpm test` — vitest unit/integration tests for the pure libraries; `pnpm test:e2e` — Playwright smoke through every stage

## Architecture map
- `src/lib/genome/schema.ts` — zod schema + types (`Genome`, `BrandColor`, `Typography`, `LogoSystem`, `ImageryStyle`, `MotionSystem`, `StageId`…). **Do not change the schema** without a note in your final report; labs must work with the schema as-is.
- `src/lib/genome/defaults.ts` — `createGenome`, `createSampleGenome` ("Aurora Roasters", fully populated). `archetypes.ts` — 12 archetypes + personality axes. `stages.ts` — stage registry. `paths.ts` — `setByPath/applyOperations`.
- `src/lib/store/project.ts` — `useProject()` zustand store:
  - `genome`, `assets`, `rev`, `update(fn, {summary, stage})` (mutate a draft in `fn`; autosaves), `applyOps(ops)`, `setStage(stage, status)`
  - `addAsset({kind, name, mime, blob, svg?, width?, height?, prompt?, provider?, stage, tags})` → `Asset`; `removeAsset(id)`
  - `assetUrl(asset)` (cached object URL), `useAsset(id)`
- `src/lib/store/settings.ts` — `useSettings()` (provider keys, assistant provider, image/video fallback order, theme). `settingsHeader()` for API calls.
- `src/lib/db/index.ts` — Dexie tables `projects`, `assets`, `threads`. `Asset` type lives here.
- `src/lib/api.ts` — client helpers: `generateImage(params)` (returns `{image:{dataUrl,mime,width,height,provider,model,seed}}`), `generateVideo(params,onStatus)` (NDJSON, returns `{video:{dataUrl,mime}}`), `fetchFonts()` → `{fonts:[{id,family,category,variable,weights,subsets}]}`, `streamChat`, `fetchModels`, `fetchAiStatus`.
- `src/lib/imagery/prompt-compiler.ts` — `compilePrompt({genome, subject, purpose, extra})` → `{prompt, negativePrompt, notes, aspectHint}`; `aspectToSize(aspect)`.
- `src/lib/color/contrast.ts` — `wcagRatio`, `apcaLc`, `contrastReport(fg,bg)`, `bestTextOn`, `hexToRgb`, `rgbToHex` (isomorphic).
- `src/lib/type/fonts.ts` — `ensureFont(family, weights)` loads Google Fonts CSS on demand; `fontStack(family, fallback)`.
- `src/lib/export/bundle.ts` — `exportProjectBundle(genome, assets)` (zip), `importBrandBundle(file)`, `extFor(mime)`.
- `src/lib/utils.ts` — `cn`, `uid`, `debounce`, `clamp`, `slugify`, `blobToDataUrl`, `dataUrlToBlob`, `downloadBlob`, `loadImage`, `svgToDataUrl`, `formatBytes`, `timeAgo`.
- Server: `src/lib/providers/*` (image/video providers with fallback chains), `src/lib/ai/*` (Creative Director: Claude Agent SDK bridge + OpenAI-compatible loop + tools), `src/app/api/*` routes (`generate/image`, `generate/video`, `ai/chat`, `ai/status`, `fonts`, `fonts/ttf?family=&weight=` (TTF for opentype.js), `proxy?url=`, `providers/models`).
- Shell: `src/components/shell/*` (dashboard, StudioShell, SettingsDialog), `src/components/assistant/AssistantPanel.tsx`.
- Labs: `src/components/labs/<stage>/<Name>Lab.tsx`, registered in `src/components/labs/registry.tsx` (code-split). Export names: `BriefLab, StrategyLab, LogoLab, ColorLab, TypeLab, ImageryLab, MotionLab, MockupLab, GuidelinesLab, ExportLab`.

## UI kit (`src/components/ui`)
`Button` (variant: primary|secondary|ghost|outline|danger|link; size: sm|md|lg|icon|icon-sm; `loading`), `Input`, `Textarea`, `Select` (native), `Label`, `Field`, `Slider` (native range), `Switch`, `Card`, `SectionHeader`, `PageHeader({eyebrow,title,description,actions})`, `Badge` (tone), `Kbd`, `Spinner`, `EmptyState`, `Tabs`, `Dialog`, `Chips` (tag input), `Progress`, `Tooltip`. Icons: `lucide-react`. Toasts: `toast` from `sonner`.

Design tokens (Tailwind classes): `bg-bg`, `bg-bg-elev`, `bg-bg-elev-2`, `bg-bg-inset`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-line`, `border-line-strong`, `bg-accent`, `text-accent`, `bg-accent-soft`, `text-success|warning|danger|info`. Utility classes: `.surface`, `.surface-2`, `.inset`, `.label`, `.checker` (transparency checkerboard), `.grid-dots`, `.animate-in`, `.shimmer`, `.prose-sm`. Fonts: `font-sans`, `font-display` (Instrument Serif), `font-mono`. Never hard-code UI colors; brand colors from the Genome are of course rendered literally.

## Conventions
- Every lab is a `"use client"` component that starts with `<PageHeader eyebrow="Stage NN" title=… description=… actions=… />` and reads `useProject()`; render a friendly empty state when the Genome section is empty.
- Edit the Genome only through `update()`/`applyOps()` with a short `summary` so the history stays readable. Batch rapid slider changes (debounce ~300 ms) so history doesn't flood.
- Heavy browser libraries (`imagetracerjs`, `@imgly/background-removal`, `mediabunny`, `gifenc`, `opentype.js`, `jszip`) must be loaded with dynamic `import()` inside the handler that needs them.
- All generation goes through `src/lib/api.ts`; show provider attempts/errors to the user with `toast.error`. Code must degrade gracefully and be testable without network: every provider call can fail, and the labs must stay useful offline.
- Accessibility: buttons need labels/titles, inputs need labels, keep focus styles.
- Keep files focused; put pure logic in `src/lib/<area>/` with no React so it can be unit-tested, and UI in `src/components/labs/<stage>/`.
- Do not edit shared files (schema, stores, shell, registry, other labs) — list any needed change in your final report instead.

## Verifying UI
Run `pnpm test:e2e` (Playwright walks every stage of the sample project offline and fails on console errors). For ad-hoc checks, `playwright` can drive http://localhost:3000: block non-localhost requests with `page.route` when offline, open the dashboard, click "Open the sample project", then navigate to `/studio/<id>/<stage>`. Always screenshot your lab and check the browser console before finishing. If a Chromium build is preinstalled (e.g. under `/opt/pw-browsers`), pass it via `PW_CHROMIUM_PATH`.
