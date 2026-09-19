import { physics as F } from "./physics.js";
import { courses, timedCourses, practiceIndex } from "./courses.js";
import { nextCourseIndex, checkpointSpawn } from "./course.js";
import { createRenderer } from "./renderer.js";
import { ReplayRecorder, sampleReplay } from "./replay.js";
import { createRecords } from "./records.js";
import { createSoundPlayer } from "./audio.js";
import { version } from "./version.js";

const el = (id) => document.getElementById(id),
  canvas = el("game"),
  wheel = el("wheel");
const renderer = createRenderer(canvas, wheel);
let state,
  level,
  index = 0,
  checkpoint = -1,
  elapsed = 0,
  finished = false,
  paused = false,
  overview = false,
  showArc = false,
  showGhost = true,
  muted = true;
let view = { x: 0, y: 0, scale: 1 },
  W = 1000,
  H = 700,
  dpr = 1,
  accumulator = 0,
  last = 0,
  uiTick = 0,
  toastUntil = 0,
  started = false,
  ghost = null,
  recorder = new ReplayRecorder(),
  saveWarning = false;
const keys = new Set(),
  touchKeys = new Set(),
  mouse = { x: 0, y: 0, known: false, buttons: 0 },
  touchActions = new Set();
let aim = Math.PI / 2,
  initialAim = true,
  lastSound = 0;
const sound = createSoundPlayer(() => muted);
let storage = null;
try {
  storage = window.localStorage;
} catch {}
const records = createRecords(storage, courses);
function bestFor(i) {
  return records.best(courses[i].id);
}
const time = (t) => {
  const c = Math.floor(t * 100 + 1e-6);
  return `${Math.floor(c / 6000)}:${String(Math.floor(c / 100) % 60).padStart(2, "0")}.${String(c % 100).padStart(2, "0")}`;
};
function toast(text, seconds = 3) {
  el("status").textContent = text;
  toastUntil = performance.now() + seconds * 1000;
  el("status").classList.add("show");
}
function clearInput() {
  keys.clear();
  touchKeys.clear();
  touchActions.clear();
  mouse.buttons = 0;
  document
    .querySelectorAll("#touch .active")
    .forEach((b) => b.classList.remove("active"));
}
function resize() {
  const r = canvas.getBoundingClientRect();
  W = r.width;
  H = r.height;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}
window.addEventListener("resize", resize);
resize();
function load(i) {
  if (typeof i === "string") i = courses.findIndex((course) => course.id === i);
  if (!Number.isInteger(i))
    throw new TypeError("Expected a course index or id");
  index = F.clamp(i, 0, courses.length - 1);
  level = courses[index];
  state = F.create(...level.start);
  checkpoint = -1;
  elapsed = 0;
  finished = false;
  paused = false;
  overview = false;
  started = false;
  aim = Math.PI / 2;
  initialAim = true;
  mouse.known = false;
  recorder = new ReplayRecorder();
  saveWarning = false;
  accumulator = 0;
  clearInput();
  const b = bestFor(index);
  ghost = b?.ghost ?? null;
  el("course").value = String(index);
  el("course-number").textContent = !level.goal
    ? "THE WORKSHOP · FREE PRACTICE"
    : `COURSE ${String(timedCourses.indexOf(level) + 1).padStart(2, "0")} / ${timedCourses.length}`;
  el("course-title").textContent = level.name;
  el("course-hint").textContent = level.hint;
  el("best").textContent = b ? "BEST " + time(b.time) : "BEST —";
  el("checkpoint").textContent = "START · unlimited retries";
  view.scale = baseScale();
  view.x = state.b.x - (W / view.scale) * 0.3;
  view.y = state.b.y - (H / view.scale) * 0.56;
  setCurtain();
  toast("Point below the axle. Left mouse extends the spring.", 5);
}
// Keep the yard last in the menu without changing the original console indices.
for (const course of [...timedCourses, courses[practiceIndex]]) {
  const i = courses.indexOf(course);
  const o = document.createElement("option");
  o.value = i;
  o.textContent = !course.goal
    ? "Yard · free practice"
    : `${String(timedCourses.indexOf(course) + 1).padStart(2, "0")} · ${course.name}`;
  el("course").append(o);
}
el("course").addEventListener("change", (e) => {
  load(Number(e.target.value));
  canvas.focus();
});
function reset(all = false) {
  if (all || finished) {
    load(index);
    return;
  }
  // Store the old side of a retry when valid, then mark an instantaneous cut.
  if (
    started &&
    [
      state.b.x,
      state.b.y,
      state.b.a,
      state.f.x,
      state.f.y,
      state.rotor.a,
    ].every(Number.isFinite)
  )
    recorder.capture(elapsed, state, { force: true });
  state = F.create(...checkpointSpawn(level, checkpoint));
  if (started) recorder.capture(elapsed, state, { cut: true });
  accumulator = 0;
  aim = Math.PI / 2;
  initialAim = true;
  mouse.known = false;
  clearInput();
  toast(
    checkpoint >= 0
      ? "Back at your pennant. Nothing lost."
      : "Back on your feet.",
  );
  sound("retry");
}
function controls() {
  if (mouse.known && !overview) {
    const x = view.x + mouse.x / view.scale - state.b.x,
      y = view.y + mouse.y / view.scale - state.b.y;
    if (Math.hypot(x, y) > 18) {
      aim = Math.atan2(y, x);
      initialAim = false;
    }
  }
  const down = (k) => keys.has(k) || touchKeys.has(k);
  return {
    aim,
    kick: !!(mouse.buttons & 1) || touchActions.has("kick"),
    tuck: !!(mouse.buttons & 2) || touchActions.has("tuck"),
    gyro: (down("KeyD") ? 1 : 0) - (down("KeyA") ? 1 : 0),
    brake: down("KeyS"),
  };
}
function active() {
  return !paused && !overview && !finished && !el("manual").open;
}
function step() {
  const input = controls();
  const wasStarted = started;
  if (
    input.kick ||
    input.tuck ||
    input.gyro ||
    input.brake ||
    (!initialAim && Math.abs(F.wrap(aim - Math.PI / 2)) > 0.1)
  )
    started = true;
  if (started && !wasStarted) recorder.capture(0, state, { force: true });
  F.step(state, input, level);
  if (started) elapsed += F.DT;
  if (state.impact > 220 && performance.now() - lastSound > 140) {
    sound("land", Math.min(1, state.impact / 600));
    lastSound = performance.now();
  }
  if (
    ![
      state.b.x,
      state.b.y,
      state.f.x,
      state.f.y,
      state.b.a,
      state.b.w,
      state.rotor.w,
    ].every(Number.isFinite)
  ) {
    reset();
    toast("The mechanism slipped. Reset to your checkpoint.");
    return;
  }
  if (
    state.b.y > level.bottom ||
    state.b.x < -600 ||
    state.b.x > level.width + 400
  ) {
    reset();
    return;
  }
  for (let i = checkpoint + 1; i < level.checks.length; i++) {
    const p = level.checks[i];
    if (
      Math.abs(state.b.x - p.x) < 66 &&
      state.b.y < p.y + 20 &&
      state.b.y > p.y - 180
    ) {
      checkpoint = i;
      el("checkpoint").textContent =
        `PENNANT ${i + 1} / ${level.checks.length} · R to retry`;
      toast("Pennant saved. Your next foothold is ahead.");
      sound("check");
    }
  }
  if (started) recorder.capture(elapsed, state);
  if (level.goal) {
    const p = level.goal;
    if (
      Math.abs(state.b.x - p.x) < 45 &&
      state.b.y < p.y + 10 &&
      state.b.y > p.y - 175
    )
      finish();
  }
}
function finish() {
  finished = true;
  clearInput();
  sound("finish");
  const old = bestFor(index),
    isBest = !old || elapsed < old.time;
  if (isBest && started) {
    recorder.capture(elapsed, state, { force: true });
    const saved = records.save(level.id, elapsed, recorder.toJSON());
    saveWarning = !saved.persisted;
    el("best").textContent = "BEST " + time(elapsed);
  }
  setCurtain();
  el("curtain-title").textContent = "A good landing.";
  el("curtain-text").textContent =
    `${level.name} in ${time(elapsed)}.${isBest ? " A new personal best." : ""}${saveWarning ? " Storage is full or blocked; this best is available for this session only." : ""}`;
  el("resume").textContent = courses[nextCourseIndex(courses, index)].goal
    ? "Next course"
    : "Visit the yard";
}
function setCurtain() {
  el("curtain").hidden = overview || (!paused && !finished);
  el("pause").setAttribute("aria-pressed", String(paused));
  el("pause").textContent = overview ? "Pause" : paused ? "Resume" : "Pause";
  el("overview").setAttribute("aria-pressed", String(overview));
  if (!finished) {
    el("curtain-title").textContent = "Take a breather.";
    el("curtain-text").textContent =
      "The spring, the clock, and the hillside can wait.";
    el("resume").textContent = "Keep going";
  }
}
function togglePause() {
  if (finished) return;
  if (overview) {
    overview = false;
    paused = true;
  } else paused = !paused;
  clearInput();
  accumulator = 0;
  setCurtain();
}
function toggleMap() {
  if (finished) return;
  overview = !overview;
  clearInput();
  accumulator = 0;
  setCurtain();
  toast(
    overview
      ? "COURSE OVERVIEW · paused · V or click the map to return"
      : paused
        ? "Still paused. Resume when ready."
        : "Back to the next foothold.",
  );
}
function help() {
  clearInput();
  if (!el("manual").open) el("manual").showModal();
}
el("close-guide").onclick = () => el("manual").close();
el("manual").addEventListener("close", () => {
  clearInput();
  accumulator = 0;
  canvas.focus();
});
function hangingStart() {
  el("manual").close();
  load(practiceIndex);
  const p = level.pegs[0];
  state = F.create(p.x - 5, p.y + 36);
  toast("Already threaded. Hold A to peel out, or use the leg to push off.", 6);
  canvas.focus();
}
el("hanging-start").onclick = hangingStart;
el("retry").onclick = (e) => {
  reset(e.shiftKey);
  canvas.focus();
};
el("pause").onclick = togglePause;
el("overview").onclick = toggleMap;
el("help").onclick = help;
el("resume").onclick = () => {
  if (finished) load(nextCourseIndex(courses, index));
  else togglePause();
  canvas.focus();
};
function restartRun() {
  reset(true);
  canvas.focus();
}
el("restart").onclick = restartRun;
el("restart-run").onclick = restartRun;
function toggleSound() {
  muted = !muted;
  el("sound").textContent = muted ? "Sound off" : "Sound on";
  el("sound").setAttribute("aria-pressed", String(!muted));
  if (!muted) sound("check");
}
el("sound").onclick = toggleSound;
function pointer(e) {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
  mouse.known = true;
}
canvas.addEventListener("pointermove", (e) => {
  pointer(e);
  if (e.pointerType !== "touch") mouse.buttons = e.buttons;
});
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (overview) {
    toggleMap();
    return;
  }
  if (!active()) return;
  canvas.focus();
  pointer(e);
  if (e.pointerType !== "touch") mouse.buttons = e.buttons;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}
});
canvas.addEventListener("pointerup", (e) => {
  if (e.pointerType !== "touch") mouse.buttons = e.buttons;
});
canvas.addEventListener("pointercancel", () => {
  mouse.buttons = 0;
});
canvas.addEventListener("lostpointercapture", () => {
  mouse.buttons = 0;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("pointerup", (e) => {
  if (e.pointerType !== "touch") mouse.buttons = e.buttons;
});
for (const b of document.querySelectorAll("#touch button")) {
  const change = (on) => {
    if (b.dataset.key) {
      if (on) touchKeys.add(b.dataset.key);
      else touchKeys.delete(b.dataset.key);
    } else {
      if (on) touchActions.add(b.dataset.action);
      else touchActions.delete(b.dataset.action);
    }
    b.classList.toggle("active", on);
  };
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (active()) {
      change(true);
      b.setPointerCapture(e.pointerId);
    }
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    b.addEventListener(type, () => change(false));
}
window.addEventListener("keydown", (e) => {
  if (el("manual").open) return;
  if (e.target instanceof HTMLSelectElement) return;
  if (
    [
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyR",
      "KeyV",
      "KeyI",
      "KeyG",
      "KeyH",
      "KeyM",
      "KeyP",
      "Escape",
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.repeat) return;
  if (e.code === "KeyR") {
    if (e.shiftKey) restartRun();
    else reset();
  } else if (e.code === "KeyV") toggleMap();
  else if (e.code === "KeyH") help();
  else if (e.code === "KeyM") toggleSound();
  else if (e.code === "KeyP" || e.code === "Escape") togglePause();
  else if (e.code === "KeyI") {
    showArc = !showArc;
    toast(
      showArc
        ? "Dotted arc: centre of mass, free flight only."
        : "Flight guide off.",
    );
  } else if (e.code === "KeyG") {
    showGhost = !showGhost;
    toast(
      showGhost
        ? ghost?.frames.length
          ? "Best-run ghost on."
          : "Ghost on. Finish a course to record one."
        : "Ghost off.",
    );
  } else if (active()) keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
function suspend() {
  clearInput();
  if (!finished && !paused) {
    paused = true;
    setCurtain();
  }
  accumulator = 0;
}
window.addEventListener("blur", suspend);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspend();
});
function baseScale() {
  return F.clamp(Math.min(W / 1050, H / 690), 0.62, 1.22);
}
function updateView(dt) {
  let scale = baseScale(),
    x,
    y;
  if (overview) {
    scale = Math.min(
      (W - 90) / (level.width + 250),
      (H - 200) / (level.bottom - level.top),
    );
    scale = Math.max(0.1, scale);
    x = -100 - (W / scale - (level.width + 250)) / 2;
    y = level.top - 120 / scale;
  } else {
    x = state.b.x - (W / scale) * 0.35 + F.clamp(state.b.vx * 0.15, -80, 100);
    y = state.b.y - (H / scale) * 0.53;
  }
  const a = 1 - Math.exp(-dt * (overview ? 9 : 5));
  view.scale += (scale - view.scale) * a;
  view.x += (x - view.x) * a;
  view.y += (y - view.y) * a;
}
function updateHUD() {
  const r = F.reserve(state);
  el("clock").textContent = time(elapsed);
  el("reserve-a").textContent = Math.round(r.a * 100) + "%";
  el("reserve-d").textContent = Math.round(r.d * 100) + "%";
  el("fill-a").style.transform = `scaleX(${r.a})`;
  el("fill-d").style.transform = `scaleX(${r.d})`;
  el("spin").textContent = `${r.rel >= 0 ? "+" : ""}${r.rel.toFixed(1)} rad/s`;
  el("leg-state").textContent =
    state.rest > 120
      ? "LEG · EXTEND"
      : state.rest < 75
        ? "LEG · TUCK"
        : "LEG · REST";
  if (performance.now() > toastUntil) el("status").classList.remove("show");
}
function frame(now) {
  const delta = last ? Math.min((now - last) / 1000, 0.06) : 0;
  last = now;
  if (active()) {
    accumulator += delta;
    let n = 0;
    while (accumulator >= F.DT && n++ < 16) {
      step();
      accumulator -= F.DT;
      if (finished) break;
    }
  } else accumulator = 0;
  updateView(delta);
  renderer.render({
    state,
    level,
    checkpoint,
    view,
    W,
    H,
    dpr,
    overview,
    finished,
    showArc,
    aim,
    ghostPose:
      showGhost && started
        ? sampleReplay(
            ghost,
            elapsed + (active() ? Math.max(0, accumulator) : 0),
          )
        : null,
  });
  if (now - uiTick > 70) {
    updateHUD();
    uiTick = now;
  }
  requestAnimationFrame(frame);
}
load(0);
requestAnimationFrame(frame);
// Deliberately discoverable lab tools. No network or hidden gameplay effects.
window.springheel = Object.freeze({
  version,
  physics: F,
  courses,
  get state() {
    return state;
  },
  get run() {
    return { index, checkpoint, elapsed, paused, overview, finished, started };
  },
  load,
  hangingStart,
  retry: reset,
  inspect: () => ({
    momentum: F.momentum(state),
    centreOfMass: F.com(state),
    reserve: F.reserve(state),
  }),
  snapshot: () => JSON.parse(JSON.stringify(state)),
  setState: (s) => {
    if (!s || !s.b || !s.f || !s.rotor)
      throw new TypeError("Expected a physics snapshot");
    state = JSON.parse(JSON.stringify(s));
  },
});
console.info(
  "Springheel workshop: springheel.inspect(), springheel.physics, springheel.load(7). No secret air thrusters.",
);
