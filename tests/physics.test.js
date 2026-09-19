import test from "node:test";
import assert from "node:assert/strict";
import { physics as F } from "../src/physics.js";
import { courses } from "../src/courses.js";
const near = (a, b, t = 1e-5) => assert.ok(Math.abs(a - b) < t, `${a} vs ${b}`);
const empty = { solids: [], pegs: [], gravity: 0, airDensity: 0 };
const ground = { solids: [F.box(-2000, 560, 4000, 1000)], pegs: [] };
function run(s, seconds, input, world = empty) {
  for (let i = 0; i < Math.round(seconds / F.DT); i++)
    F.step(s, typeof input === "function" ? input(i * F.DT) : input, world);
  return s;
}
function finite(s) {
  for (const v of [
    s.b.x,
    s.b.y,
    s.b.vx,
    s.b.vy,
    s.b.a,
    s.b.w,
    s.f.x,
    s.f.y,
    s.f.vx,
    s.f.vy,
    s.rotor.w,
  ])
    assert.ok(Number.isFinite(v));
}
test("full-circle aim, spring strokes and gyro conserve linear/angular momentum in free space", () => {
  const s = F.create(40, -200),
    p0 = F.momentum(s),
    c0 = F.com(s);
  run(s, 20, (t) => ({
    aim: t * 1.3,
    gyro: Math.sin(t * 1.8),
    brake: t % 3 > 2.6,
    kick: t % 1 < 0.35,
    tuck: t % 1 > 0.7,
  }));
  finite(s);
  const p = F.momentum(s),
    c = F.com(s);
  near(p.x, p0.x);
  near(p.y, p0.y);
  near(p.angular, p0.angular, 0.001);
  near(c.x, c0.x);
  near(c.y, c0.y);
});
test("uniform gravity gives a ballistic COM despite aiming, tucking and gyro input", () => {
  const s = F.create(120, 200);
  s.b.vx = s.f.vx = 145;
  s.b.vy = s.f.vy = -170;
  const c = F.com(s),
    n = 720,
    t = n * F.DT;
  run(
    s,
    t,
    (u) => ({
      aim: u * 5,
      kick: u % 1 < 0.4,
      tuck: u % 1 > 0.6,
      gyro: Math.sin(u * 3),
    }),
    { ...empty, gravity: F.P.gravity },
  );
  const d = F.com(s);
  near(d.x, c.x + c.vx * t, 1e-6);
  near(d.y, c.y + c.vy * t + 0.5 * F.P.gravity * (t * t + t * F.DT), 1e-5);
  near(d.vy, c.vy + F.P.gravity * t, 1e-7);
});
test("gyro saturation and relative brake do not delete angular momentum", () => {
  const s = F.create(0, 0);
  s.rotor.w = F.P.rotorLimit - 0.1;
  const initial = F.momentum(s).angular;
  run(s, 8, { aim: Math.PI / 2, gyro: -1 });
  const r = F.reserve(s);
  assert.ok(r.a < 0.01);
  assert.ok(r.d > 0.99);
  near(F.momentum(s).angular, initial, 0.001);
  const before = F.momentum(s).angular;
  run(s, 4, { aim: Math.PI / 2, brake: true });
  near(F.momentum(s).angular, before, 0.001);
  assert.ok(Math.abs(s.rotor.w - s.b.w) < 0.02);
});
test("stays supported with chassis air drag and has a repeatable physical hop", () => {
  const s = F.create(180, 454);
  run(s, 2, { aim: Math.PI / 2 }, ground);
  finite(s);
  assert.ok(Math.abs(s.b.y - 458.5) < 3);
  const y = s.b.y;
  let high = y;
  for (let i = 0; i < 240; i++) {
    F.step(s, { aim: Math.PI / 2, kick: i < 50 }, ground);
    high = Math.min(high, s.b.y);
  }
  assert.ok(y - high > 90, `hop height ${y - high}`);
  assert.ok(y - high < 350, `hop height ${y - high}`);
});
test("right-click tuck takes priority over extension", () => {
  const s = F.create();
  run(s, 0.4, { aim: Math.PI / 2, kick: true, tuck: true });
  near(s.rest, F.P.tuck);
});
test("the central leg has no direct radial torque", () => {
  const s = F.create();
  run(s, 0.8, { aim: Math.PI / 2, kick: true });
  near(s.b.w, 0, 1e-8);
  near(s.rotor.w, 0, 1e-8);
});
test("aiming the massive foot gives equal and opposite chassis reaction", () => {
  const s = F.create();
  run(s, 0.25, { aim: 0 });
  assert.ok(Math.abs(s.b.w) > 0.2);
  near(F.momentum(s).angular, 0, 0.001);
});
test("hook and rod have collision geometry, not only artwork", () => {
  const s = F.create(0, 0);
  const hook = F.contactList(s, {
    solids: [],
    pegs: [{ x: 47, y: -42, r: 5 }],
  });
  assert.ok(hook.some((c) => c.hookPart));
  const rod = F.contactList(s, { solids: [F.box(-10, 48, 20, 4)], pegs: [] });
  assert.ok(rod.some((c) => c.type === "leg"));
});
test("long mixed-input contact simulation remains finite", () => {
  const s = F.create(180, 454);
  run(
    s,
    40,
    (t) => ({
      aim: Math.PI / 2 + Math.sin(t * 0.8) * 1.2,
      gyro: Math.sin(t * 2),
      kick: t % 1.7 < 0.3,
      tuck: t % 1.7 > 1.4,
    }),
    ground,
  );
  finite(s);
});
test("collision normals point outside a convex platform", () => {
  const p = F.box(0, 0, 100, 100);
  const top = F.circlePoly(50, -5, 10, p);
  near(top.ny, -1);
  near(top.depth, 5);
  const inside = F.circlePoly(50, 4, 10, p);
  near(inside.ny, -1);
  near(inside.depth, 14);
  assert.equal(F.circlePoly(150, 150, 5, p), null);
});

test("the hook supports the whole machine on a brass rail without a grab joint", () => {
  const s = F.create(-5, 36);
  const world = { solids: [], pegs: [{ x: 0, y: 0, r: 9 }] };
  run(s, 6, { aim: Math.PI / 2 }, world);
  finite(s);
  assert.ok(s.hookContacts > 0);
  assert.ok(s.b.y > 35 && s.b.y < 65);
  assert.ok(Math.abs(s.b.x) < 15);
  assert.ok(s.f.y > 130);
});
test("a real protruding ledge carries a hanging machine", () => {
  const world = {
    solids: [F.box(0, 0, 500, 1000), F.box(-65, -8, 80, 8, "brass")],
    pegs: [{ x: -65, y: -4, r: 8 }],
  };
  const s = F.create(-70, 32);
  run(s, 6, { aim: Math.PI / 2 }, world);
  finite(s);
  assert.ok(s.hookContacts > 0);
  assert.ok(s.b.x < -30);
  assert.ok(s.b.y > 15 && s.b.y < 65);
  assert.ok(Math.hypot(s.b.vx, s.b.vy) < 8);
});
test("turning the hook can physically release a rail", () => {
  const s = F.create(-5, 36),
    world = { solids: [], pegs: [{ x: 0, y: 0, r: 9 }] };
  run(s, 2, { aim: Math.PI / 2 }, world);
  run(s, 4, { aim: Math.PI / 2, gyro: -1 }, world);
  assert.ok(s.b.y > 200, `height after release ${s.b.y}`);
});

test("a moving, initially separate machine can thread and catch the rail", () => {
  const s = F.create(-70, 0),
    world = { solids: [], pegs: [{ x: 0, y: 0, r: 9 }] };
  s.b.vx = s.f.vx = 120;
  s.b.vy = s.f.vy = -120;
  assert.equal(F.contactList(s, world).length, 0);
  run(s, 6, { aim: Math.PI / 2 }, world);
  assert.ok(s.hookContacts > 0);
  assert.ok(s.b.y > 0 && s.b.y < 100);
});
test("holding a turn key converges to a rate, with no direct velocity clamp", () => {
  const s = F.create();
  run(s, 3, { aim: Math.PI / 2, gyro: -1 });
  near(s.b.w, -F.P.turnRate, 0.001);
  near(F.momentum(s).angular, 0, 0.001);
  const w = s.b.w;
  run(s, 1, { aim: Math.PI / 2 });
  near(s.b.w, w, 0.001);
});

test("air drag slows either spin direction without braking the internal rotor or COM", () => {
  for (const spin of [-20, 20]) {
    const s = F.create();
    s.b.w = spin;
    s.rotor.w = 30;
    s.b.vx = s.f.vx = 120;
    const before = F.momentum(s);
    run(s, 2, { aim: Math.PI / 2 }, { ...empty, airDensity: 1 });
    assert.equal(Math.sign(s.b.w), Math.sign(spin));
    assert.ok(Math.abs(s.b.w) < 1);
    near(s.rotor.w, 30);
    near(F.com(s).vx, 120);
    near(F.momentum(s).y, before.y);
    near(
      F.momentum(s).angular - before.angular,
      F.P.bodyI * (s.b.w - spin),
      0.001,
    );
  }
});
test("drag resists sustained aiming recoil and still permits deliberate gyro turns", () => {
  const vacuum = F.create(),
    air = F.create();
  run(vacuum, 5, (t) => ({ aim: Math.PI / 2 + t * 4 }));
  run(air, 5, (t) => ({ aim: Math.PI / 2 + t * 4 }), {
    ...empty,
    airDensity: 1,
  });
  assert.ok(Math.abs(air.b.w) < Math.abs(vacuum.b.w) * 0.4);
  for (const gyro of [-1, 1]) {
    const s = F.create();
    run(s, 2, { aim: Math.PI / 2, gyro }, { ...empty, airDensity: 1 });
    assert.ok(s.b.w * gyro > 4 && s.b.w * gyro <= F.P.turnRate);
  }
});
test("drag-only decay is stable and independent of substep size", () => {
  for (const spin of [-1000, -5, 5, 1000]) {
    const results = [];
    for (const dt of [1 / 120, 1 / 240, 1 / 480]) {
      const s = F.create();
      s.b.w = spin;
      for (let i = 0; i < Math.round(1 / dt); i++)
        F.step(s, { aim: Math.PI / 2 }, { ...empty, airDensity: 1 }, dt);
      assert.equal(Math.sign(s.b.w), Math.sign(spin));
      results.push(s.b.w);
    }
    near(results[0], results[1], 1e-8);
    near(results[1], results[2], 1e-8);
  }
});

// Exercise actual authored terrain as well as isolated physics. This controller
// only supplies ordinary mouse-aim/stroke inputs, with no gyro or state edits.

for (const index of [0, 2, 4, 6, 8, 9, 10, 11, 12])
  test(`${courses[index].name}: repeated physical strokes can reach the exit`, () => {
    const level = courses[index],
      s = F.create(...level.start);
    let reached = false;
    for (let i = 0; i < 240 * 35; i++) {
      // The orchard rewards shorter, more upright hops between narrow plinths.
      const phase = (i / 240) % (index === 11 ? 0.8 : 1.1);
      F.step(
        s,
        index === 11
          ? { aim: 2.1, kick: phase > 0.2 && phase < 0.4, tuck: phase > 0.64 }
          : {
              aim: 2.08,
              kick: phase > 0.28 && phase < 0.55,
              tuck: phase > 0.92,
            },
        level,
      );
      if (
        Math.abs(s.b.x - level.goal.x) < 45 &&
        s.b.y < level.goal.y + 10 &&
        s.b.y > level.goal.y - 175
      ) {
        reached = true;
        break;
      }
    }
    assert.ok(reached, `${level.name}: stopped at ${s.b.x}, ${s.b.y}`);
  });
