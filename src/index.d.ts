export type GestureEvent =
  | { readonly type: "shake"; readonly timestamp: number; readonly intensity: number; readonly peakCount: number }
  | { readonly type: "tilt-left" | "tilt-right" | "tilt-up" | "tilt-down"; readonly timestamp: number; readonly angle: number };

export interface AccelerationSample { x: number; y: number; z: number; timestamp?: number }
export interface OrientationSample { beta?: number; gamma?: number; timestamp?: number }
export interface GestureEngineOptions {
  shakeThreshold?: number;
  minShakePeaks?: number;
  minDirectionChanges?: number;
  minPeakIntervalMs?: number;
  shakeWindowMs?: number;
  shakeCooldownMs?: number;
  tiltThresholdDeg?: number;
  tiltNeutralDeg?: number;
}
export declare class GestureEngine {
  constructor(options?: GestureEngineOptions);
  onGesture(listener: (event: GestureEvent) => void): () => boolean;
  calibrate(sample: { beta?: number; gamma?: number }): void;
  feedAcceleration(sample: AccelerationSample): boolean;
  feedOrientation(sample: OrientationSample): boolean;
  reset(): void;
}
export declare class MotionPilot {
  constructor(options?: { windowRef?: Window; engine?: GestureEngine; gravityTimeConstantMs?: number });
  static requestPermission(windowRef?: Window): Promise<boolean>;
  onGesture(listener: (event: GestureEvent) => void): () => boolean;
  start(): Promise<boolean>;
  stop(): boolean;
  calibrate(sample: { beta?: number; gamma?: number }): void;
}
