import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult
} from "@mediapipe/tasks-vision";

export interface LandmarkerBundle {
  landmarker: HandLandmarker;
  close: () => void;
}

export async function createHandLandmarker(
  modelUrl: string,
  numHands: number
): Promise<LandmarkerBundle> {
  const wasmRoot = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
  const vision = await FilesetResolver.forVisionTasks(wasmRoot);
  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelUrl },
    runningMode: "VIDEO",
    numHands
  });
  return {
    landmarker,
    close: () => landmarker.close()
  };
}

export function detectVideoFrame(
  landmarker: HandLandmarker,
  video: HTMLVideoElement
): HandLandmarkerResult | null {
  // 가이드에 맞춰 VIDEO 모드에서 프레임 타임스탬프 없이 호출
  // detectForVideo는 동기적으로 결과를 반환
  // 결과: {landmarks, worldLandmarks, handedness}
  return landmarker.detectForVideo(video, performance.now());
}