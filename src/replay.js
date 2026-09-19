// Frames: [seconds, bodyX, bodyY, bodyAngle, footX, footY, rotorAngle, segment].
// v2 angles are UNWRAPPED; a fast flywheel may turn >pi between stored frames.
export const REPLAY_VERSION = 2;
export const MAX_FRAMES = 9000;
const INTERVAL = 1 / 15;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const mix = (a, b, t) => a + (b - a) * t;

/** Validate at the storage boundary, never in the render loop. */
export function normalizeReplay(value) {
  const legacy = Array.isArray(value);
  const frames = legacy ? value : value?.frames;
  if (!legacy && value?.version !== REPLAY_VERSION) return null;
  if (!Array.isArray(frames) || frames.length > MAX_FRAMES) return null;
  let previous = -1,
    segment = -1;
  for (const frame of frames) {
    if (
      !Array.isArray(frame) ||
      frame.length !== (legacy ? 7 : 8) ||
      !frame.every(Number.isFinite) ||
      frame[0] < 0 ||
      frame[0] < previous
    )
      return null;
    if (
      !legacy &&
      (!Number.isInteger(frame[7]) || frame[7] < 0 || frame[7] < segment)
    )
      return null;
    previous = frame[0];
    segment = frame[7];
  }
  return { version: legacy ? 1 : REPLAY_VERSION, frames };
}

/** Binary search + linear pose interpolation, without mutating saved frames. */
export function sampleReplay(replay, time) {
  const frames = replay?.frames;
  if (
    !frames?.length ||
    !Number.isFinite(time) ||
    time < frames[0][0] ||
    time > frames[frames.length - 1][0] + 0.2
  )
    return null;
  let lo = 0,
    hi = frames.length - 1;
  // Choose the LAST equal timestamp, so an instantaneous retry switches on time.
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid][0] <= time) lo = mid;
    else hi = mid - 1;
  }
  const a = frames[lo],
    b = frames[lo + 1];
  let t = b ? Math.min(1, (time - a[0]) / (b[0] - a[0])) : 0;
  if (
    b &&
    (b[0] - a[0] > 0.25 ||
      (replay.version === 2 && a[7] !== b[7]) ||
      (replay.version === 1 && Math.hypot(b[1] - a[1], b[2] - a[2]) > 120))
  )
    t = 0;
  const position = (i) => (b ? mix(a[i], b[i], t) : a[i]);
  const angle = (i) =>
    b
      ? a[i] + (replay.version === 1 ? wrap(b[i] - a[i]) : b[i] - a[i]) * t
      : a[i];
  return {
    b: { x: position(1), y: position(2), a: angle(3) },
    f: { x: position(4), y: position(5) },
    rotor: { a: angle(6) },
  };
}

export class ReplayRecorder {
  frames = [];
  segment = 0;
  nextAt = 0;
  previous = null;
  angles = [0, 0];

  /** Observe every physics step, even though only 15 poses/second are stored. */
  capture(time, state, { cut = false, force = false } = {}) {
    const current = [state.b.a, state.rotor.a];
    if (cut) this.segment++;
    for (let i = 0; i < 2; i++)
      this.angles[i] =
        !this.previous || cut
          ? current[i]
          : this.angles[i] + wrap(current[i] - this.previous[i]);
    this.previous = current;
    if (
      this.frames.length >= MAX_FRAMES ||
      (!cut && !force && time + 1e-9 < this.nextAt)
    )
      return;
    this.frames.push([
      time,
      state.b.x,
      state.b.y,
      this.angles[0],
      state.f.x,
      state.f.y,
      this.angles[1],
      this.segment,
    ]);
    this.nextAt = time + INTERVAL;
  }

  toJSON() {
    return { version: REPLAY_VERSION, frames: this.frames };
  }
}
