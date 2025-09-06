export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 0;
  private frameTimings: number[] = [];
  private maxFrameTimings = 60; // Keep track of last 60 frames
  
  // Performance thresholds
  private readonly TARGET_FPS = 30;
  private readonly MAIN_THREAD_BUDGET_MS = 5; // Main thread budget
  private readonly WORKER_BUDGET_MS = 25; // Worker budget for 2 hands
  
  updateFrameTiming(frameTimeMs: number) {
    this.frameTimings.push(frameTimeMs);
    if (this.frameTimings.length > this.maxFrameTimings) {
      this.frameTimings.shift();
    }
    
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;
    }
  }
  
  getFPS(): number {
    return this.fps;
  }
  
  getAverageFrameTime(): number {
    if (this.frameTimings.length === 0) return 0;
    const sum = this.frameTimings.reduce((a, b) => a + b, 0);
    return sum / this.frameTimings.length;
  }
  
  getMaxFrameTime(): number {
    if (this.frameTimings.length === 0) return 0;
    return Math.max(...this.frameTimings);
  }
  
  getMinFrameTime(): number {
    if (this.frameTimings.length === 0) return 0;
    return Math.min(...this.frameTimings);
  }
  
  isMeetingPerformanceTarget(): boolean {
    return this.fps >= this.TARGET_FPS && this.getAverageFrameTime() <= this.MAIN_THREAD_BUDGET_MS;
  }
  
  getPerformanceReport(): string {
    return `FPS: ${this.fps.toFixed(1)}, Avg: ${this.getAverageFrameTime().toFixed(2)}ms, ` +
           `Min: ${this.getMinFrameTime().toFixed(2)}ms, Max: ${this.getMaxFrameTime().toFixed(2)}ms`;
  }
  
  // Check if we should reduce quality to meet performance targets
  shouldReduceQuality(): boolean {
    return this.getAverageFrameTime() > this.MAIN_THREAD_BUDGET_MS * 1.5 || 
           this.fps < this.TARGET_FPS * 0.8;
  }
  
  // Check if we can increase quality
  canIncreaseQuality(): boolean {
    return this.getAverageFrameTime() < this.MAIN_THREAD_BUDGET_MS * 0.7 && 
           this.fps > this.TARGET_FPS * 1.1;
  }
}