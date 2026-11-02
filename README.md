# MotionPilot Core

**Privacy-first motion gesture detection for the browser.** MotionPilot Core turns device motion and orientation samples into simple events such as `shake`, `tilt-left`, `tilt-right`, `tilt-up`, and `tilt-down`.

It is intentionally small: no analytics, no network calls, no background service, no remote telemetry, and no dependency on a UI framework.

## Status

Early public source release (`0.1.0`); the npm package has not yet been published. The deterministic gesture engine and browser adapter are covered by Node's built-in test runner. Real-device behaviour varies by browser, operating system, device sensors, and hardware; test on the devices you plan to support.

## Install

This repository is the source distribution. Until a package release is published to npm, install it directly from GitHub:

```bash
npm install github:questionanswer5656/motionpilot-build
```

Or use the source directly in a browser project while developing:

```js
import { MotionPilot } from "./src/index.js";
```

## Quick start

```js
import { MotionPilot } from "motionpilot-core";

const motion = new MotionPilot();
const unsubscribe = motion.onGesture((event) => {
  console.log("Gesture:", event.type, event);
});

// Call start from a direct user action, such as a button click.
await motion.start();

// When the feature is no longer needed:
motion.stop();
unsubscribe();
```

On browsers that require sensor permission, `start()` requests it. The call should be triggered by a user gesture. If permission is denied or unavailable, `start()` rejects with an error. The demo in `examples/basic-browser.html` shows the intended flow.

## Deterministic engine

Use `GestureEngine` when sensor samples come from a game engine, native bridge, replay, or test fixture:

```js
import { GestureEngine } from "motionpilot-core";

const engine = new GestureEngine({ shakeThreshold: 12 });
engine.onGesture((event) => console.log(event.type));

engine.feedAcceleration({ x: 15, y: 0, z: 0, timestamp: 100 });
engine.feedAcceleration({ x: -15, y: 0, z: 0, timestamp: 220 });
engine.feedAcceleration({ x: 16, y: 0, z: 0, timestamp: 340 });
```

Acceleration is measured in metres per second squared. Timestamps are milliseconds and must be monotonic for each sensor stream.

### Configuration

| Option | Default | Purpose |
| --- | ---: | --- |
| `shakeThreshold` | `12` | Minimum acceleration magnitude for a shake peak (m/s²) |
| `minShakePeaks` | `3` | Peaks required inside the shake window |
| `minDirectionChanges` | `2` | Direction reversals required on the dominant axis |
| `minPeakIntervalMs` | `90` | Debounce interval between peaks |
| `shakeWindowMs` | `900` | Maximum time span for one shake |
| `shakeCooldownMs` | `700` | Cooldown after a detected shake |
| `tiltThresholdDeg` | `28` | Angle from the calibrated neutral position |
| `tiltNeutralDeg` | `14` | Angle below which a tilt is considered released |

Values are starting points, not universal physical constants. Tune and validate them against your target devices and users.

## API

- `new MotionPilot({ windowRef?, engine?, gravityTimeConstantMs? })`
- `await MotionPilot.requestPermission(windowRef?)`
- `await motion.start()` and `motion.stop()`
- `motion.onGesture(callback)` returns an unsubscribe function
- `motion.calibrate({ beta, gamma })` sets the neutral orientation
- `new GestureEngine(options)` creates the pure recognition engine
- `engine.feedAcceleration({ x, y, z, timestamp })`
- `engine.feedOrientation({ beta, gamma, timestamp })`
- `engine.reset()` clears recognizer state and calibration

Gesture events are immutable objects. Shake events include `intensity` and `peakCount`; tilt events include the measured `angle`.

## Browser support and limitations

- Requires a browser that exposes `DeviceMotionEvent` and/or `DeviceOrientationEvent`.
- Permission-gated platforms require a secure context (HTTPS or localhost) and a user-initiated permission request.
- Some browsers or devices may omit linear acceleration. The adapter then estimates dynamic acceleration by subtracting a low-pass gravity estimate from `accelerationIncludingGravity`.
- Sensor axes and angle conventions are device-relative. Calibrate on the target device and verify direction labels before using them for important actions.
- Motion sensor data is noisy. Do not use gesture recognition as an authentication, safety-critical, medical, or emergency-control mechanism.
- Stopping the adapter removes its event listeners. MotionPilot never starts itself, keeps no background worker, and sends no sensor data over the network.

## Development

Requires Node.js 20 or newer. No third-party runtime or test dependencies are required.

```bash
npm test
npm run check
```

Open `examples/basic-browser.html` through a local HTTPS development server (or localhost) to try the browser adapter on a compatible device.

## Contributing

Bug reports and pull requests are welcome. Please include the browser/device model, OS version, permission state, and a minimal reproducible sample. Do not include personal sensor recordings unless you have removed identifying information and the data owner has explicitly agreed to share them.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
