import type { HandData, Plugin } from "./plugins";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { EventDispatcher } from "./events";

export interface PointerPluginConfig {
  stage: HTMLElement;
  cursorEl: HTMLElement;
  mirror: boolean;
  pinchStartThreshold?: number;
  pinchEndThreshold?: number;
}

export class PointerPlugin implements Plugin {
  name = "pointer";
  enabled = true;
  
  private config: PointerPluginConfig;
  private isPinching = false;
  private pinchStartTime = 0;
  private pinchStartPosition = { x: 0, y: 0 };
  private eventDispatcher: EventDispatcher;
  
  constructor(config: PointerPluginConfig) {
    this.config = {
      pinchStartThreshold: 0.045,
      pinchEndThreshold: 0.065,
      ...config
    };
    this.eventDispatcher = new EventDispatcher();
  }
  
  onHandUpdate(handData: HandData, handIndex: number): void {
    if (!handData.landmarks) {
      this.isPinching = false;
      return;
    }
    
    const landmarks = handData.landmarks;
    const tip = landmarks[8]; // Index finger tip
    const thumb = landmarks[4]; // Thumb tip
    
    // Convert to stage coordinates
    const pos = this.toStagePx(tip);
    
    // Update cursor position
    this.config.cursorEl.style.left = `${pos.x}px`;
    this.config.cursorEl.style.top = `${pos.y}px`;
    
    // Calculate pinch distance
    const pinchDist = this.normDist(tip, thumb);
    
    // Handle pinch gesture
    if (!this.isPinching && pinchDist < (this.config.pinchStartThreshold || 0.045)) {
      this.isPinching = true;
      this.pinchStartTime = performance.now();
      this.pinchStartPosition = { x: pos.x, y: pos.y };
      
      // Dispatch custom event
      this.eventDispatcher.dispatchPinchStart({ x: pos.x, y: pos.y });
    } else if (this.isPinching && pinchDist > (this.config.pinchEndThreshold || 0.065)) {
      this.isPinching = false;
      const duration = performance.now() - this.pinchStartTime;
      
      // Dispatch custom event
      this.eventDispatcher.dispatchPinchEnd({ 
        x: pos.x, 
        y: pos.y, 
        duration,
        startX: this.pinchStartPosition.x,
        startY: this.pinchStartPosition.y
      });
    }
    
    // Dispatch move event
    this.eventDispatcher.dispatchPointerMove({ x: pos.x, y: pos.y, pinching: this.isPinching });
  }
  
  private normDist(a: NormalizedLandmark, b: NormalizedLandmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }
  
  private toStagePx(p: NormalizedLandmark): { x: number; y: number } {
    const rect = this.config.stage.getBoundingClientRect();
    const nx = this.config.mirror ? (1 - p.x) : p.x;
    return { x: nx * rect.width + rect.left, y: p.y * rect.height + rect.top };
  }
}