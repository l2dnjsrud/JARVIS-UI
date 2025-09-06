import { drawHUD } from "./hud";
import { GestureFSM } from "./gesture";
import type { GestureSample } from "./gesture";
import { MouseSynth } from "./mouse";
import { PinchInteractor } from "./pinchInteractor";
import { createHandLandmarker, detectVideoFrame } from "./hand";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";

// DOM
const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("overlay") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const fpsEl = document.getElementById("fps")!;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
const numHandsInput = document.getElementById("numHands") as HTMLInputElement;
const mirrorChk = document.getElementById("mirror") as HTMLInputElement;
const stage = document.querySelector(".stage") as HTMLElement;
const cursorEl = document.getElementById("cursor") as HTMLElement;
const cardEl = document.getElementById("card") as HTMLElement;

// 상태
let running = false;
let raf = 0;
let lastT = performance.now();
let frames = 0;
let mirror = true;

// 모델(URL 고정)
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const GESTURE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task";

// MediaPipe models
let landmarkerBundle: Awaited<ReturnType<typeof createHandLandmarker>> | null = null;
let gestureRecognizer: GestureRecognizer | null = null;

// 결과 버퍼
type InferOut = {
  hands: { x: number; y: number; z: number }[][];
  handedness: string[];
  gestures: GestureSample[];
};
let latest: InferOut | null = null;

// 마우스 합성 & 제스처 FSM
const mouse = new MouseSynth();
const fsm = new GestureFSM(8, 5, 0.7);

// 휠 모드
let wheelMode = false;
let wheelAnchorY = 0;
const WHEEL_GAIN = 6;

// 핀치 인터랙터(마우스 드래그와 연동)
const interactor = new PinchInteractor({
  stage, cursorEl, cardEl,
  pinchStartThreshold: 0.045,
  pinchEndThreshold: 0.065,
  mirror,
  onPinchStart: (p) => { mouse.move(p.x, p.y); mouse.down(0); },
  onPinchEnd:   (p) => { mouse.move(p.x, p.y); mouse.up(0); },
  onDrag:       (p) => { mouse.move(p.x, p.y); }
});

// 제스처 액션 매핑
fsm.onStart = (g) => {
  const pos = getCursorPxFromFirstTip();
  if (pos) mouse.move(pos.x, pos.y);

  if (g === "Thumb_Up") {
    mouse.click(0); // 좌클릭
    flashCard();
  } else if (g === "Victory") {
    wheelMode = true;
    const cy = (pos?.y ?? 0);
    wheelAnchorY = cy;
  } else if (g === "OK") {
    mouse.context(); // 컨텍스트 메뉴
  }
};
fsm.onEnd = (g) => {
  if (g === "Victory") wheelMode = false;
};

// 이벤트
startBtn.addEventListener("click", async () => {
  try {
    startBtn.disabled = true;
    await startCamera();
    // 캔버스 크기 동기화
    const rect = stage.getBoundingClientRect();
    canvas.width = rect.width; canvas.height = rect.height;

    // MediaPipe 모델 초기화
    console.log("Initializing MediaPipe models...");
    landmarkerBundle = await createHandLandmarker(HAND_MODEL, clamp(parseInt(numHandsInput.value || "1", 10), 1, 2));
    
    const wasmRoot = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
    const vision = await FilesetResolver.forVisionTasks(wasmRoot);
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: GESTURE_MODEL },
      runningMode: "VIDEO",
      numHands: clamp(parseInt(numHandsInput.value || "1", 10), 1, 2)
    });
    console.log("MediaPipe models initialized");

    running = true;
    loop();      // HUD/커서 렌더링
    stopBtn.disabled = false;
  } catch (error) {
    console.error("Error starting camera or initializing MediaPipe models:", error);
    startBtn.disabled = false;
  }
});

stopBtn.addEventListener("click", () => {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  latest = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Close MediaPipe models
  if (landmarkerBundle) {
    landmarkerBundle.close();
    landmarkerBundle = null;
  }
  
  if (gestureRecognizer) {
    gestureRecognizer.close();
    gestureRecognizer = null;
  }
  
  stopBtn.disabled = true;
  startBtn.disabled = false;
});

numHandsInput.addEventListener("change", async () => {
  const n = clamp(parseInt(numHandsInput.value || "1", 10), 1, 2);
  numHandsInput.value = String(n);
  
  // Update MediaPipe models
  if (landmarkerBundle) {
    landmarkerBundle.close();
    landmarkerBundle = await createHandLandmarker(HAND_MODEL, n);
  }
  
  if (gestureRecognizer) {
    gestureRecognizer.close();
    const wasmRoot = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
    const vision = await FilesetResolver.forVisionTasks(wasmRoot);
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: GESTURE_MODEL },
      runningMode: "VIDEO",
      numHands: n
    });
  }
});

mirrorChk.addEventListener("change", () => {
  mirror = mirrorChk.checked;
  video.style.transform = mirror ? "scaleX(-1)" : "none";
  canvas.style.transform = mirror ? "scaleX(-1)" : "none";
  interactor.setMirror(mirror);
});

// Worker code removed - processing directly in main thread

// --- 루프들 ---

// pumpVideo function removed - processing directly in main thread

function loop(): void {
  if (!running) return;

  // Process video frame directly
  if (video.readyState >= 2 && landmarkerBundle && gestureRecognizer) {
    try {
      // Hand landmark detection
      const handRes = detectVideoFrame(landmarkerBundle.landmarker, video);
      
      // Gesture recognition
      const gestRes = gestureRecognizer.recognizeForVideo(video, performance.now());
      
      const hands = handRes?.landmarks ?? [];
      const handedness = (handRes?.handedness ?? []).map(
        (h) => h?.[0]?.categoryName ?? ""
      );
      
      const gestures = (gestRes?.gestures ?? []).map((g) =>
        g?.[0]
          ? { label: g[0].categoryName, score: g[0].score }
          : null
      );
      
      latest = {
        hands: hands as any,
        handedness,
        gestures
      };
      
      // HUD 렌더링
      drawHUD(ctx, hands, canvas.width, canvas.height, performance.now());

      // 첫 번째 손 기준으로 커서/핀치/휠 처리
      const lm0 = hands[0] ?? null;
      interactor.updateFromLandmarks(lm0);

      if (lm0) {
        const tip = lm0[8];
        const pos = toStagePx(tip);
        mouse.move(pos.x, pos.y);

        // Victory 중이면 휠 스크롤
        if (wheelMode) {
          const dy = pos.y - wheelAnchorY;
          if (Math.abs(dy) > 3) {
            mouse.wheel(dy * WHEEL_GAIN);
            wheelAnchorY = pos.y;
          }
        }
      }

      // 제스처 FSM 갱신(첫 번째 손)
      const g0 = gestures[0] ?? null;
      fsm.update(g0);
    } catch (error) {
      console.error("Error processing frame:", error);
    }
  } else {
    // Clear canvas if no hands detected
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // FPS
  frames++;
  const now = performance.now();
  if (now - lastT >= 1000) { 
    fpsEl.textContent = `FPS: ${frames}`; 
    frames = 0; 
    lastT = now; 
    console.log("Running at", fpsEl.textContent);
  }

  raf = requestAnimationFrame(loop);
}

// --- 유틸 ---

function toStagePx(p: { x: number; y: number }): { x: number; y: number } {
  const r = stage.getBoundingClientRect();
  const nx = mirror ? (1 - p.x) : p.x;
  return { x: nx * r.width + r.left, y: p.y * r.height + r.top };
}

function getCursorPxFromFirstTip(): { x: number; y: number } | null {
  const lm0 = latest?.hands?.[0];
  if (!lm0) return null;
  const tip = lm0[8];
  return toStagePx(tip);
}

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

function flashCard(): void {
  const f = document.getElementById("clickFlash") as HTMLElement | null;
  if (!f) return;
  f.classList.remove("active");
  void f.offsetWidth;
  f.classList.add("active");
}

// 카메라 시작
async function startCamera(): Promise<void> {
  try {
    console.log("Requesting camera access...");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false
    });
    console.log("Camera access granted");
    video.srcObject = stream;
    await video.play();
    console.log("Video playing");

    // 초기 미러 반영
    mirror = mirrorChk.checked;
    video.style.transform = mirror ? "scaleX(-1)" : "none";
    canvas.style.transform = mirror ? "scaleX(-1)" : "none";
    interactor.setMirror(mirror);
  } catch (error) {
    console.error("Error starting camera:", error);
    throw error;
  }
}