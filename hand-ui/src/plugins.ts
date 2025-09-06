import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { GestureSample } from "./gesture";

export interface HandData {
  landmarks: NormalizedLandmark[] | null;
  gesture: GestureSample;
  handedness: string;
}

export interface Plugin {
  name: string;
  enabled: boolean;
  onHandUpdate?: (handData: HandData, handIndex: number) => void;
  onGestureStart?: (gesture: "Thumb_Up" | "Victory" | "OK", handData: HandData, handIndex: number) => void;
  onGestureEnd?: (gesture: "Thumb_Up" | "Victory" | "OK", handData: HandData, handIndex: number) => void;
}

export class PluginManager {
  private plugins: Plugin[] = [];

  register(plugin: Plugin) {
    this.plugins.push(plugin);
  }

  unregister(pluginName: string) {
    this.plugins = this.plugins.filter(p => p.name !== pluginName);
  }

  updateHandData(hands: NormalizedLandmark[][], gestures: GestureSample[], handedness: string[]) {
    // Update each plugin with hand data
    for (let i = 0; i < hands.length; i++) {
      const handData: HandData = {
        landmarks: hands[i] ?? null,
        gesture: gestures[i] ?? null,
        handedness: handedness[i] ?? ""
      };

      for (const plugin of this.plugins) {
        if (plugin.enabled && plugin.onHandUpdate) {
          plugin.onHandUpdate(handData, i);
        }
      }
    }
  }

  notifyGestureStart(gesture: "Thumb_Up" | "Victory" | "OK", handIndex: number, 
                    hands: NormalizedLandmark[][], gestures: GestureSample[], handedness: string[]) {
    const handData: HandData = {
      landmarks: hands[handIndex] ?? null,
      gesture: gestures[handIndex] ?? null,
      handedness: handedness[handIndex] ?? ""
    };

    for (const plugin of this.plugins) {
      if (plugin.enabled && plugin.onGestureStart) {
        plugin.onGestureStart(gesture, handData, handIndex);
      }
    }
  }

  notifyGestureEnd(gesture: "Thumb_Up" | "Victory" | "OK", handIndex: number,
                  hands: NormalizedLandmark[][], gestures: GestureSample[], handedness: string[]) {
    const handData: HandData = {
      landmarks: hands[handIndex] ?? null,
      gesture: gestures[handIndex] ?? null,
      handedness: handedness[handIndex] ?? ""
    };

    for (const plugin of this.plugins) {
      if (plugin.enabled && plugin.onGestureEnd) {
        plugin.onGestureEnd(gesture, handData, handIndex);
      }
    }
  }
}