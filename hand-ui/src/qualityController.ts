export interface QualitySettings {
  resolution: { width: number; height: number };
  numHands: number;
  modelComplexity: number; // 0 = Lite, 1 = Full, 2 = Heavy
  enableSmoothing: boolean;
  maxFrameRate: number;
}

export class QualityController {
  private currentSettings: QualitySettings;
  private performanceHistory: { fps: number; frameTime: number; timestamp: number }[] = [];
  private readonly HISTORY_SIZE = 30; // Keep 30 seconds of history
  private lastAdjustmentTime = 0;
  private readonly ADJUSTMENT_COOLDOWN = 5000; // 5 seconds cooldown
  
  constructor(initialSettings: QualitySettings) {
    this.currentSettings = { ...initialSettings };
  }
  
  getCurrentSettings(): QualitySettings {
    return { ...this.currentSettings };
  }
  
  recordPerformance(fps: number, frameTime: number): void {
    const now = Date.now();
    this.performanceHistory.push({ fps, frameTime, timestamp: now });
    
    // Remove old entries
    const cutoffTime = now - 30000; // 30 seconds ago
    this.performanceHistory = this.performanceHistory.filter(
      entry => entry.timestamp > cutoffTime
    );
    
    // Adjust quality if needed and cooldown has passed
    if (now - this.lastAdjustmentTime > this.ADJUSTMENT_COOLDOWN) {
      this.adjustQualityIfNeeded();
      this.lastAdjustmentTime = now;
    }
  }
  
  private adjustQualityIfNeeded(): void {
    if (this.performanceHistory.length < 10) return; // Need at least 10 samples
    
    const recent = this.performanceHistory.slice(-10);
    const avgFps = recent.reduce((sum, entry) => sum + entry.fps, 0) / recent.length;
    const avgFrameTime = recent.reduce((sum, entry) => sum + entry.frameTime, 0) / recent.length;
    
    // Check if we need to reduce quality
    if (avgFps < 25 || avgFrameTime > 30) {
      this.reduceQuality();
    } 
    // Check if we can increase quality
    else if (avgFps > 35 && avgFrameTime < 20) {
      this.increaseQuality();
    }
  }
  
  private reduceQuality(): void {
    // First try reducing resolution
    if (this.currentSettings.resolution.width > 640) {
      this.currentSettings.resolution = { width: 640, height: 480 };
      console.log("Reduced resolution to 640x480");
      return;
    }
    
    // Then try reducing number of hands
    if (this.currentSettings.numHands > 1) {
      this.currentSettings.numHands = 1;
      console.log("Reduced to single hand detection");
      return;
    }
    
    // Then try reducing model complexity
    if (this.currentSettings.modelComplexity > 0) {
      this.currentSettings.modelComplexity--;
      console.log("Reduced model complexity");
      return;
    }
    
    // Finally reduce max frame rate
    if (this.currentSettings.maxFrameRate > 20) {
      this.currentSettings.maxFrameRate = 20;
      console.log("Reduced max frame rate to 20fps");
    }
  }
  
  private increaseQuality(): void {
    // First try increasing frame rate
    if (this.currentSettings.maxFrameRate < 30) {
      this.currentSettings.maxFrameRate = 30;
      console.log("Increased max frame rate to 30fps");
      return;
    }
    
    // Then try increasing model complexity
    if (this.currentSettings.modelComplexity < 2) {
      this.currentSettings.modelComplexity++;
      console.log("Increased model complexity");
      return;
    }
    
    // Then try increasing number of hands
    if (this.currentSettings.numHands < 2) {
      this.currentSettings.numHands = 2;
      console.log("Increased to dual hand detection");
      return;
    }
    
    // Finally increase resolution
    if (this.currentSettings.resolution.width < 960) {
      this.currentSettings.resolution = { width: 960, height: 720 };
      console.log("Increased resolution to 960x720");
    }
  }
  
  resetToDefault(): void {
    this.currentSettings = {
      resolution: { width: 960, height: 720 },
      numHands: 2,
      modelComplexity: 1,
      enableSmoothing: true,
      maxFrameRate: 30
    };
    this.performanceHistory = [];
    this.lastAdjustmentTime = 0;
  }
}