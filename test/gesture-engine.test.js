import test from "node:test";
import assert from "node:assert/strict";
import { GestureEngine, MotionPilot } from "../src/index.js";

const acceleration = (x, timestamp) => ({ x, y: 0, z: 0, timestamp });

test("detects a shake only after alternating acceleration peaks", () => {
  const engine = new GestureEngine();
  const events = [];
  engine.onGesture((event) => events.push(event));

  engine.feedAcceleration(acceleration(15, 0));
  engine.feedAcceleration(acceleration(-15, 120));
  engine.feedAcceleration(acceleration(16, 240));

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "shake");
  assert.equal(events[0].peakCount, 3);
  assert.equal(Object.isFrozen(events[0]), true);
});

test("does not classify a single jolt or same-direction vibration as a shake", () => {
  const engine = new GestureEngine();
  const events = [];
  engine.onGesture((event) => events.push(event));
  engine.feedAcceleration(acceleration(18, 0));
  engine.feedAcceleration(acceleration(18, 120));
  engine.feedAcceleration(acceleration(18, 240));
  assert.equal(events.length, 0);
});

test("applies a cooldown after a detected shake", () => {
  const engine = new GestureEngine();
  let count = 0;
  engine.onGesture(() => count++);
  for (const [value, time] of [[15, 0], [-15, 120], [15, 240], [-15, 360]]) engine.feedAcceleration(acceleration(value, time));
  for (const [value, time] of [[15, 500], [-15, 620], [15, 740], [-15, 860]]) engine.feedAcceleration(acceleration(value, time));
  assert.equal(count, 1);
});

test("detects a tilt once until the device returns to the neutral zone", () => {
  const engine = new GestureEngine();
  const events = [];
  engine.onGesture((event) => events.push(event));
  assert.equal(engine.feedOrientation({ beta: 0, gamma: 35, timestamp: 0 }), true);
  assert.equal(engine.feedOrientation({ beta: 0, gamma: 40, timestamp: 20 }), false);
  assert.equal(engine.feedOrientation({ beta: 0, gamma: 5, timestamp: 40 }), false);
  assert.equal(engine.feedOrientation({ beta: 0, gamma: -35, timestamp: 60 }), true);
  assert.deepEqual(events.map((event) => event.type), ["tilt-right", "tilt-left"]);
});

test("supports calibration relative to the user's neutral position", () => {
  const engine = new GestureEngine();
  engine.calibrate({ beta: 10, gamma: -8 });
  const events = [];
  engine.onGesture((event) => events.push(event));
  engine.feedOrientation({ beta: 10, gamma: 25, timestamp: 0 });
  assert.equal(events[0].type, "tilt-right");
});

test("validates samples and rejects non-monotonic timestamps per sensor stream", () => {
  const engine = new GestureEngine();
  assert.throws(() => engine.feedAcceleration({ x: NaN, y: 0, z: 0, timestamp: 0 }), /finite number/);
  engine.feedAcceleration(acceleration(0, 10));
  assert.throws(() => engine.feedAcceleration(acceleration(15, 9)), /monotonic/);
  assert.equal(engine.feedOrientation({ beta: 35, gamma: 0, timestamp: 1 }), true);
});

test("unsubscribe stops receiving events", () => {
  const engine = new GestureEngine();
  let count = 0;
  const unsubscribe = engine.onGesture(() => count++);
  unsubscribe();
  engine.feedOrientation({ beta: 0, gamma: 35, timestamp: 0 });
  assert.equal(count, 0);
});

test("browser adapter attaches and removes sensor listeners", async () => {
  const listeners = new Map();
  const fakeWindow = {
    DeviceMotionEvent: class DeviceMotionEvent {},
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name)
  };
  const pilot = new MotionPilot({ windowRef: fakeWindow });
  assert.equal(await pilot.start(), true);
  assert.equal(listeners.has("devicemotion"), true);
  assert.equal(listeners.has("deviceorientation"), true);
  assert.equal(await pilot.start(), false);
  assert.equal(pilot.stop(), true);
  assert.equal(listeners.size, 0);
  assert.equal(pilot.stop(), false);
});

test("requests permission from permission-gated sensor constructors", async () => {
  const calls = [];
  class MotionEvent { static async requestPermission() { calls.push("motion"); return "granted"; } }
  class OrientationEvent { static async requestPermission() { calls.push("orientation"); return "denied"; } }
  const allowed = await MotionPilot.requestPermission({ DeviceMotionEvent: MotionEvent, DeviceOrientationEvent: OrientationEvent });
  assert.equal(allowed, false);
  assert.deepEqual(calls, ["motion", "orientation"]);
  await assert.rejects(MotionPilot.requestPermission({}), /not supported/);
});
