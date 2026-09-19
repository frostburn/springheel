/* Springheel physics. Pixels are consistent simulation units, not metres.
   The body COM is the axle (the lower counterweight balances the hook).
   The foot has mass; the telescoping rod is massless. The rotor has its own
   ABSOLUTE angular velocity. Air drag acts on the exposed chassis only. */
"use strict";
export const physics = (() => {
  const DT = 1 / 240;
  const P = Object.freeze({
    bodyMass: 7,
    footMass: 1,
    bodyI: 9500,
    rotorI: 7500,
    gravity: 950,
    springK: 1500,
    springD: 64,
    springMax: 80000,
    aimK: 2400000,
    aimD: 85000,
    aimMax: 1200000,
    gyroTorque: 400000,
    rotorLimit: 80,
    brake: 35000,
    turnRate: 5,
    turnGain: 14,
    airLinear: 0.9,
    airQuadratic: 0.25,
    rest: 96,
    tuck: 45,
    extend: 174,
  });
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const hook = [
    [-16, 12],
    [-29, -12],
    [-31, -38],
    [-18, -63],
    [7, -73],
    [32, -64],
    [47, -48],
    [47, -35],
  ];
  const hull = [
    { x: 0, y: 0, r: 20 },
    { x: 2, y: 16, r: 12 },
  ];
  for (let k = 1; k < hook.length; k++) {
    const a = hook[k - 1],
      b = hook[k],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7);
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      hull.push({
        x: a[0] + (b[0] - a[0]) * t,
        y: a[1] + (b[1] - a[1]) * t,
        r: 6,
      });
    }
  }
  function create(x = 180, y = 410) {
    return {
      b: { x, y, vx: 0, vy: 0, a: 0, w: 0 },
      f: { x, y: y + P.rest, vx: 0, vy: 0 },
      rotor: { a: 0, w: 0 },
      rest: P.rest,
      time: 0,
      contacts: 0,
      hookContacts: 0,
      impact: 0,
    };
  }
  function polygon(points, kind = "stone") {
    return {
      points,
      kind,
      minX: Math.min(...points.map((p) => p[0])),
      maxX: Math.max(...points.map((p) => p[0])),
      minY: Math.min(...points.map((p) => p[1])),
      maxY: Math.max(...points.map((p) => p[1])),
    };
  }
  const box = (x, y, w, h, kind = "stone") =>
    polygon(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      kind,
    );
  function circlePoly(x, y, r, p) {
    if (x + r < p.minX || x - r > p.maxX || y + r < p.minY || y - r > p.maxY)
      return null;
    let best = Infinity,
      qx = 0,
      qy = 0,
      enx = 0,
      eny = -1,
      inside = false;
    for (let i = 0, j = p.points.length - 1; i < p.points.length; j = i++) {
      const a = p.points[j],
        b = p.points[i],
        ex = b[0] - a[0],
        ey = b[1] - a[1],
        ll = ex * ex + ey * ey;
      const t = clamp(((x - a[0]) * ex + (y - a[1]) * ey) / (ll || 1), 0, 1),
        cx = a[0] + ex * t,
        cy = a[1] + ey * t,
        d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < best) {
        best = d;
        qx = cx;
        qy = cy;
        const l = Math.sqrt(ll) || 1;
        enx = ey / l;
        eny = -ex / l;
      }
      if (
        a[1] > y !== b[1] > y &&
        x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
      )
        inside = !inside;
    }
    const d = Math.sqrt(best);
    if (!inside && d >= r) return null;
    const nx = d > 1e-8 ? ((inside ? -1 : 1) * (x - qx)) / d : enx,
      ny = d > 1e-8 ? ((inside ? -1 : 1) * (y - qy)) / d : eny;
    return {
      nx,
      ny,
      depth: inside ? r + d : r - d,
      x: x - nx * r,
      y: y - ny * r,
    };
  }
  function contactList(s, world) {
    const result = [],
      b = s.b,
      f = s.f,
      c = Math.cos(b.a),
      sn = Math.sin(b.a);
    function sample(x, y, r, type, t = 0, hookPart = false) {
      for (const p of world.solids) {
        const q = circlePoly(x, y, r, p);
        if (q)
          result.push({
            ...q,
            type,
            t,
            hookPart,
            n: 0,
            jt: 0,
            mu: type === "foot" ? 1.25 : 0.82,
          });
      }
      for (const p of world.pegs || []) {
        const dx = x - p.x,
          dy = y - p.y,
          d = Math.hypot(dx, dy),
          depth = r + p.r - d;
        if (depth > 0) {
          const nx = d > 1e-8 ? dx / d : 0,
            ny = d > 1e-8 ? dy / d : -1;
          result.push({
            x: x - nx * r,
            y: y - ny * r,
            nx,
            ny,
            depth,
            type,
            t,
            hookPart,
            n: 0,
            jt: 0,
            mu: 1.05,
          });
        }
      }
    }
    sample(f.x, f.y, 10, "foot");
    for (let i = 0; i < hull.length; i++) {
      const p = hull[i];
      sample(
        b.x + c * p.x - sn * p.y,
        b.y + sn * p.x + c * p.y,
        p.r,
        "body",
        0,
        i > 1,
      );
    }
    const count = Math.ceil(Math.hypot(f.x - b.x, f.y - b.y) / 11);
    for (let i = 2; i < count; i++) {
      const t = i / count;
      sample(b.x + (f.x - b.x) * t, b.y + (f.y - b.y) * t, 3, "leg", t);
    }
    return result;
  }
  function jacobian(s, q, nx, ny) {
    if (q.type === "body") {
      const cross = (q.x - s.b.x) * ny - (q.y - s.b.y) * nx;
      return {
        b: 1,
        f: 0,
        a: cross,
        m: 1 / P.bodyMass + (cross * cross) / P.bodyI,
      };
    }
    if (q.type === "foot") return { b: 0, f: 1, a: 0, m: 1 / P.footMass };
    const b = 1 - q.t,
      f = q.t;
    return { b, f, a: 0, m: (b * b) / P.bodyMass + (f * f) / P.footMass };
  }
  const speed = (s, j, nx, ny) =>
    j.b * (s.b.vx * nx + s.b.vy * ny) +
    j.f * (s.f.vx * nx + s.f.vy * ny) +
    j.a * s.b.w;
  function impulse(s, j, nx, ny, v) {
    s.b.vx += (v * j.b * nx) / P.bodyMass;
    s.b.vy += (v * j.b * ny) / P.bodyMass;
    s.f.vx += (v * j.f * nx) / P.footMass;
    s.f.vy += (v * j.f * ny) / P.footMass;
    s.b.w += (v * j.a) / P.bodyI;
  }
  function resolve(s, world, dt) {
    const qs = contactList(s, world);
    s.contacts = qs.length;
    s.hookContacts = qs.filter((q) => q.hookPart).length;
    s.impact = 0;
    for (const q of qs) {
      q.jn = jacobian(s, q, q.nx, q.ny);
      q.jtangent = jacobian(s, q, -q.ny, q.nx);
      const vn = speed(s, q.jn, q.nx, q.ny);
      q.bounce = vn < -180 ? -vn * 0.06 : 0;
      s.impact = Math.max(s.impact, -vn);
    }
    for (let n = 0; n < 7; n++)
      for (const q of qs) {
        const old = q.n;
        q.n = Math.max(
          0,
          old + (q.bounce - speed(s, q.jn, q.nx, q.ny)) / q.jn.m,
        );
        impulse(s, q.jn, q.nx, q.ny, q.n - old);
        const ot = q.jt;
        q.jt = clamp(
          ot - speed(s, q.jtangent, -q.ny, q.nx) / q.jtangent.m,
          -q.mu * q.n,
          q.mu * q.n,
        );
        impulse(s, q.jtangent, -q.ny, q.nx, q.jt - ot);
      }
    // Small contact-only position repair; never used as locomotion or a grab.
    for (const q of qs) {
      const j = q.jn,
        v = Math.min(3, Math.max(0, q.depth - 0.15) * 0.22) / j.m;
      s.b.x += (v * j.b * q.nx) / P.bodyMass;
      s.b.y += (v * j.b * q.ny) / P.bodyMass;
      s.f.x += (v * j.f * q.nx) / P.footMass;
      s.f.y += (v * j.f * q.ny) / P.footMass;
      s.b.a += (v * j.a) / P.bodyI;
    }
  }
  function step(s, input = {}, world = { solids: [], pegs: [] }, dt = DT) {
    const b = s.b,
      f = s.f,
      r = s.rotor;
    const wanted = input.tuck ? P.tuck : input.kick ? P.extend : P.rest;
    s.rest += clamp(wanted - s.rest, -660 * dt, 530 * dt);
    const dx = f.x - b.x,
      dy = f.y - b.y,
      len = Math.max(0.001, Math.hypot(dx, dy)),
      nx = dx / len,
      ny = dy / len;
    const dvx = f.vx - b.vx,
      dvy = f.vy - b.vy,
      vr = dvx * nx + dvy * ny,
      va = (nx * dvy - ny * dvx) / len;
    const target = Number.isFinite(input.aim) ? input.aim : Math.atan2(dy, dx);
    const torque = clamp(
      P.aimK * wrap(target - Math.atan2(dy, dx)) - P.aimD * va,
      -P.aimMax,
      P.aimMax,
    );
    const radial = clamp(
      P.springK * (s.rest - len) - P.springD * vr,
      -P.springMax,
      P.springMax,
    );
    const tangent = torque / Math.max(25, len),
      fx = radial * nx - tangent * ny,
      fy = radial * ny + tangent * nx;
    const g = world.gravity === undefined ? P.gravity : world.gravity;
    b.vx -= (fx / P.bodyMass) * dt;
    b.vy += (g - fy / P.bodyMass) * dt;
    f.vx += (fx / P.footMass) * dt;
    f.vy += (g + fy / P.footMass) * dt;
    // Equal/opposite orbital and chassis angular impulses, including short legs.
    b.w -= ((dx * fy - dy * fx) / P.bodyI) * dt;
    const rel = r.w - b.w,
      invI = 1 / P.rotorI + 1 / P.bodyI;
    // Rate control makes holding a direction predictable; it still only applies
    // equal/opposite motor torque. Releasing coasts, not an angular-velocity reset.
    const command = clamp(input.gyro || 0, -1, 1);
    let motor = 0;
    if (input.brake) motor = clamp(-rel * P.brake, -P.gyroTorque, P.gyroTorque);
    else if (command)
      motor = clamp(
        (b.w - command * P.turnRate) * P.bodyI * P.turnGain,
        -P.gyroTorque,
        P.gyroTorque,
      );
    // Saturation constrains the motor's impulse, NEVER clamps either body's speed.
    if (motor > 0)
      motor = Math.min(motor, Math.max(0, (P.rotorLimit - rel) / (invI * dt)));
    if (motor < 0)
      motor = Math.max(motor, Math.min(0, (-P.rotorLimit - rel) / (invI * dt)));
    r.w += (motor / P.rotorI) * dt;
    b.w -= (motor / P.bodyI) * dt;
    // External air torque: -I * density * (linear*w + quadratic*w*abs(w)).
    // Exact drag-only integration cannot reverse spin or overshoot at high speed.
    // The enclosed rotor is untouched; air carries away the lost angular momentum.
    const density =
      world.airDensity === undefined ? 1 : Math.max(0, world.airDensity);
    const decay = Math.exp(-P.airLinear * density * dt);
    b.w =
      (b.w * decay) /
      (1 + (P.airQuadratic / P.airLinear) * Math.abs(b.w) * (1 - decay));
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    b.a = wrap(b.a + b.w * dt);
    r.a = wrap(r.a + r.w * dt);
    if (world.solids.length || (world.pegs || []).length) resolve(s, world, dt);
    else {
      s.contacts = 0;
      s.hookContacts = 0;
      s.impact = 0;
    }
    s.time += dt;
    return s;
  }
  function momentum(s) {
    const { b, f, rotor: r } = s;
    return {
      x: P.bodyMass * b.vx + P.footMass * f.vx,
      y: P.bodyMass * b.vy + P.footMass * f.vy,
      angular:
        P.bodyMass * (b.x * b.vy - b.y * b.vx) +
        P.footMass * (f.x * f.vy - f.y * f.vx) +
        P.bodyI * b.w +
        P.rotorI * r.w,
    };
  }
  function com(s) {
    return {
      x: (P.bodyMass * s.b.x + P.footMass * s.f.x) / (P.bodyMass + P.footMass),
      y: (P.bodyMass * s.b.y + P.footMass * s.f.y) / (P.bodyMass + P.footMass),
      vx:
        (P.bodyMass * s.b.vx + P.footMass * s.f.vx) / (P.bodyMass + P.footMass),
      vy:
        (P.bodyMass * s.b.vy + P.footMass * s.f.vy) / (P.bodyMass + P.footMass),
    };
  }
  function reserve(s) {
    const rel = s.rotor.w - s.b.w;
    return {
      a: clamp(1 - rel / P.rotorLimit, 0, 1),
      d: clamp(1 + rel / P.rotorLimit, 0, 1),
      rel,
    };
  }
  return {
    P,
    DT,
    hook,
    hull,
    clamp,
    wrap,
    create,
    box,
    polygon,
    step,
    com,
    momentum,
    reserve,
    circlePoly,
    contactList,
  };
})();
