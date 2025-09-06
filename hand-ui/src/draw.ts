import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type Point = { x: number; y: number };

export function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  hands: NormalizedLandmark[][],
  canvasW: number,
  canvasH: number
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);

  for (const lm of hands) {
    // 연결선
    for (const [a, b] of HAND_CONNECTIONS) {
      const p1 = lm[a]; const p2 = lm[b];
      ctx.beginPath();
      ctx.moveTo(p1.x * canvasW, p1.y * canvasH);
      ctx.lineTo(p2.x * canvasW, p2.y * canvasH);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(150,200,255,0.9)";
      ctx.stroke();
    }

    // 점
    for (let i = 0; i < lm.length; i++) {
      const p = lm[i];
      ctx.beginPath();
      ctx.arc(p.x * canvasW, p.y * canvasH, 3, 0, Math.PI * 2);
      ctx.fillStyle = i === 8 ? "white" : "rgba(255,255,255,0.8)";
      ctx.fill();
    }
  }
}

// Mediapipe Hands 연결 정의(21개 포인트)
const C = {
  THUMB: [1, 2, 3, 4],
  INDEX: [5, 6, 7, 8],
  MIDDLE: [9, 10, 11, 12],
  RING: [13, 14, 15, 16],
  PINKY: [17, 18, 19, 20]
};
// 손목(0) ↔ 각 손가락 시작 MCP 연결 + 각 손가락 뼈 연결
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [0, 5], [0, 9], [0, 13], [0, 17],
  ...pair(C.THUMB), ...pair(C.INDEX), ...pair(C.MIDDLE), ...pair(C.RING), ...pair(C.PINKY)
];

function pair(arr: number[]): [number, number][] {
  const links: [number, number][] = [];
  for (let i = 0; i < arr.length - 1; i++) links.push([arr[i], arr[i + 1]]);
  return links;
}