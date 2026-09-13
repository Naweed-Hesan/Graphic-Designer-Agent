/**
 * Completeness ("health") scoring for the Brief and Strategy sections.
 * Pure functions — no React — so labs, the assistant and tests can share them.
 */
import type { Brief, Strategy } from "@/lib/genome/schema";

export interface HealthItem {
  key: string;
  label: string;
  done: boolean;
  weight: number;
  /** Shown when the field has something but is still thin. */
  hint?: string;
}

export interface Health {
  /** 0–100, weighted */
  percent: number;
  items: HealthItem[];
  missing: HealthItem[];
  done: number;
  total: number;
}

export interface WordCount {
  key: string;
  label: string;
  words: number;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

const filled = (s: string) => s.trim().length > 0;

function summarize(items: HealthItem[]): Health {
  const total = items.reduce((n, i) => n + i.weight, 0);
  const got = items.filter((i) => i.done).reduce((n, i) => n + i.weight, 0);
  return {
    percent: total ? Math.round((got / total) * 100) : 0,
    items,
    missing: items.filter((i) => !i.done),
    done: items.filter((i) => i.done).length,
    total: items.length,
  };
}

export const BRIEF_MIN_DESCRIPTION_WORDS = 12;

export function briefHealth(brief: Brief): Health {
  const descWords = wordCount(brief.description);
  return summarize([
    { key: "clientName", label: "Client name", done: filled(brief.clientName), weight: 1 },
    { key: "projectName", label: "Project name", done: filled(brief.projectName), weight: 1 },
    { key: "industry", label: "Industry", done: filled(brief.industry), weight: 1 },
    {
      key: "description",
      label: "Description",
      done: descWords >= BRIEF_MIN_DESCRIPTION_WORDS,
      weight: 2,
      hint: descWords > 0 && descWords < BRIEF_MIN_DESCRIPTION_WORDS ? "a fuller paragraph helps" : undefined,
    },
    { key: "goals", label: "Goals", done: filled(brief.goals), weight: 2 },
    { key: "audience", label: "Audience", done: filled(brief.audience), weight: 2 },
    { key: "deliverables", label: "Deliverables", done: brief.deliverables.length > 0, weight: 1 },
    { key: "timeline", label: "Timeline", done: filled(brief.timeline), weight: 1 },
    { key: "constraints", label: "Constraints", done: filled(brief.constraints), weight: 1 },
    { key: "references", label: "References", done: filled(brief.references), weight: 1 },
    { key: "competitors", label: "Competitors", done: brief.competitors.some((c) => filled(c.name)), weight: 1 },
  ]);
}

export function briefWordCounts(brief: Brief): { rows: WordCount[]; total: number } {
  const rows: WordCount[] = [
    { key: "description", label: "Description", words: wordCount(brief.description) },
    { key: "goals", label: "Goals", words: wordCount(brief.goals) },
    { key: "audience", label: "Audience", words: wordCount(brief.audience) },
    { key: "constraints", label: "Constraints", words: wordCount(brief.constraints) },
    { key: "references", label: "References", words: wordCount(brief.references) },
  ];
  const competitorWords = brief.competitors.reduce((n, c) => n + wordCount(c.name) + wordCount(c.note), 0);
  const total = rows.reduce((n, r) => n + r.words, 0) + competitorWords + wordCount(brief.timeline);
  return { rows, total };
}

export function strategyHealth(strategy: Strategy): Health {
  const personalityMoved = strategy.personality.some((a) => a.value !== 50);
  return summarize([
    { key: "positioning", label: "Positioning", done: filled(strategy.positioning), weight: 2 },
    { key: "mission", label: "Mission", done: filled(strategy.mission), weight: 1 },
    { key: "vision", label: "Vision", done: filled(strategy.vision), weight: 1 },
    {
      key: "values",
      label: "Values",
      done: strategy.values.length >= 3,
      weight: 1,
      hint: strategy.values.length > 0 && strategy.values.length < 3 ? "aim for three to five" : undefined,
    },
    { key: "archetype", label: "Archetype", done: strategy.archetype !== "", weight: 1 },
    { key: "personality", label: "Personality", done: personalityMoved, weight: 1, hint: !personalityMoved ? "every axis is still centred" : undefined },
    { key: "tagline", label: "Tagline", done: filled(strategy.tagline), weight: 1 },
    { key: "voice", label: "Voice description", done: filled(strategy.tone.voice), weight: 1 },
    { key: "dos-donts", label: "Dos & don'ts", done: strategy.tone.dos.length > 0 || strategy.tone.donts.length > 0, weight: 1 },
    { key: "sample", label: "Sample copy", done: filled(strategy.tone.sample), weight: 1 },
    { key: "keywords", label: "Keywords", done: strategy.keywords.length > 0, weight: 1 },
    { key: "differentiators", label: "Differentiators", done: strategy.differentiators.length > 0, weight: 1 },
  ]);
}

/** Threshold at which a lab nudges the user to mark the stage "in progress". */
export const NUDGE_THRESHOLD = 70;
