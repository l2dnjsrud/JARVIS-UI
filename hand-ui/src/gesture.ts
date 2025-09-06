export type GestureSample = { label: string; score: number } | null;

export function normalizeLabel(raw: string): "Thumb_Up" | "Victory" | "OK" | null {
  const s = raw.replace(/\s+/g, "").toLowerCase();
  if (s.includes("thumb") && s.includes("up")) return "Thumb_Up";
  if (s.includes("victory") || s.includes("peace")) return "Victory";
  if (s === "ok" || s.includes("oksign")) return "OK";
  return null;
}

export class GestureFSM {
  private history: (string | null)[] = [];
  private current: string | null = null;

  constructor(
    private readonly windowSize: number = 8,
    private readonly minCount: number = 5,
    private readonly minScore: number = 0.7
  ) {}

  onStart?: (g: "Thumb_Up" | "Victory" | "OK") => void;
  onEnd?: (g: "Thumb_Up" | "Victory" | "OK") => void;

  update(sample: GestureSample): void {
    const label = sample && sample.score >= this.minScore
      ? normalizeLabel(sample.label)
      : null;

    this.history.push(label);
    if (this.history.length > this.windowSize) this.history.shift();

    const stable = this.majority(this.history);
    if (this.current && stable !== this.current) {
      const old = this.current as any;
      this.current = null;
      this.onEnd?.(old);
    }
    if (!this.current && stable) {
      this.current = stable;
      this.onStart?.(stable as any);
    }
  }

  get active(): "Thumb_Up" | "Victory" | "OK" | null {
    return (this.current as any) ?? null;
  }

  private majority(arr: (string | null)[]): "Thumb_Up" | "Victory" | "OK" | null {
    const cnt: Record<string, number> = {};
    for (const v of arr) { if (!v) continue; cnt[v] = (cnt[v] ?? 0) + 1; }
    let best: string | null = null; let n = 0;
    for (const [k, v] of Object.entries(cnt)) if (v > n) { best = k; n = v; }
    return n >= this.minCount ? (best as any) : null;
  }
}