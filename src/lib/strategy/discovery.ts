/**
 * Discovery questionnaire — the questions a brand designer asks a new client,
 * and how each answer folds into the Brief. Pure logic; the Brief lab renders it.
 */
import type { Brief } from "@/lib/genome/schema";

export type BriefTextKey = "clientName" | "projectName" | "industry" | "description" | "goals" | "audience" | "timeline" | "constraints" | "references";

export interface Competitor {
  name: string;
  note: string;
}

interface QuestionBase {
  id: string;
  /** Short label for the step rail */
  title: string;
  /** The question as a designer would ask it */
  prompt: string;
  hint?: string;
  placeholder?: string;
}

export type DiscoveryQuestion =
  | (QuestionBase & { kind: "text" | "paragraph"; target: BriefTextKey; mode: "set" | "append"; prefix?: string })
  | (QuestionBase & { kind: "fields"; fields: { key: BriefTextKey; label: string; placeholder?: string }[] })
  | (QuestionBase & { kind: "chips"; suggestions: string[]; target: BriefTextKey; mode: "append"; prefix?: string })
  | (QuestionBase & { kind: "chips"; suggestions: string[]; target: "deliverables"; mode: "set" })
  | (QuestionBase & { kind: "competitors" });

export type DiscoveryAnswer =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "fields"; values: Record<string, string> }
  | { kind: "competitors"; rows: Competitor[] };

export const TOUCHPOINTS = ["Print", "Screen", "Packaging", "Signage", "Social", "Merchandise", "Environments", "Motion"];

export const DELIVERABLE_SUGGESTIONS = [
  "Logo system",
  "Color palette",
  "Typography",
  "Brand guidelines",
  "Stationery",
  "Packaging",
  "Social templates",
  "Website",
  "Signage",
  "Motion",
  "Naming",
  "Tone of voice",
];

export const DISCOVERY_QUESTIONS: DiscoveryQuestion[] = [
  {
    id: "business",
    title: "The business",
    prompt: "Describe the business in one paragraph, as if to a friend.",
    hint: "What do they make or do, for whom, and why is it worth talking about? Plain words beat marketing language here.",
    placeholder: "A small-batch roaster in Reykjavík that…",
    kind: "paragraph",
    target: "description",
    mode: "set",
  },
  {
    id: "name",
    title: "Name & industry",
    prompt: "What is the business called, and what industry would you file it under?",
    hint: "Leave the project name blank and it is derived from the client name.",
    kind: "fields",
    fields: [
      { key: "clientName", label: "Client or business name", placeholder: "Aurora Roasters" },
      { key: "industry", label: "Industry", placeholder: "Specialty coffee" },
      { key: "projectName", label: "Project name", placeholder: "Defaults to “<client> brand identity”" },
    ],
  },
  {
    id: "customer",
    title: "Ideal customer",
    prompt: "Who is the ideal customer, and what do they value?",
    hint: "Be specific: age, context, taste, what they already buy, what they would never buy.",
    placeholder: "Design-literate urban coffee drinkers, 25–45, who…",
    kind: "paragraph",
    target: "audience",
    mode: "set",
  },
  {
    id: "goals",
    title: "Goals",
    prompt: "Why is this happening now, and what should the new identity make possible?",
    hint: "A launch, a repositioning, growth, a tired look — and what success looks like a year from now.",
    kind: "paragraph",
    target: "goals",
    mode: "set",
  },
  {
    id: "feeling",
    title: "Feeling",
    prompt: "What should people feel after meeting the brand?",
    hint: "Three or four words are enough: reassured, curious, a little envious…",
    placeholder: "Calm, curious, in good hands",
    kind: "text",
    target: "goals",
    mode: "append",
    prefix: "People should feel",
  },
  {
    id: "admire",
    title: "Admired brands",
    prompt: "Which three brands do you admire — and why?",
    hint: "They need not be in the same industry. The ‘why’ is the useful part.",
    kind: "paragraph",
    target: "references",
    mode: "append",
    prefix: "Admired brands",
  },
  {
    id: "never",
    title: "Never",
    prompt: "What must the identity never look like?",
    hint: "Category clichés, a competitor’s territory, anything the founder cannot stand.",
    kind: "paragraph",
    target: "constraints",
    mode: "append",
    prefix: "Never",
  },
  {
    id: "competitors",
    title: "Competitors",
    prompt: "Who are the main competitors, and how should this brand feel different?",
    hint: "A name and one honest note each.",
    kind: "competitors",
  },
  {
    id: "touchpoints",
    title: "Where it lives",
    prompt: "Where will the identity live most: print, screen, packaging, signage?",
    hint: "Pick the two or three that matter most; they decide what the logo and type must survive.",
    kind: "chips",
    suggestions: TOUCHPOINTS,
    target: "constraints",
    mode: "append",
    prefix: "Lives mostly on",
  },
  {
    id: "deliverables",
    title: "Deliverables",
    prompt: "What needs to be delivered?",
    hint: "Pick from the usual suspects or type your own.",
    kind: "chips",
    suggestions: DELIVERABLE_SUGGESTIONS,
    target: "deliverables",
    mode: "set",
  },
  {
    id: "timeline",
    title: "Timeline",
    prompt: "When is it needed, and are there milestones along the way?",
    placeholder: "6 weeks; launch at the trade fair on 12 May",
    kind: "text",
    target: "timeline",
    mode: "set",
  },
  {
    id: "scope",
    title: "Budget & scope",
    prompt: "Are there budget or scope constraints to design around?",
    hint: "One-colour print, a name that cannot change, a tiny team who will apply the identity themselves…",
    kind: "paragraph",
    target: "constraints",
    mode: "append",
    prefix: "Scope",
  },
];

export const BRIEF_FIELD_LABELS: Record<keyof Brief, string> = {
  clientName: "Client name",
  projectName: "Project name",
  industry: "Industry",
  description: "Description",
  goals: "Goals",
  audience: "Audience",
  deliverables: "Deliverables",
  timeline: "Timeline",
  constraints: "Constraints",
  references: "References",
  competitors: "Competitors",
};

/** The answer a question starts with, given the current brief (so "set" questions edit rather than overwrite). */
export function initialAnswer(brief: Brief, q: DiscoveryQuestion): DiscoveryAnswer {
  switch (q.kind) {
    case "text":
    case "paragraph":
      return { kind: "text", text: q.mode === "set" ? brief[q.target] : "" };
    case "fields":
      return { kind: "fields", values: Object.fromEntries(q.fields.map((f) => [f.key, brief[f.key]])) };
    case "chips":
      return { kind: "list", items: q.mode === "set" ? [...brief.deliverables] : [] };
    case "competitors":
      return { kind: "competitors", rows: brief.competitors.map((c) => ({ name: c.name, note: c.note })) };
  }
}

export function isEmptyAnswer(a: DiscoveryAnswer | undefined): boolean {
  if (!a) return true;
  switch (a.kind) {
    case "text":
      return a.text.trim() === "";
    case "list":
      return a.items.length === 0;
    case "fields":
      return Object.values(a.values).every((v) => v.trim() === "");
    case "competitors":
      return a.rows.every((r) => r.name.trim() === "");
  }
}

function contribution(prefix: string | undefined, body: string): string {
  const b = body.trim();
  if (!b) return "";
  return prefix ? `${prefix}: ${b}` : b;
}

export function appendParagraph(existing: string, addition: string): string {
  const a = addition.trim();
  if (!a) return existing;
  const e = existing.trimEnd();
  if (!e) return a;
  if (e.includes(a)) return existing;
  return `${e}\n\n${a}`;
}

export function removeParagraph(existing: string, previous: string): string {
  const p = previous.trim();
  if (!p || !existing.includes(p)) return existing;
  return existing
    .replace(p, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fold an answer into the brief. `previous` is what this question wrote last time
 * (when the user goes back and edits) so appended text is replaced, not duplicated.
 * Returns a new Brief; never mutates the input.
 */
export function applyAnswer(brief: Brief, q: DiscoveryQuestion, answer: DiscoveryAnswer, previous?: DiscoveryAnswer): Brief {
  const next: Brief = { ...brief, deliverables: [...brief.deliverables], competitors: brief.competitors.map((c) => ({ ...c })) };
  switch (q.kind) {
    case "text":
    case "paragraph": {
      if (answer.kind !== "text") return next;
      if (q.mode === "set") {
        next[q.target] = answer.text.trim();
      } else {
        const prev = previous?.kind === "text" ? contribution(q.prefix, previous.text) : "";
        const base = removeParagraph(next[q.target], prev);
        next[q.target] = appendParagraph(base, contribution(q.prefix, answer.text));
      }
      return next;
    }
    case "fields": {
      if (answer.kind !== "fields") return next;
      for (const f of q.fields) next[f.key] = (answer.values[f.key] ?? "").trim();
      if (!next.projectName.trim() && next.clientName.trim()) next.projectName = `${next.clientName.trim()} brand identity`;
      return next;
    }
    case "chips": {
      if (answer.kind !== "list") return next;
      const items = [...new Set(answer.items.map((s) => s.trim()).filter(Boolean))];
      if (q.mode === "set") {
        next.deliverables = items;
      } else {
        const prev = previous?.kind === "list" ? contribution(q.prefix, previous.items.join(", ")) : "";
        const base = removeParagraph(next[q.target], prev);
        next[q.target] = appendParagraph(base, contribution(q.prefix, items.join(", ")));
      }
      return next;
    }
    case "competitors": {
      if (answer.kind !== "competitors") return next;
      next.competitors = answer.rows.map((r) => ({ name: r.name.trim(), note: r.note.trim() })).filter((r) => r.name);
      return next;
    }
  }
}

export function sameBrief(a: Brief, b: Brief): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Which brief fields differ between two snapshots (for the discovery summary). */
export function changedBriefFields(before: Brief, after: Brief): (keyof Brief)[] {
  return (Object.keys(BRIEF_FIELD_LABELS) as (keyof Brief)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

export interface DiscoverySummary {
  answered: number;
  skipped: number;
  touched: (keyof Brief)[];
  before: number;
  after: number;
}
