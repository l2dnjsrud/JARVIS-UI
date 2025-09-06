import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

type Pt = { x: number; y: number };

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  hands: NormalizedLandmark[][],
  w: number,
  h: number,
  nowMs: number
): void {
  ctx.clearRect(0, 0, w, h);
  if (!hands.length) return;

  for (const lm of hands) {
    const centerN = palmCenter(lm);
    const { x: cx, y: cy } = toPx(centerN, w, h);

    // 스케일: 손 크기(정규화 bbox)로 반지름 계산
    const bb = bounds(lm);
    const sizeN = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);
    const base = sizeN * Math.min(w, h);
    const rCore = clamp(base * 0.34, 36, 120);
    const r1 = rCore * 1.25;   // 내부 점선(오렌지)
    const r2 = rCore * 1.8;    // 메인 점선(청록)
    const r3 = rCore * 2.2;    // 외곽 큰 링
    const r4 = rCore * 2.5;    // 궤도 점/아크

    const aqua = "rgba(0, 200, 255, 0.95)";
    const aquaDim = "rgba(0, 200, 255, 0.55)";
    const orange = "rgba(255, 176, 0, 0.95)";
    const orangeDim = "rgba(255, 176, 0, 0.6)";
    const whiteDim = "rgba(255,255,255,0.9)";

    // 중심 원
    fillCircle(ctx, cx, cy, rCore * 0.55, aqua);

    // 내부 오렌지 점선 링
    ring(ctx, cx, cy, r1, { width: 3, color: orange, dash: [3, 6] });
    dottedRing(ctx, cx, cy, r1 * 0.82, 36, 2.6, orangeDim, nowMs * 0.001);

    // 메인 청록 점선 링
    ring(ctx, cx, cy, r2, { width: 4, color: aqua, dash: [8, 10] });
    dottedRing(ctx, cx, cy, r2 * 0.88, 48, 3.2, aquaDim, -nowMs * 0.001);

    // 외곽 큰 링 + 진행 아크
    ring(ctx, cx, cy, r3, { width: 3, color: aqua });
    movingArc(ctx, cx, cy, r3, nowMs * 0.002, Math.PI * 0.32, orange);

    // 궤도 점 + 꼬리
    orbitDot(ctx, cx, cy, r4, nowMs * 0.003, 10, aqua, orangeDim);

    // 방사 점선(레이더 느낌)
    radialTicks(ctx, cx, cy, r1 * 0.7, r3 * 0.98, 8, nowMs * 0.0006, aquaDim);

    // HUD 텍스트
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = whiteDim;
    ctx.font = `${Math.round(rCore * 0.35)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.85;
    ctx.fillText("HUD", r2 * 0.02, 0);
    ctx.restore();

    // 검지끝 표시 + 센터→검지 레이
    const tip = lm[8];
    const tipPx = toPx(tip, w, h);
    fillCircle(ctx, tipPx.x, tipPx.y, Math.max(6, rCore * 0.18), aqua);
    dashedRay(ctx, cx, cy, tipPx.x, tipPx.y, [4, 8], orangeDim);
  }
}

/* ---------- low-level primitives ---------- */

function ring(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  opts: { width?: number; color: string; dash?: number[] }
): void {
  ctx.save();
  if (opts.dash) ctx.setLineDash(opts.dash);
  ctx.lineWidth = opts.width ?? 2;
  ctx.strokeStyle = opts.color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function dottedRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  count: number,
  dotR: number,
  color: string,
  phase: number
): void {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + phase;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function movingArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  phase: number,
  len: number,
  color: string
): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, phase, phase + len);
  ctx.stroke();
  ctx.restore();
}

function radialTicks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  n: number,
  phase: number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash([2, 10]);
  ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

function orbitDot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  phase: number,
  dotR: number,
  color: string,
  tailColor: string
): void {
  const x = cx + Math.cos(phase) * r;
  const y = cy + Math.sin(phase) * r;

  // 꼬리(짧은 아크)
  ctx.save();
  ctx.strokeStyle = tailColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, phase - 0.25, phase);
  ctx.stroke();
  ctx.restore();

  fillCircle(ctx, x, y, dotR, color);
}

function dashedRay(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dash: number[],
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash(dash);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

function fillCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- geometry helpers ---------- */

function palmCenter(lm: NormalizedLandmark[]): Pt {
  // 손목(0) + 각 MCP(5/9/13/17)의 평균을 센터로 사용
  const idx = [0, 5, 9, 13, 17];
  let x = 0, y = 0;
  for (const i of idx) { x += lm[i].x; y += lm[i].y; }
  const k = 1 / idx.length;
  return { x: x * k, y: y * k };
}

function bounds(lm: NormalizedLandmark[]) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function toPx(p: Pt, w: number, h: number): Pt {
  return { x: p.x * w, y: p.y * h };
}

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}