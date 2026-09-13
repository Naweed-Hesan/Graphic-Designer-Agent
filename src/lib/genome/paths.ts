/** Tiny dot-path helpers for genome edits ("visual.palette.colors.0.hex"). */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function setByPath<T extends object>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone = structuredClone(obj) as Record<string, unknown>;
  let cur: Record<string, unknown> = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cur[k];
    if (next === null || typeof next !== "object") {
      cur[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (value === undefined) delete cur[last];
  else cur[last] = value;
  return clone as T;
}

export interface GenomeOperation {
  path: string;
  value: unknown;
}

export function applyOperations<T extends object>(obj: T, ops: GenomeOperation[]): T {
  return ops.reduce((acc, op) => setByPath(acc, op.path, op.value), obj);
}
