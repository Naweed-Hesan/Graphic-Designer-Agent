"use client";
import * as React from "react";
import { Badge, SectionHeader } from "@/components/ui";
import { ensureFont, fontStack } from "@/lib/type/fonts";
import { cn } from "@/lib/utils";

export type Slot = "display" | "body" | "mono";
export const SLOTS: Slot[] = ["display", "body", "mono"];
export const SLOT_LABEL: Record<Slot, string> = { display: "Display", body: "Body", mono: "Mono" };

/** Renders children in a Google Font, loading it on mount. Falls back to the given generic family. */
export function FontText({
  family,
  weights = [400],
  fallback = "sans-serif",
  as: Tag = "div",
  className,
  style,
  children,
  ...rest
}: {
  family: string;
  weights?: number[];
  fallback?: string;
  as?: "div" | "span" | "p" | "h1" | "h2" | "h3" | "li" | "td";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "style" | "className" | "children">) {
  const wkey = weights.join(",");
  React.useEffect(() => {
    ensureFont(family, wkey.split(",").map(Number).filter((n) => Number.isFinite(n)));
  }, [family, wkey]);
  return React.createElement(Tag, { className, style: { fontFamily: fontStack(family, fallback), ...style }, ...rest }, children);
}

const CATEGORY_TONE: Record<string, "neutral" | "accent" | "info" | "success" | "warning"> = {
  serif: "accent",
  "sans-serif": "neutral",
  display: "warning",
  handwriting: "success",
  monospace: "info",
};

export function CategoryBadge({ category }: { category: string }) {
  return <Badge tone={CATEGORY_TONE[category] ?? "neutral"}>{category}</Badge>;
}

export function Section({ id, title, description, actions, children, className }: { id?: string; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("surface p-5", className)}>
      <SectionHeader title={title} description={description} actions={actions} />
      {children}
    </section>
  );
}

/** Small uppercase label used inside cards. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("label", className)}>{children}</div>;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
