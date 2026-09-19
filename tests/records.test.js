import test from "node:test";
import assert from "node:assert/strict";
import { createRecords, RECORDS_KEY, LEGACY_KEY } from "../src/records.js";
import { courses } from "../src/courses.js";
const ghost = [
  [0, 0, 0, 0, 0, 96, 0],
  [0.1, 10, 0, 0, 10, 96, 0],
];
function memory(values = {}) {
  return {
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
  };
}
test("legacy times and ghosts migrate by stable identity without touching the old save", () => {
  const old = JSON.stringify({
    0: { time: 10, ghost },
    6: { time: 20, ghost },
  });
  const storage = memory({ [LEGACY_KEY]: old });
  const records = createRecords(storage, courses);
  assert.equal(records.best("first-spring").time, 10);
  assert.equal(records.best("home-before-dusk").time, 20);
  assert.equal(records.best("tidal-steps"), null);
  assert.equal(
    records.save("tidal-steps", 9, { version: 2, frames: [] }).persisted,
    true,
  );
  const reloaded = createRecords(storage, [...courses].reverse());
  assert.equal(reloaded.best("first-spring").ghost.version, 1);
  assert.equal(reloaded.best("tidal-steps").time, 9);
  assert.equal(storage.getItem(LEGACY_KEY), old);
});
test("corrupt replay does not discard a valid personal best", () => {
  const records = createRecords(
    memory({
      [RECORDS_KEY]: JSON.stringify({
        "first-spring": { time: 9, ghost: "broken" },
      }),
    }),
    courses,
  );
  assert.deepEqual(records.best("first-spring"), { time: 9, ghost: null });
  assert.equal(records.save("first-spring", 11, null).isBest, false);
});
test("blocked and full storage still keep new records for the session", () => {
  for (const storage of [
    null,
    {
      getItem() {
        throw Error("denied");
      },
      setItem() {
        throw Error("quota");
      },
    },
  ]) {
    const records = createRecords(storage, courses);
    assert.deepEqual(records.save("first-spring", 10, null), {
      isBest: true,
      persisted: false,
    });
    assert.equal(records.best("first-spring").time, 10);
    assert.equal(records.save("first-spring", 12, null).isBest, false);
  }
});
test("bad JSON and invalid times cannot poison records", () => {
  for (const value of [
    "{",
    JSON.stringify({ "first-spring": { time: -1 } }),
    "null",
  ])
    assert.equal(
      createRecords(memory({ [RECORDS_KEY]: value }), courses).best(
        "first-spring",
      ),
      null,
    );
});
