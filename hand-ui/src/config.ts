// Application configuration
export const AppConfig = {
  // MediaPipe model URLs
  HAND_MODEL_URL: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
  GESTURE_MODEL_URL: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task",
  
  // Default settings
  DEFAULT_NUM_HANDS: 2,
  DEFAULT_MIRROR: true,
  DEFAULT_RESOLUTION: { width: 960, height: 720 },
  
  // Gesture thresholds
  PINCH_START_THRESHOLD: 0.045,
  PINCH_END_THRESHOLD: 0.065,
  GESTURE_MIN_SCORE: 0.7,
  
  // Stabilization settings
  GESTURE_WINDOW_SIZE: 8,
  GESTURE_MIN_COUNT: 5,
  GESTURE_HYSTERESIS: 0.1,
  GESTURE_DEBOUNCE_TIME: 100, // ms
  
  // Performance settings
  TARGET_FPS: 30,
  MAIN_THREAD_BUDGET_MS: 5,
  WORKER_BUDGET_MS: 25,
  
  // Click settings
  CLICK_DURATION_THRESHOLD: 300, // ms
  DOUBLE_CLICK_THRESHOLD: 500, // ms
  
  // Scroll settings
  SCROLL_SENSITIVITY: 6,
  
  // Quality control
  QUALITY_ADJUSTMENT_COOLDOWN: 5000, // ms
  QUALITY_HISTORY_SIZE: 30 // seconds
};

export default AppConfig;