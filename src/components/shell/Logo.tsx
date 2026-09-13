import { cn } from "@/lib/utils";

/** Ligature's own mark: two strokes joined by a single ligature curve. */
export function LigatureMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={cn("shrink-0", className)} aria-hidden>
      <path d="M8 6v20" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M24 6v20" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M8 16c0-5 16-5 16 0" stroke="var(--accent)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LigatureMark />
      <span className="font-semibold tracking-tight text-[17px]">Ligature</span>
    </span>
  );
}
