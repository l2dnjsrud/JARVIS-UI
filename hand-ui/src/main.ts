import { drawHUD } from "./hud";
import { GestureStabilizer } from "./gestureStabilizer";
import { MouseSynth } from "./mouse";
import { PinchInteractor } from "./pinchInteractor";
import { PluginManager } from "./plugins";
import { PointerPlugin } from "./pointerPlugin";
import { ScrollPlugin } from "./scrollPlugin";
import { ClickPlugin } from "./clickPlugin";
import { createHandLandmarker, detectVideoFrame } from "./hand";
import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import AppConfig from "./config";

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
let latest: {
  hands: any[][];
  handedness: string[];
  gestures: ({ label: string; score: number } | null)[];
} | null = null;

// Performance monitoring
let frameTimings: number[] = [];
const MAX_FRAME_TIMINGS = 60;

// Quality control
let currentQuality = {
  resolution: { width: 960, height: 720 },
  numHands: 2,
  maxFrameRate: 30
};

// 모델(URL 고정)
const HAND_MODEL = AppConfig.HAND_MODEL_URL;
const GESTURE_MODEL = AppConfig.GESTURE_MODEL_URL;

// MediaPipe models
let landmarkerBundle: Awaited<ReturnType<typeof createHandLandmarker>> | null = null;
let gestureRecognizer: GestureRecognizer | null = null;

// Plugin system
const pluginManager = new PluginManager();
const gestureStabilizers: GestureStabilizer[] = [];

// Register plugins
const pointerPlugin = new PointerPlugin({
  stage,
  cursorEl,
  mirror,
  pinchStartThreshold: AppConfig.PINCH_START_THRESHOLD,
  pinchEndThreshold: AppConfig.PINCH_END_THRESHOLD
});

const scrollPlugin = new ScrollPlugin({
  scrollSensitivity: AppConfig.SCROLL_SENSITIVITY
});
const clickPlugin = new ClickPlugin({
  clickDurationThreshold: AppConfig.CLICK_DURATION_THRESHOLD,
  doubleClickThreshold: AppConfig.DOUBLE_CLICK_THRESHOLD
});

pluginManager.register(pointerPlugin);
pluginManager.register(scrollPlugin);
pluginManager.register(clickPlugin);

// 마우스 합성
const mouse = new MouseSynth();

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

// Set up event listeners for custom events
cursorEl.addEventListener('pinchstart', ((e: CustomEvent) => {
  const detail = e.detail;
  mouse.move(detail.x, detail.y);
  mouse.down(0);
}) as EventListener);

cursorEl.addEventListener('pinchend', ((e: CustomEvent) => {
  const detail = e.detail;
  mouse.move(detail.x, detail.y);
  mouse.up(0);
  
  // If it was a quick pinch, treat as a click
  if (detail.duration && detail.duration < 300) {
    flashCard();
  }
}) as EventListener);

document.addEventListener('handclick', ((e: CustomEvent) => {
  mouse.click(0);
  flashCard();
}) as EventListener);

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
  
  // Reset gesture stabilizers
  gestureStabilizers.length = 0;
  
  stopBtn.disabled = true;
  startBtn.disabled = false;
});

numHandsInput.addEventListener("change", async () => {
  const n = clamp(parseInt(numHandsInput.value || "1", 10), 1, 2);
  numHandsInput.value = String(n);
  
  // Update quality settings
  currentQuality.numHands = n;
  
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
  
  // Reset gesture stabilizers
  gestureStabilizers.length = 0;
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

  const frameStart = performance.now();
  
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
      
      const rawGestures = (gestRes?.gestures ?? []).map((g) =>
        g?.[0]
          ? { label: g[0].categoryName, score: g[0].score }
          : null
      );
      
      // Apply gesture stabilization
      const stabilizedGestures = rawGestures.map((gesture, index) => {
        // Ensure we have a stabilizer for this hand
        if (!gestureStabilizers[index]) {
          gestureStabilizers[index] = new GestureStabilizer({
            windowSize: AppConfig.GESTURE_WINDOW_SIZE,
            minCount: AppConfig.GESTURE_MIN_COUNT,
            minScore: AppConfig.GESTURE_MIN_SCORE,
            hysteresis: AppConfig.GESTURE_HYSTERESIS,
            debounceTime: AppConfig.GESTURE_DEBOUNCE_TIME
          });
        }
        
        if (gesture) {
          const stabilizedLabel = gestureStabilizers[index].update(
            normalizeGestureLabel(gesture.label), 
            gesture.score
          );
          return stabilizedLabel ? { label: stabilizedLabel, score: gesture.score } : null;
        }
        
        // Reset stabilizer for null gestures
        gestureStabilizers[index].update(null, 0);
        return null;
      });
      
      latest = {
        hands: hands as any,
        handedness,
        gestures: stabilizedGestures
      };
      
      // Update plugins with hand data
      pluginManager.updateHandData(hands, stabilizedGestures, handedness);
      
      // Notify plugins of gesture changes
      for (let i = 0; i < stabilizedGestures.length; i++) {
        const gesture = stabilizedGestures[i];
        if (gesture) {
          const label = normalizeGestureLabel(gesture.label);
          if (label) {
            pluginManager.notifyGestureStart(label, i, hands, stabilizedGestures, handedness);
          }
        }
      }
      
      // HUD 렌더링
      drawHUD(ctx, hands, canvas.width, canvas.height, performance.now());

      // 첫 번째 손 기준으로 커서/핀치 처리
      const lm0 = hands[0] ?? null;
      interactor.updateFromLandmarks(lm0);

    } catch (error) {
      console.error("Error processing frame:", error);
    }
  } else {
    // Clear canvas if no hands detected
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Performance monitoring
  const frameEnd = performance.now();
  const frameTime = frameEnd - frameStart;
  
  frameTimings.push(frameTime);
  if (frameTimings.length > MAX_FRAME_TIMINGS) {
    frameTimings.shift();
  }
  
  // FPS
  frames++;
  if (frameEnd - lastT >= 1000) { 
    fpsEl.textContent = `FPS: ${frames}`; 
    frames = 0; 
    lastT = frameEnd; 
    
    // Log performance metrics
    if (frameTimings.length > 0) {
      const avgFrameTime = frameTimings.reduce((a, b) => a + b, 0) / frameTimings.length;
      console.log(`Performance: ${fpsEl.textContent}, Avg frame time: ${avgFrameTime.toFixed(2)}ms`);
    }
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

function normalizeGestureLabel(raw: string): "Thumb_Up" | "Victory" | "OK" | null {
  const s = raw.replace(/\s+/g, "").toLowerCase();
  if (s.includes("thumb") && s.includes("up")) return "Thumb_Up";
  if (s.includes("victory") || s.includes("peace")) return "Victory";
  if (s === "ok" || s.includes("oksign")) return "OK";
  return null;
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
      video: { 
        width: { ideal: currentQuality.resolution.width }, 
        height: { ideal: currentQuality.resolution.height }, 
        facingMode: "user" 
      },
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