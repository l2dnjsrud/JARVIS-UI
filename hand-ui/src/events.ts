// Custom events for the hand gesture system

export interface HandEventData {
  handIndex: number;
  landmarks: any[] | null;
  gesture: { label: string; score: number } | null;
  handedness: string;
}

export interface PinchEventData {
  x: number;
  y: number;
  duration?: number;
  startX?: number;
  startY?: number;
}

export interface ScrollEventData {
  deltaY: number;
  y: number;
}

export interface ClickEventData {
  type: 'click' | 'doubleclick';
  handData: HandEventData;
}

// Custom event types
export class HandUpdateEvent extends CustomEvent<HandEventData> {
  constructor(detail: HandEventData) {
    super('handupdate', { detail });
  }
}

export class GestureStartEvent extends CustomEvent<{ 
  gesture: string; 
  handData: HandEventData 
}> {
  constructor(gesture: string, handData: HandEventData) {
    super('gesturestart', { detail: { gesture, handData } });
  }
}

export class GestureEndEvent extends CustomEvent<{ 
  gesture: string; 
  handData: HandEventData 
}> {
  constructor(gesture: string, handData: HandEventData) {
    super('gestureend', { detail: { gesture, handData } });
  }
}

export class PinchStartEvent extends CustomEvent<PinchEventData> {
  constructor(detail: PinchEventData) {
    super('pinchstart', { detail });
  }
}

export class PinchEndEvent extends CustomEvent<PinchEventData> {
  constructor(detail: PinchEventData) {
    super('pinchend', { detail });
  }
}

export class PointerMoveEvent extends CustomEvent<{ x: number; y: number; pinching: boolean }> {
  constructor(detail: { x: number; y: number; pinching: boolean }) {
    super('pointermove', { detail });
  }
}

export class ScrollStartEvent extends CustomEvent<{ y: number }> {
  constructor(detail: { y: number }) {
    super('scrollstart', { detail });
  }
}

export class ScrollEndEvent extends CustomEvent<null> {
  constructor() {
    super('scrollend', { detail: null });
  }
}

export class ScrollingEvent extends CustomEvent<ScrollEventData> {
  constructor(detail: ScrollEventData) {
    super('scrolling', { detail });
  }
}

export class HandClickEvent extends CustomEvent<ClickEventData> {
  constructor(detail: ClickEventData) {
    super('handclick', { detail });
  }
}

// Event dispatcher
export class EventDispatcher {
  private target: EventTarget;
  
  constructor(target: EventTarget = document) {
    this.target = target;
  }
  
  dispatchHandUpdate(data: HandEventData): void {
    this.target.dispatchEvent(new HandUpdateEvent(data));
  }
  
  dispatchGestureStart(gesture: string, handData: HandEventData): void {
    this.target.dispatchEvent(new GestureStartEvent(gesture, handData));
  }
  
  dispatchGestureEnd(gesture: string, handData: HandEventData): void {
    this.target.dispatchEvent(new GestureEndEvent(gesture, handData));
  }
  
  dispatchPinchStart(data: PinchEventData): void {
    this.target.dispatchEvent(new PinchStartEvent(data));
  }
  
  dispatchPinchEnd(data: PinchEventData): void {
    this.target.dispatchEvent(new PinchEndEvent(data));
  }
  
  dispatchPointerMove(data: { x: number; y: number; pinching: boolean }): void {
    this.target.dispatchEvent(new PointerMoveEvent(data));
  }
  
  dispatchScrollStart(data: { y: number }): void {
    this.target.dispatchEvent(new ScrollStartEvent(data));
  }
  
  dispatchScrollEnd(): void {
    this.target.dispatchEvent(new ScrollEndEvent());
  }
  
  dispatchScrolling(data: ScrollEventData): void {
    this.target.dispatchEvent(new ScrollingEvent(data));
  }
  
  dispatchHandClick(data: ClickEventData): void {
    this.target.dispatchEvent(new HandClickEvent(data));
  }
}