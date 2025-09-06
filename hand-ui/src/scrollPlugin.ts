import type { HandData, Plugin } from "./plugins";
import { EventDispatcher } from "./events";

export interface ScrollPluginConfig {
  scrollElement?: HTMLElement;
  scrollSensitivity?: number;
}

export class ScrollPlugin implements Plugin {
  name = "scroll";
  enabled = true;
  
  private config: ScrollPluginConfig;
  private isScrolling = false;
  private scrollAnchorY = 0;
  private scrollElement: HTMLElement | Window;
  private eventDispatcher: EventDispatcher;
  
  constructor(config: ScrollPluginConfig = {}) {
    this.config = {
      scrollSensitivity: 6,
      ...config
    };
    
    this.scrollElement = config.scrollElement || window;
    this.eventDispatcher = new EventDispatcher();
  }
  
  onGestureStart(gesture: "Thumb_Up" | "Victory" | "OK", handData: HandData, handIndex: number): void {
    if (gesture === "Victory" && handData.landmarks) {
      this.isScrolling = true;
      const tip = handData.landmarks[8]; // Index finger tip
      const rect = (this.config.scrollElement as HTMLElement).getBoundingClientRect?.() || 
                   { top: 0, height: window.innerHeight };
      this.scrollAnchorY = tip.y * rect.height + rect.top;
      
      // Dispatch custom event
      this.eventDispatcher.dispatchScrollStart({ y: this.scrollAnchorY });
    }
  }
  
  onGestureEnd(gesture: "Thumb_Up" | "Victory" | "OK", handData: HandData, handIndex: number): void {
    if (gesture === "Victory") {
      this.isScrolling = false;
      
      // Dispatch custom event
      this.eventDispatcher.dispatchScrollEnd();
    }
  }
  
  onHandUpdate(handData: HandData, handIndex: number): void {
    if (this.isScrolling && handData.landmarks) {
      const tip = handData.landmarks[8]; // Index finger tip
      const rect = (this.config.scrollElement as HTMLElement).getBoundingClientRect?.() || 
                   { top: 0, height: window.innerHeight };
      const currentY = tip.y * rect.height + rect.top;
      const dy = currentY - this.scrollAnchorY;
      
      if (Math.abs(dy) > 3) {
        const scrollAmount = dy * (this.config.scrollSensitivity || 6);
        
        if (this.scrollElement === window) {
          window.scrollBy(0, scrollAmount);
        } else {
          (this.scrollElement as HTMLElement).scrollTop += scrollAmount;
        }
        
        this.scrollAnchorY = currentY;
        
        // Dispatch custom event
        this.eventDispatcher.dispatchScrolling({ deltaY: scrollAmount, y: currentY });
      }
    }
  }
}