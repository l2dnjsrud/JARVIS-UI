/// <reference lib="webworker" />
import {
  FilesetResolver,
  HandLandmarker,
  GestureRecognizer,
  type NormalizedLandmark
} from "@mediapipe/tasks-vision";

type InitMsg = {
  type: "init";
  handModelUrl: string;
  gestureModelUrl: string;
  numHands: number;
};
type FrameMsg = { type: "frame"; bitmap: ImageBitmap };
type UpdateMsg = { type: "update"; numHands: number };

type OutMsg =
  | {
      type: "result";
      hands: NormalizedLandmark[][];
      handedness: string[];
      gestures: ({ label: string; score: number } | null)[];
    }
  | { type: "ready" };

let landmarker: HandLandmarker | null = null;
let recognizer: GestureRecognizer | null = null;

async function init(opts: InitMsg): Promise<void> {
  try {
    console.log("Initializing MediaPipe models...");
    const wasmRoot =
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
    const vision = await FilesetResolver.forVisionTasks(wasmRoot);
    console.log("Vision tasks resolved");

    landmarker?.close();
    recognizer?.close();

    console.log("Creating HandLandmarker...");
    landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: opts.handModelUrl },
      // 워커에서는 ImageBitmap으로 처리하므로 IMAGE 모드 사용
      runningMode: "IMAGE",
      numHands: opts.numHands
    });
    console.log("HandLandmarker created");

    console.log("Creating GestureRecognizer...");
    recognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: opts.gestureModelUrl },
      runningMode: "IMAGE",
      numHands: opts.numHands
    });
    console.log("GestureRecognizer created");

    (self as DedicatedWorkerGlobalScope).postMessage({ type: "ready" } satisfies OutMsg);
    console.log("Worker initialization complete");
  } catch (error) {
    console.error("Error initializing worker:", error);
    (self as DedicatedWorkerGlobalScope).postMessage({ type: "error", error: error.message });
  }
}

async function processFrame(bitmap: ImageBitmap): Promise<void> {
  if (!landmarker || !recognizer) {
    console.log("Landmarker or recognizer not initialized");
    bitmap.close();
    return;
  }

  try {
    // 양쪽 태스크에 동일 프레임 투입
    const handRes = landmarker.detect(bitmap);
    const gestRes = recognizer.recognize(bitmap);
    bitmap.close();

    const hands = handRes?.landmarks ?? [];
    const handedness = (handRes?.handedness ?? []).map(
      (h) => h?.[0]?.categoryName ?? ""
    );

    const gestures = (gestRes?.gestures ?? []).map((g) =>
      g?.[0]
        ? { label: g[0].categoryName, score: g[0].score }
        : null
    );

    (self as DedicatedWorkerGlobalScope).postMessage({
      type: "result",
      hands,
      handedness,
      gestures
    } satisfies OutMsg);
  } catch (error) {
    console.error("Error processing frame:", error);
    bitmap.close();
  }
}

self.onmessage = async (ev: MessageEvent<InitMsg | FrameMsg | UpdateMsg>) => {
  try {
    const msg = ev.data;
    if (msg.type === "init") await init(msg);
    else if (msg.type === "frame") await processFrame(msg.bitmap);
    else if (msg.type === "update" && landmarker && recognizer) {
      // 옵션 갱신은 가장 단순하게 재초기화
      await init({
        type: "init",
        handModelUrl:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
        gestureModelUrl:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task",
        numHands: msg.numHands
      });
    }
  } catch (error) {
    console.error("Error in worker:", error);
    (self as DedicatedWorkerGlobalScope).postMessage({ type: "error", error: error.message });
  }
};