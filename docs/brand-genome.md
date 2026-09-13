# The Brand Genome

The Genome is Ligature's single source of truth: a JSON document validated by the zod schema in `src/lib/genome/schema.ts`. Every lab reads from it, every export derives from it, and the Creative Director edits it through typed tools.

```jsonc
{
  "schemaVersion": 1,
  "id": "k3f9…", "name": "Aurora Roasters",
  "brief":    { "clientName", "industry", "description", "goals", "audience", "deliverables": [], "timeline", "constraints", "references", "competitors": [{ "name", "note" }] },
  "strategy": { "positioning", "mission", "vision", "values": [], "archetype": "explorer", "secondaryArchetype", "personality": [{ "id", "left", "right", "value": 0–100 }], "tagline", "taglineOptions": [], "tone": { "voice", "dos": [], "donts": [], "sample" }, "keywords": [], "differentiators": [], "nameOptions": [] },
  "visual": {
    "palette":    { "colors": [{ "id", "name", "hex", "role": "primary|secondary|accent|neutral|background|surface|text|…", "usage", "locked" }], "rationale", "dark": { "<colorId>": "#hex" } },
    "typography": { "display": { "family", "source", "category", "weights", "fallback", "variable" }, "body", "mono", "scale": { "base", "ratio" }, "styles": [{ "id", "name", "font", "size", "weight", "lineHeight", "letterSpacing", "transform" }], "rationale" },
    "logo":       { "concept", "concepts": ["assetId"], "markAssetId", "wordmarkAssetId", "wordmarkText", "wordmarkFont", "wordmarkWeight", "wordmarkTracking", "wordmarkCase", "variants": { "primary|mark|wordmark|horizontal|stacked|mono-dark|mono-light|favicon": "assetId" }, "clearspaceMultiplier", "minSizePx", "minSizeMm", "usageRules": [], "doNots": [] },
    "imagery":    { "medium", "lighting", "composition", "colorTreatment", "subjects", "mood": [], "avoid": [], "promptSuffix", "referenceAssetIds": [], "guidance" },
    "elements":   { "shapes": [], "patterns": [], "iconStyle": { "style", "strokeWidth", "cornerRadius" }, "notes" },
    "motion":     { "easing", "durationBase", "principles": [], "preset", "notes" }
  },
  "stages":  { "brief": "todo|in-progress|done", "strategy": "…", "…": "…" },
  "history": [{ "id", "ts", "actor": "user|ai|system", "summary", "stage" }],
  "notes": ""
}
```

## Rules
- Additive changes must carry defaults so old Genomes still parse (`parseGenome` fills them).
- Breaking changes bump `schemaVersion` and add a migration.
- Assets are not embedded; they live in IndexedDB and are referenced by id. A `.ligature.zip` bundle carries both.
- The Creative Director may only change the Genome through `update_genome`, `set_palette`, `set_typography` and `set_stage_status`; each change is validated against the schema before it is applied and recorded in `history`.
