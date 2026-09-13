"use client";
import { useProject } from "@/lib/store/project";
import type { Genome, Strategy } from "@/lib/genome/schema";

/** Returns a setter that mutates `genome.strategy` in a draft and records "Strategy: <summary>" in history. */
export function useStrategyUpdate() {
  const update = useProject((s) => s.update);
  return (fn: (strategy: Strategy, genome: Genome) => void, summary: string) =>
    update(
      (g) => {
        fn(g.strategy, g);
      },
      { summary: `Strategy: ${summary}`, stage: "strategy" },
    );
}
