import test from "node:test";
import assert from "node:assert/strict";
import { physics } from "../src/physics.js";
import {
  ReplayRecorder,
  normalizeReplay,
  sampleReplay,
  MAX_FRAMES,
} from "../src/replay.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} vs ${b}`);
const frame = (time, x = 0, angle = 0, segment = 0) => [
  time,
  x,
  20,
  angle,
  x + 10,
  116,
  angle,
  segment,
];

test("ghost smoothly interpolates body and foot between actual irregular timestamps", () => {
  const replay = normalizeReplay({
    version: 2,
    frames: [frame(0), frame(0.08, 80, 2)],
  });
  const pose = sampleReplay(replay, 0.02);
  near(pose.b.x, 20);
  near(pose.f.x, 30);
  near(pose.b.a, 0.5);
  near(pose.rotor.a, 0.5);
  near(sampleReplay(replay, 0.03).b.x, 30);
  assert.equal(replay.frames[0][1], 0);
});
test("legacy wrapped angles take the short path across +/-pi", () => {
  const replay = normalizeReplay([
    frame(0, 0, Math.PI - 0.1).slice(0, 7),
    frame(0.1, 0, -Math.PI + 0.1).slice(0, 7),
  ]);
  near(sampleReplay(replay, 0.05).b.a, Math.PI);
});
test("new recordings preserve fast flywheel direction and full turns between samples", () => {
  const recorder = new ReplayRecorder(),
    s = physics.create();
  for (let i = 0; i <= 16; i++) {
    s.rotor.a = physics.wrap((i * 100) / 240);
    recorder.capture(i / 240, s);
  }
  assert.equal(recorder.frames.length, 2);
  near(recorder.frames[1][6], 100 / 15);
  near(sampleReplay(recorder.toJSON(), 1 / 30).rotor.a, 100 / 30);
});
test("retry cuts hold the old pose until the new segment begins", () => {
  const recorder = new ReplayRecorder(),
    s = physics.create();
  recorder.capture(0, s);
  s.b.x = 500;
  recorder.capture(0.05, s, { force: true });
  s.b.x = 100;
  recorder.capture(0.05, s, { cut: true });
  s.b.x = 200;
  recorder.capture(0.15, s);
  near(sampleReplay(recorder.toJSON(), 0.049).b.x, 493.6);
  near(sampleReplay(recorder.toJSON(), 0.05).b.x, 100);
  near(sampleReplay(recorder.toJSON(), 0.1).b.x, 150);
  const replay = normalizeReplay({
    version: 2,
    frames: [frame(0, 500), frame(0.1, 100, 0, 1)],
  });
  near(sampleReplay(replay, 0.09).b.x, 500);
});
test("legacy retry jumps and missing sample gaps never sweep across the level", () => {
  const legacy = normalizeReplay([
    frame(0, 900).slice(0, 7),
    frame(0.07, 0).slice(0, 7),
  ]);
  near(sampleReplay(legacy, 0.03).b.x, 900);
  const gap = normalizeReplay({
    version: 2,
    frames: [frame(0), frame(1, 100)],
  });
  near(sampleReplay(gap, 0.5).b.x, 0);
});
test("empty, corrupt, out-of-order and unsupported ghosts fail safely", () => {
  for (const ghost of [
    null,
    {},
    { version: 99, frames: [] },
    [frame(0)],
    [[NaN, 1, 2, 3, 4, 5, 6]],
    { version: 2, frames: [frame(1), frame(0)] },
    { version: 2, frames: [frame(0, 0, 0, -1)] },
  ])
    assert.equal(normalizeReplay(ghost), null);
  assert.equal(sampleReplay(normalizeReplay([]), 0), null);
});
test("ghost appears only on its timeline and holds the finish briefly", () => {
  const replay = normalizeReplay({
    version: 2,
    frames: [frame(0.1, 10), frame(0.2, 20)],
  });
  assert.equal(sampleReplay(replay, 0), null);
  near(sampleReplay(replay, 0.3).b.x, 20);
  assert.equal(sampleReplay(replay, 0.5), null);
  assert.equal(sampleReplay(replay, NaN), null);
});
test("recorder bounds memory, including repeated retries and forced finish samples", () => {
  const recorder = new ReplayRecorder(),
    s = physics.create();
  for (let i = 0; i < MAX_FRAMES + 50; i++)
    recorder.capture(i / 15, s, { cut: true });
  recorder.capture(10000, s, { force: true });
  assert.equal(recorder.frames.length, MAX_FRAMES);
  assert.ok(normalizeReplay(recorder.toJSON()));
});
