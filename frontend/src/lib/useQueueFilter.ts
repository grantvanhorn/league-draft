import { useState, useCallback } from "react";

const STORAGE_KEY = "league:queueFilter";

function load(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr as number[]);
    }
  } catch {}
  return new Set();
}

function save(s: Set<number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
}

export function useQueueFilter() {
  const [selected, setSelected] = useState<Set<number>>(() => load());

  const toggle = useCallback((q: number | "all") => {
    setSelected((prev) => {
      let next: Set<number>;
      if (q === "all") {
        next = new Set();
      } else {
        next = new Set(prev);
        if (next.has(q)) next.delete(q); else next.add(q);
      }
      save(next);
      return next;
    });
  }, []);

  // Returns true if the match passes the current queue filter
  function passes(queueId?: number): boolean {
    if (selected.size === 0) return true;
    return selected.has(queueId ?? 0);
  }

  return { selected, toggle, passes } as const;
}
