"use client";
import { Moon, Sun } from "lucide-react";
import { useSettings } from "@/lib/store/settings";
import { Button } from "@/components/ui";
import { useHydrated } from "@/lib/utils";

export function ThemeToggle() {
  const theme = useSettings((s) => s.theme);
  const toggle = useSettings((s) => s.toggleTheme);
  const hydrated = useHydrated();
  // The persisted theme is only known on the client; render a neutral icon until then.
  const Icon = !hydrated || theme === "dark" ? Sun : Moon;
  return (
    <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
      <Icon className="h-4 w-4" />
    </Button>
  );
}
