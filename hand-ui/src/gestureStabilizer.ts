export type GestureLabel = "Thumb_Up" | "Victory" | "OK" | null;

export interface GestureStabilizerConfig {
  windowSize?: number; // Number of frames to consider for stabilization
  minCount?: number; // Minimum count to consider a gesture stable
  minScore?: number; // Minimum confidence score
  hysteresis?: number; // Hysteresis threshold to prevent flickering
  debounceTime?: number; // Time in ms to debounce gesture changes
}

export class GestureStabilizer {
  private config: GestureStabilizerConfig;
  private history: (GestureLabel)[] = [];
  private current: GestureLabel = null;
  private lastStableTime = 0;
  private debounceTimeout: number | null = null;
  
  constructor(config: GestureStabilizerConfig = {}) {
    this.config = {
      windowSize: 8,
      minCount: 5,
      minScore: 0.7,
      hysteresis: 0.1,
      debounceTime: 100,
      ...config
    };
  }
  
  update(label: GestureLabel, score: number): GestureLabel {
    // Apply minimum score threshold
    if (score < (this.config.minScore || 0.7)) {
      label = null;
    }
    
    // Add to history
    this.history.push(label);
    if (this.history.length > (this.config.windowSize || 8)) {
      this.history.shift();
    }
    
    // Apply hysteresis - if we have a current gesture, require lower confidence to end it
    if (this.current && label !== this.current) {
      // Keep current gesture if confidence is still reasonably high
      const currentCount = this.history.filter(g => g === this.current).length;
      if (currentCount > (this.config.minCount || 5) - (this.config.hysteresis || 0.1)) {
        return this.current;
      }
    }
    
    // Find the most frequent gesture in the window
    const stable = this.majority(this.history);
    
    // Apply debouncing
    const now = performance.now();
    if (this.debounceTimeout) {
      // Still in debounce period, return current state
      return this.current;
    }
    
    // Check if gesture has changed
    if (this.current !== stable) {
      // Set debounce timeout
      if (this.config.debounceTime && this.config.debounceTime > 0) {
        if (this.debounceTimeout) {
          clearTimeout(this.debounceTimeout);
        }
        this.debounceTimeout = window.setTimeout(() => {
          this.debounceTimeout = null;
        }, this.config.debounceTime);
      }
      
      this.current = stable;
      this.lastStableTime = now;
    }
    
    return this.current;
  }
  
  getCurrent(): GestureLabel {
    return this.current;
  }
  
  reset(): void {
    this.history = [];
    this.current = null;
    this.lastStableTime = 0;
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
  }
  
  private majority(arr: (GestureLabel)[]): GestureLabel {
    const counts: Record<string, number> = {};
    for (const gesture of arr) {
      const key = gesture || "null";
      counts[key] = (counts[key] || 0) + 1;
    }
    
    let best: string | null = null;
    let maxCount = 0;
    
    for (const [key, count] of Object.entries(counts)) {
      if (count > maxCount) {
        best = key;
        maxCount = count;
      }
    }
    
    // Check if we have enough samples to consider it stable
    if (maxCount >= (this.config.minCount || 5)) {
      return best === "null" ? null : (best as GestureLabel);
    }
    
    return null;
  }
}