import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildHTML } from "../scripts/build.mjs";
import { version } from "../src/version.js";
import { physics } from "../src/physics.js";
import { createHarness } from "./helpers/game-harness.js";

test("release is deterministic, current, offline, and versioned consistently", async () => {
  const html = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  assert.equal(html, await buildHTML());
  assert.ok(!/<script[^>]+src=|<link[^>]+stylesheet/.test(html));
  assert.ok(!/(?:src|href)=["']https?:/.test(html));
  assert.equal(
    version,
    JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ).version,
  );
  assert.equal(createHarness().app.version, version);
});
test("bundled physics matches the source solver", () => {
  const release = createHarness().app.physics,
    a = physics.create(),
    b = release.create();
  for (let i = 0; i < 1000; i++) {
    const input = { aim: i / 100, kick: i % 100 < 30, gyro: Math.sin(i / 30) };
    const world = { solids: [], pegs: [] };
    physics.step(a, input, world);
    release.step(b, input, world);
  }
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
