const DEFAULTS = Object.freeze({
  shakeThreshold: 12,
  minShakePeaks: 3,
  minDirectionChanges: 2,
  minPeakIntervalMs: 90,
  shakeWindowMs: 900,
  shakeCooldownMs: 700,
  tiltThresholdDeg: 28,
  tiltNeutralDeg: 14
});

const DIRECTIONS = Object.freeze([
  ["tilt-left", "gamma", -1],
  ["tilt-right", "gamma", 1],
  ["tilt-up", "beta", -1],
  ["tilt-down", "beta", 1]
]);

function finiteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
}

function validateOptions(options) {
  for (const key of ["shakeThreshold", "minPeakIntervalMs", "shakeWindowMs", "shakeCooldownMs", "tiltThresholdDeg", "tiltNeutralDeg"]) {
    if (!(options[key] > 0)) throw new RangeError(`${key} must be greater than zero`);
  }
  if (!Number.isInteger(options.minShakePeaks) || options.minShakePeaks < 2) {
    throw new RangeError("minShakePeaks must be an integer greater than or equal to 2");
  }
  if (!Number.isInteger(options.minDirectionChanges) || options.minDirectionChanges < 1) {
    throw new RangeError("minDirectionChanges must be a positive integer");
  }
  if (options.tiltNeutralDeg >= options.tiltThresholdDeg) {
    throw new RangeError("tiltNeutralDeg must be smaller than tiltThresholdDeg");
  }
}

/** Deterministic recognizer that accepts sensor samples from any runtime. */
export class GestureEngine {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    validateOptions(this.options);
    this.listeners = new Set();
    this.peaks = [];
    this.lastPeakAt = -Infinity;
    this.lastAccelerationTimestamp = -Infinity;
    this.lastOrientationTimestamp = -Infinity;
    this.cooldownUntil = -Infinity;
    this.tiltBaseline = { beta: 0, gamma: 0 };
    this.activeTilt = null;
  }

  onGesture(listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  calibrate({ beta = 0, gamma = 0 }) {
    finiteNumber(beta, "beta");
    finiteNumber(gamma, "gamma");
    this.tiltBaseline = { beta, gamma };
    this.activeTilt = null;
  }

  feedAcceleration({ x, y, z, timestamp = Date.now() }) {
    finiteNumber(x, "x");
    finiteNumber(y, "y");
    finiteNumber(z, "z");
    finiteNumber(timestamp, "timestamp");
    this.#assertMonotonic(timestamp, "acceleration");

    const magnitude = Math.hypot(x, y, z);
    if (magnitude < this.options.shakeThreshold || timestamp < this.cooldownUntil) return false;
    if (timestamp - this.lastPeakAt < this.options.minPeakIntervalMs) return false;

    const axes = [x, y, z];
    let axis = 0;
    if (Math.abs(y) > Math.abs(axes[axis])) axis = 1;
    if (Math.abs(z) > Math.abs(axes[axis])) axis = 2;
    const peak = { timestamp, axis, sign: Math.sign(axes[axis]), magnitude };

    this.peaks = this.peaks.filter((item) => timestamp - item.timestamp <= this.options.shakeWindowMs);
    this.peaks.push(peak);
    this.lastPeakAt = timestamp;

    const directionChanges = this.#countDirectionChanges();
    if (this.peaks.length >= this.options.minShakePeaks && directionChanges >= this.options.minDirectionChanges) {
      this.#emit({
        type: "shake",
        timestamp,
        intensity: Number(magnitude.toFixed(3)),
        peakCount: this.peaks.length
      });
      this.peaks = [];
      this.cooldownUntil = timestamp + this.options.shakeCooldownMs;
      return true;
    }
    return false;
  }

  feedOrientation({ beta = 0, gamma = 0, timestamp = Date.now() }) {
    finiteNumber(beta, "beta");
    finiteNumber(gamma, "gamma");
    finiteNumber(timestamp, "timestamp");
    this.#assertMonotonic(timestamp, "orientation");

    const deltaBeta = beta - this.tiltBaseline.beta;
    const deltaGamma = gamma - this.tiltBaseline.gamma;
    const { tiltThresholdDeg, tiltNeutralDeg } = this.options;

    if (Math.abs(deltaBeta) < tiltNeutralDeg && Math.abs(deltaGamma) < tiltNeutralDeg) {
      this.activeTilt = null;
      return false;
    }

    let candidate = null;
    for (const [name, axis, sign] of DIRECTIONS) {
      const value = axis === "beta" ? deltaBeta : deltaGamma;
      if (sign * value >= tiltThresholdDeg && (!candidate || Math.abs(value) > candidate.amount)) {
        candidate = { name, amount: Math.abs(value) };
      }
    }
    if (!candidate || candidate.name === this.activeTilt) return false;

    this.activeTilt = candidate.name;
    this.#emit({
      type: candidate.name,
      timestamp,
      angle: Number(candidate.amount.toFixed(2))
    });
    return true;
  }

  reset() {
    this.peaks = [];
    this.lastPeakAt = -Infinity;
    this.lastAccelerationTimestamp = -Infinity;
    this.lastOrientationTimestamp = -Infinity;
    this.cooldownUntil = -Infinity;
    this.activeTilt = null;
    this.tiltBaseline = { beta: 0, gamma: 0 };
  }

  #assertMonotonic(timestamp, stream) {
    const key = stream === "acceleration" ? "lastAccelerationTimestamp" : "lastOrientationTimestamp";
    if (timestamp < this[key]) throw new RangeError(`${stream} timestamps must be monotonic`);
    this[key] = timestamp;
  }

  #countDirectionChanges() {
    let changes = 0;
    let previous = null;
    for (const peak of this.peaks) {
      if (previous && previous.axis === peak.axis && previous.sign !== peak.sign) changes += 1;
      previous = peak;
    }
    return changes;
  }

  #emit(event) {
    const immutableEvent = Object.freeze({ ...event });
    for (const listener of this.listeners) listener(immutableEvent);
  }
}