/**
 * The classic positioning template:
 * "For [audience] who [need], [brand] is the [category] that [key benefit].
 *  Unlike [alternative], we [differentiator]."
 */
export interface PositioningParts {
  audience: string;
  need: string;
  brand: string;
  category: string;
  benefit: string;
  alternative: string;
  differentiator: string;
}

export const EMPTY_POSITIONING: PositioningParts = {
  audience: "",
  need: "",
  brand: "",
  category: "",
  benefit: "",
  alternative: "",
  differentiator: "",
};

export const POSITIONING_FIELDS: { key: keyof PositioningParts; label: string; placeholder: string; hint?: string; optional?: boolean }[] = [
  { key: "audience", label: "For…", placeholder: "curious coffee drinkers", hint: "the audience" },
  { key: "need", label: "…who…", placeholder: "want a sense of place in every cup", hint: "their need" },
  { key: "brand", label: "…[brand]…", placeholder: "Aurora Roasters", hint: "the brand" },
  { key: "category", label: "…is the…", placeholder: "specialty roaster", hint: "the category" },
  { key: "benefit", label: "…that…", placeholder: "turns long northern nights into bright, precise cups", hint: "key benefit" },
  { key: "alternative", label: "Unlike…", placeholder: "generic craft roasters", hint: "the alternative", optional: true },
  { key: "differentiator", label: "…we…", placeholder: "roast for Iceland's water and name every farm", hint: "the differentiator", optional: true },
];

const strip = (s: string) => s.trim().replace(/[.\s]+$/, "");
const or = (s: string, ph: string) => strip(s) || `[${ph}]`;

/** Composes the statement; missing parts render as [bracketed] placeholders. */
export function composePositioning(p: PositioningParts): string {
  const first = `For ${or(p.audience, "audience")} who ${or(p.need, "need")}, ${or(p.brand, "brand")} is the ${or(p.category, "category")} that ${or(p.benefit, "key benefit")}.`;
  const hasSecond = strip(p.alternative) || strip(p.differentiator);
  const second = hasSecond ? ` Unlike ${or(p.alternative, "alternative")}, we ${or(p.differentiator, "differentiator")}.` : "";
  return first + second;
}

/** True when every required part of the first sentence is filled. */
export function positioningComplete(p: PositioningParts): boolean {
  return Boolean(strip(p.audience) && strip(p.need) && strip(p.brand) && strip(p.category) && strip(p.benefit));
}

/** Best-effort inverse of composePositioning so the builder can prefill from an existing statement. */
export function parsePositioning(statement: string): Partial<PositioningParts> | null {
  const s = statement.trim().replace(/\s+/g, " ");
  const m = /^For (.+?) who (.+?), (.+?) is the (.+?) that (.+?)\.(?:\s*Unlike (.+?), we (.+?)\.?)?$/i.exec(s);
  if (!m) return null;
  const [, audience, need, brand, category, benefit, alternative, differentiator] = m;
  return { audience, need, brand, category, benefit, alternative: alternative ?? "", differentiator: differentiator ?? "" };
}

/** Split a composed statement into text and [placeholder] tokens for rendering. */
export function positioningTokens(statement: string): { text: string; placeholder: boolean }[] {
  return statement
    .split(/(\[[^\]]+\])/)
    .filter(Boolean)
    .map((t) => ({ text: t, placeholder: /^\[[^\]]+\]$/.test(t) }));
}
