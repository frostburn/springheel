import test from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./helpers/game-harness.js";
import { RECORDS_KEY } from "../src/records.js";

test("render loop actually draws intermediate ghost poses between recorded samples", () => {
  const frames = [
    [0, 100, 200, 0, 100, 296, 0, 0],
    [0.08, 180, 200, 0, 180, 296, 0, 0],
  ];
  const h = createHarness({
    [RECORDS_KEY]: JSON.stringify({
      "first-spring": { time: 10, ghost: { version: 2, frames } },
    }),
  });
  h.frame();
  h.event("keydown", { code: "KeyD" });
  h.frame(16);
  let ghost = h.draws.filter((call) => call.alpha === 0.28 && call.y === 200);
  assert.ok(ghost.length > 0);
  assert.ok(Math.abs(ghost[0].x - 116) < 1e-8);
  h.draws.length = 0;
  h.frame(16);
  ghost = h.draws.filter((call) => call.alpha === 0.28 && call.y === 200);
  assert.ok(Math.abs(ghost[0].x - 132) < 1e-8);
  h.event("keydown", { code: "KeyG" });
  h.draws.length = 0;
  h.frame(16);
  assert.equal(h.draws.filter((call) => call.alpha === 0.28).length, 0);
});

test("standalone app boots, draws a frame, and populates all thirteen choices", () => {
  const h = createHarness();
  h.frame();
  assert.equal(h.nodes.get("course").children.length, 13);
  assert.equal(
    h.nodes.get("course").children.at(-1).textContent,
    "Yard · free practice",
  );
  assert.equal(h.nodes.get("course-number").textContent, "COURSE 01 / 12");
  for (const course of h.app.courses) {
    h.app.load(course.id);
    h.frame();
    assert.equal(h.nodes.get("course-title").textContent, course.name);
  }
});
for (const paused of [false, true])
  for (const exit of ["Map", "V", "canvas", "Pause", "P"])
    test(`overview exit via ${exit}, initially paused=${paused}`, () => {
      const h = createHarness();
      if (paused) h.nodes.get("pause").click();
      h.nodes.get("overview").click();
      h.frame();
      assert.equal(h.nodes.get("curtain").hidden, true);
      assert.equal(h.app.run.overview, true);
      if (exit === "Map") h.nodes.get("overview").click();
      if (exit === "V") h.event("keydown", { code: "KeyV" });
      if (exit === "canvas") h.nodes.get("game").dispatch("pointerdown");
      if (exit === "Pause") h.nodes.get("pause").click();
      if (exit === "P") h.event("keydown", { code: "KeyP" });
      assert.equal(h.app.run.overview, false);
      assert.equal(
        h.app.run.paused,
        paused || exit === "Pause" || exit === "P",
      );
      assert.equal(h.nodes.get("curtain").hidden, !h.app.run.paused);
    });
test("guide and pause freeze the simulation; focus loss clears held rotation", () => {
  const h = createHarness();
  h.frame();
  h.event("keydown", { code: "KeyD" });
  h.frame();
  assert.ok(h.app.run.elapsed > 0);
  h.nodes.get("help").click();
  const time = h.app.run.elapsed;
  h.frame();
  assert.equal(h.app.run.elapsed, time);
  h.nodes.get("close-guide").click();
  h.frame();
  assert.ok(h.app.run.elapsed > time);
  h.event("blur");
  const before = h.app.run.elapsed;
  h.frame();
  assert.equal(h.app.run.elapsed, before);
  assert.equal(h.app.run.paused, true);
});
test("retry records a cut, finishes save v2 ghosts, and new courses follow course seven", () => {
  const h = createHarness();
  h.app.load("home-before-dusk");
  h.frame();
  h.event("keydown", { code: "KeyD" });
  for (let i = 0; i < 10; i++) h.frame();
  h.event("keyup", { code: "KeyD" });
  const elapsed = h.app.run.elapsed;
  h.app.retry();
  assert.equal(h.app.run.elapsed, elapsed);
  for (let i = 0; i < 10; i++) h.frame();
  // Pose injection is only for UI wiring; actual traversals are in physics tests.
  const level = h.app.courses[6];
  h.app.setState(h.app.physics.create(level.goal.x, level.goal.y - 106));
  h.frame();
  assert.equal(h.app.run.finished, true);
  assert.equal(h.nodes.get("resume").textContent, "Next course");
  const record = JSON.parse(h.saved[RECORDS_KEY])["home-before-dusk"];
  assert.equal(record.ghost.version, 2);
  assert.ok(record.ghost.frames.some((frame) => frame[7] > 0));
  assert.equal(record.ghost.frames[0][0], 0);
  h.nodes.get("resume").click();
  assert.equal(h.app.courses[h.app.run.index].id, "tidal-steps");
});
test("last challenge leads to the yard and hanging start still uses the practice rail", () => {
  const h = createHarness();
  h.app.load("last-light");
  h.frame();
  h.event("keydown", { code: "KeyD" });
  h.frame();
  const level = h.app.courses[h.app.run.index];
  h.app.setState(h.app.physics.create(level.goal.x, level.goal.y - 106));
  h.frame();
  assert.equal(h.app.run.finished, true);
  assert.equal(h.nodes.get("resume").textContent, "Visit the yard");
  h.nodes.get("resume").click();
  assert.equal(h.app.courses[h.app.run.index].id, "practice-yard");
  h.app.hangingStart();
  assert.equal(h.app.state.b.x, h.app.courses[7].pegs[0].x - 5);
});
