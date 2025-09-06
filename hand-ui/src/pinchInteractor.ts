import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

type XY = { x: number; y: number };
type PinchState = "idle" | "pinching" | "dragging";

export interface InteractConfig {
  stage: HTMLElement;
  cursorEl: HTMLElement;
  cardEl: HTMLElement;
  pinchStartThreshold: number;
  pinchEndThreshold: number;
  mirror: boolean; // ✅ 추가
  onPinchStart?: (pos: XY) => void;  // ✅ 추가
  onPinchEnd?: (pos: XY) => void;    // ✅ 추가
  onDrag?: (pos: XY) => void;        // ✅ 추가
}

export class PinchInteractor {
  private readonly cfg: InteractConfig;
  private state: PinchState = "idle";
  private lastPinch = 0;
  private targetGrabOffset: XY = { x: 0, y: 0 };

  constructor(cfg: InteractConfig) { this.cfg = cfg; }

  setMirror(v: boolean): void { this.cfg.mirror = v; } // ✅ 추가

  updateFromLandmarks(lm: NormalizedLandmark[] | null): void {
    if (!lm) { this.state = "idle"; return; }

    const tip = lm[8];
    const thumb = lm[4];

    const { x: cx, y: cy } = this.toStagePx(tip);
    this.cfg.cursorEl.style.left = `${cx}px`;
    this.cfg.cursorEl.style.top  = `${cy}px`;

    const pinchDist = this.normDist(tip, thumb);

    if (this.state === "idle" && pinchDist < this.cfg.pinchStartThreshold) {
      this.state = "pinching";
      this.lastPinch = performance.now();
      this.cfg.onPinchStart?.({ x: cx, y: cy });

      const near = this.isNearCard({ x: cx, y: cy });
      if (near) {
        this.state = "dragging";
        const rect = this.cfg.cardEl.getBoundingClientRect();
        this.targetGrabOffset = { x: cx - rect.left, y: cy - rect.top };
      }
    } else if ((this.state === "pinching" || this.state === "dragging") &&
               pinchDist > this.cfg.pinchEndThreshold) {
      this.state = "idle";
      this.cfg.onPinchEnd?.({ x: cx, y: cy });
    }

    if (this.state === "dragging") {
      const pos = { x: cx - this.targetGrabOffset.x, y: cy - this.targetGrabOffset.y };
      this.moveCard(pos);
      this.cfg.onDrag?.({ x: cx, y: cy });
    }
  }

  private isNearCard(p: XY): boolean {
    const rect = this.cfg.cardEl.getBoundingClientRect();
    const pad = 24;
    return p.x > rect.left - pad && p.x < rect.right + pad &&
           p.y > rect.top - pad && p.y < rect.bottom + pad;
  }

  private moveCard(p: XY): void {
    const stageRect = this.cfg.stage.getBoundingClientRect();
    const el = this.cfg.cardEl as HTMLElement & { style: CSSStyleDeclaration };
    el.style.left = `${Math.max(stageRect.left, Math.min(p.x, stageRect.right - el.offsetWidth)) - stageRect.left}px`;
    el.style.top  = `${Math.max(stageRect.top,  Math.min(p.y, stageRect.bottom - el.offsetHeight)) - stageRect.top}px`;
  }

  private normDist(a: NormalizedLandmark, b: NormalizedLandmark): number {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  private toStagePx(p: NormalizedLandmark): XY {
    const rect = this.cfg.stage.getBoundingClientRect();
    const nx = this.cfg.mirror ? (1 - p.x) : p.x;   // ✅ 미러 보정
    return { x: nx * rect.width + rect.left, y: p.y * rect.height + rect.top };
  }
}