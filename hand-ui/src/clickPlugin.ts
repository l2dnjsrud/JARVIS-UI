import type { HandData, Plugin } from "./plugins";
import { EventDispatcher, type HandEventData } from "./events";

export interface ClickPluginConfig {
  clickDurationThreshold?: number; // milliseconds
  doubleClickThreshold?: number; // milliseconds
}

export class ClickPlugin implements Plugin {
  name = "click";
  enabled = true;
  
  private config: ClickPluginConfig;
  private lastClickTime = 0;
  private clickTimeout: number | null = null;
  private eventDispatcher: EventDispatcher;
  
  constructor(config: ClickPluginConfig = {}) {
    this.config = {
      clickDurationThreshold: 300,
      doubleClickThreshold: 500,
      ...config
    };
    this.eventDispatcher = new EventDispatcher();
  }
  
  onGestureStart(gesture: "Thumb_Up" | "Victory" | "OK", handData: HandData, handIndex: number): void {
    if (gesture === "Thumb_Up") {
      const now = performance.now();
      
      // Clear any existing timeout
      if (this.clickTimeout) {
        clearTimeout(this.clickTimeout);
        this.clickTimeout = null;
      }
      
      // Check for double click
      if (now - this.lastClickTime < (this.config.doubleClickThreshold || 500)) {
        this.handleDoubleClick(handData, handIndex);
      } else {
        // Set timeout for single click
        this.clickTimeout = window.setTimeout(() => {
          this.handleClick(handData, handIndex);
          this.clickTimeout = null;
        }, this.config.clickDurationThreshold || 300);
      }
    }
  }
  
  onGestureEnd(gesture: "Thumb_Up" | "Victory" | "OK", handData: HandData, handIndex: number): void {
    if (gesture === "Thumb_Up") {
      const now = performance.now();
      this.lastClickTime = now;
    }
  }
  
  private handleClick(handData: HandData, handIndex: number): void {
    // Dispatch custom event
    const eventData: HandEventData = {
      handIndex: handIndex,
      landmarks: handData.landmarks,
      gesture: handData.gesture,
      handedness: handData.handedness
    };
    this.eventDispatcher.dispatchHandClick({ type: 'click', handData: eventData });
  }
  
  private handleDoubleClick(handData: HandData, handIndex: number): void {
    // Dispatch custom event
    const eventData: HandEventData = {
      handIndex: handIndex,
      landmarks: handData.landmarks,
      gesture: handData.gesture,
      handedness: handData.handedness
    };
    this.eventDispatcher.dispatchHandClick({ type: 'doubleclick', handData: eventData });
  }
}