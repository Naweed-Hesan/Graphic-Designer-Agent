"use client";
import * as React from "react";
import { HexColorPicker } from "react-colorful";
import { Lock, Plus, Shuffle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Dialog, Field, Select } from "@/components/ui";
import type { Genome } from "@/lib/genome/schema";
import { ARCHETYPES } from "@/lib/genome/archetypes";
import { HARMONY_SCHEMES, type HarmonyScheme, archetypeSeed, applySuggestions, generateBrandPalette, harmonyToPalette } from "@/lib/color/harmonies";
import { bestTextOn } from "@/lib/color/contrast";
import { uid } from "@/lib/utils";
import { BodyPortal, HexField, ROLE_LABEL, ROLE_TONE, editPalette } from "./shared";

const WEIGHTS: Record<string, number> = { primary: 3, secondary: 2, accent: 1.5, neutral: 1.5, background: 2, text: 1 };

export function GenerateDialog({ genome, onClose }: { genome: Genome; onClose: () => void }) {
  const colors = genome.visual.palette.colors;
  const archetype = genome.strategy.archetype;
  const personality = genome.strategy.personality;
  const primary = colors.find((c) => c.role === "primary");
  const suggested = archetypeSeed(archetype);
  const archetypeName = ARCHETYPES.find((a) => a.id === archetype)?.name;

  const [seedHex, setSeedHex] = React.useState(primary?.hex ?? suggested.hex);
  const [scheme, setScheme] = React.useState<HarmonyScheme>("brand");
  const [variation, setVariation] = React.useState(0);

  const preview = React.useMemo(
    () => (scheme === "brand" ? generateBrandPalette({ seedHex, personality, archetype, seed: variation }) : harmonyToPalette(seedHex, scheme, { seed: variation })),
    [seedHex, scheme, variation, personality, archetype],
  );
  const schemeDef = HARMONY_SCHEMES.find((s) => s.id === scheme)!;
  const lockedByRole = new Map(colors.filter((c) => c.locked).map((c) => [c.role, c]));

  const apply = () => {
    editPalette((p, g) => {
      p.colors = applySuggestions(p.colors, preview, () => uid(6));
      if (g.stages.color === "todo") g.stages.color = "in-progress";
    }, `Applied ${schemeDef.label.toLowerCase()} palette from ${seedHex.toUpperCase()}`);
    toast.success(lockedByRole.size ? `Palette applied — ${lockedByRole.size} locked colour${lockedByRole.size > 1 ? "s" : ""} kept` : "Palette applied");
    onClose();
  };

  const addOptions = () => {
    editPalette((p) => {
      for (const s of preview) p.colors.push({ id: uid(6), name: s.name, hex: s.hex, role: "custom", usage: `Option · ${ROLE_LABEL[s.role]}`, locked: false });
    }, `Added ${preview.length} palette options`);
    toast.success(`${preview.length} colours added as options`);
    onClose();
  };

  return (
    <BodyPortal>
      <Dialog open onClose={onClose} title="Generate palette" description="Pick a seed and a scheme. Everything is computed in OKLCH so lightness stays even across hues." wide>
        <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <HexColorPicker color={seedHex} onChange={(v) => setSeedHex(v.toLowerCase())} style={{ width: "100%", height: 170 }} />
            <Field label="Seed colour">
              <HexField value={seedHex} onChange={setSeedHex} ariaLabel="Seed hex" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {primary ? (
                <Button variant="secondary" size="sm" onClick={() => setSeedHex(primary.hex)} title={`Use ${primary.name}`}>
                  <span className="h-3 w-3 rounded-sm" style={{ background: primary.hex }} /> Primary
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={() => setSeedHex(suggested.hex)} title={archetypeName ? `${archetypeName}: ${suggested.note}` : suggested.note}>
                <span className="h-3 w-3 rounded-sm" style={{ background: suggested.hex }} /> {archetypeName ? "Archetype" : "Suggested"}
              </Button>
            </div>
            <Field label="Scheme">
              <Select value={scheme} onChange={(e) => setScheme(e.target.value as HarmonyScheme)} aria-label="Harmony scheme">
                {HARMONY_SCHEMES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-fg-muted -mt-1">{schemeDef.description}</p>
            {scheme === "brand" ? (
              <p className="text-xs text-fg-muted">
                Reads the {personality.length ? `${personality.length} personality axes` : "default personality"}
                {archetypeName ? ` and ${archetypeName}` : ""} from Strategy.
              </p>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setVariation((v) => v + 1)} title="Try another variation with the same inputs">
              <Shuffle className="h-3.5 w-3.5" /> Shuffle {variation > 0 ? <span className="text-fg-subtle font-mono text-[11px]">#{variation}</span> : null}
            </Button>
          </div>

          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex h-16 rounded-lg overflow-hidden border border-line">
              {preview.map((s) => (
                <div
                  key={s.role}
                  className="flex items-end p-1.5 min-w-0"
                  style={{ background: s.hex, color: bestTextOn(s.hex), flexGrow: WEIGHTS[s.role] ?? 1 }}
                  title={`${s.name} · ${s.hex.toUpperCase()}`}
                >
                  <span className="text-[10px] font-mono uppercase opacity-80 truncate">{ROLE_LABEL[s.role]}</span>
                </div>
              ))}
            </div>
            <ul className="flex flex-col gap-1.5">
              {preview.map((s) => {
                const locked = lockedByRole.get(s.role);
                return (
                  <li key={s.role} className="surface-2 flex items-center gap-3 px-2.5 py-2">
                    <span className="h-9 w-9 rounded-md border border-black/10 shrink-0" style={{ background: s.hex }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-[11px] font-mono text-fg-muted uppercase">{s.hex}</div>
                    </div>
                    <Badge tone={ROLE_TONE[s.role]}>{ROLE_LABEL[s.role]}</Badge>
                    {locked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle" title={`${locked.name} is locked and will be kept`}>
                        <Lock className="h-3 w-3" /> keeps {locked.name}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={addOptions} title="Append these as extra colours without touching the current roles">
                <Plus className="h-4 w-4" /> Add as options
              </Button>
              <Button onClick={apply} title="Replace unlocked colours by role; locked colours are kept">
                <Sparkles className="h-4 w-4" /> Apply to palette
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </BodyPortal>
  );
}
