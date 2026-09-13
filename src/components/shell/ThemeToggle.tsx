"use client";
import { Moon, Sun } from "lucide-react";
import { useSettings } from "@/lib/store/settings";
import { Button } from "@/components/ui";

export function ThemeToggle() {
  const theme = useSettings((s) => s.theme);
  const toggle = useSettings((s) => s.toggleTheme);
  return (
    <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
