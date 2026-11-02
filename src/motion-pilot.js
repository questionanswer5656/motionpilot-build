import { GestureEngine } from "./gesture-engine.js";

function isVector(value) {
  return value && [value.x, value.y, value.z].every((number) => typeof number === "number" && Number.isFinite(number));
}

/** Browser adapter for DeviceMotionEvent and DeviceOrientationEvent. */
export class MotionPilot {
  constructor({ windowRef = globalThis.window, engine = new GestureEngine(), gravityTimeConstantMs = 500 } = {}) {
    if (!windowRef || typeof windowRef.addEventListener !== "function" || typeof windowRef.removeEventListener !== "function") {
      throw new TypeError("A window-like object with addEventListener/removeEventListener is required");
    }
    if (!(gravityTimeConstantMs > 0)) throw new RangeError("gravityTimeConstantMs must be greater than zero");
    this.window = windowRef;
    this.engine = engine;
    this.gravityTimeConstantMs = gravityTimeConstantMs;
    this.running = false;
    this.gravity = null;
    this.lastMotionTimestamp = null;
    this.handleMotion = this.#handleMotion.bind(this);
    this.handleOrientation = this.#handleOrientation.bind(this);
  }

  static async requestPermission(windowRef = globalThis.window) {
    if (!windowRef) throw new Error("Motion sensors are not available in this environment");
    const constructors = [windowRef.DeviceMotionEvent, windowRef.DeviceOrientationEvent].filter(Boolean);
    for (const SensorEvent of constructors) {
      if (typeof SensorEvent.requestPermission !== "function") continue;
      const result = await SensorEvent.requestPermission.call(SensorEvent);
      if (result !== "granted") return false;
    }
    return true;
  }

  onGesture(listener) {
    return this.engine.onGesture(listener);
  }

  /** Call from a user gesture (for example, a button click) on permission-gated browsers. */
  async start() {
    if (this.running) return false;
    const granted = await MotionPilot.requestPermission(this.window);
    if (!granted) throw new Error("Motion sensor permission was not granted");
    this.window.addEventListener("devicemotion", this.handleMotion, { passive: true });
    this.window.addEventListener("deviceorientation", this.handleOrientation, { passive: true });
    this.running = true;
    return true;
  }

  stop() {
    if (!this.running) return false;
    this.window.removeEventListener("devicemotion", this.handleMotion);
    this.window.removeEventListener("deviceorientation", this.handleOrientation);
    this.running = false;
    this.gravity = null;
    this.lastMotionTimestamp = null;
    return true;
  }

  calibrate(sample) {
    this.engine.calibrate(sample);
  }

  #handleMotion(event) {
    const now = typeof event.timeStamp === "number" ? event.timeStamp : Date.now();
    if (isVector(event.acceleration)) {
      this.engine.feedAcceleration({ ...event.acceleration, timestamp: now });
      return;
    }
    if (!isVector(event.accelerationIncludingGravity)) return;

    const raw = event.accelerationIncludingGravity;
    if (!this.gravity) {
      this.gravity = { ...raw };
      this.lastMotionTimestamp = now;
      return;
    }
    const elapsed = Math.max(1, now - this.lastMotionTimestamp);
    const alpha = Math.exp(-elapsed / this.gravityTimeConstantMs);
    this.gravity = {
      x: alpha * this.gravity.x + (1 - alpha) * raw.x,
      y: alpha * this.gravity.y + (1 - alpha) * raw.y,
      z: alpha * this.gravity.z + (1 - alpha) * raw.z
    };
    this.lastMotionTimestamp = now;
    this.engine.feedAcceleration({
      x: raw.x - this.gravity.x,
      y: raw.y - this.gravity.y,
      z: raw.z - this.gravity.z,
      timestamp: now
    });
  }

  #handleOrientation(event) {
    if (typeof event.beta !== "number" || typeof event.gamma !== "number") return;
    const timestamp = typeof event.timeStamp === "number" ? event.timeStamp : Date.now();
    this.engine.feedOrientation({ beta: event.beta, gamma: event.gamma, timestamp });
  }
}