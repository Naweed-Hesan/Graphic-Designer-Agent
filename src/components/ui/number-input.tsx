"use client";
import * as React from "react";
import { Input } from "./input";

/**
 * A controlled number field that lets the user type freely (partial values,
 * a lone "-", clearing) and commits only complete, in-range numbers.
 * The visible text re-syncs when the committed value changes elsewhere.
 */
export function NumberInput({ value, onCommit, min, max, step, className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & { value: number; onCommit: (v: number) => void; min?: number; max?: number; step?: number }) {
  const [text, setText] = React.useState(String(value));
  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  return (
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={text}
      className={className}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const v = Number(t);
        if (t.trim() !== "" && Number.isFinite(v) && v === clamp(v)) onCommit(v);
      }}
      onBlur={() => {
        const v = Number(text);
        if (text.trim() === "" || !Number.isFinite(v)) {
          setText(String(value));
          return;
        }
        const c = clamp(v);
        setText(String(c));
        if (c !== value) onCommit(c);
      }}
    />
  );
}
