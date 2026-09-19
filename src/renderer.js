import { physics as F } from "./physics.js";
export function createRenderer(canvas, wheel) {
  const ctx = canvas.getContext("2d"),
    wg = wheel.getContext("2d");
  let state,
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
    ghostPose;
  function path(points, close = false) {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    if (close) ctx.closePath();
  }
  function circle(g, x, y, r, fill, stroke, width = 1) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = width;
      g.stroke();
    }
  }
  function rotor(g, x, y, r, angle, alpha = 1) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.globalAlpha *= alpha;
    circle(g, 0, 0, r, "#1c3540", "#a5beb9", 1.7);
    const sectors = [
      [-Math.PI / 2, 0.4, "#91dfc3"],
      [0.4, 2.9, "#edb76d"],
      [2.9, Math.PI * 1.5, "#517d8f"],
    ];
    for (const [a, b, c] of sectors) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, r - 3, a, b);
      g.closePath();
      g.fillStyle = c;
      g.fill();
    }
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -r + 2);
    g.strokeStyle = "#f5f7dc";
    g.lineWidth = 3;
    g.stroke();
    circle(g, 0, 0, r * 0.29, "#15303a", "#d6e1ce", 1.5);
    g.restore();
  }
  function drawMachine(s, alpha = 1, isGhost = false) {
    const b = s.b,
      f = s.f;
    ctx.save();
    ctx.globalAlpha = alpha;
    const dx = f.x - b.x,
      dy = f.y - b.y,
      len = Math.hypot(dx, dy),
      a = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    ctx.lineCap = "round";
    ctx.strokeStyle = isGhost ? "#d8e8e8" : "#4c6269";
    ctx.lineWidth = 10;
    path([
      [0, 0],
      [len, 0],
    ]);
    ctx.stroke();
    ctx.strokeStyle = "#b3c8c3";
    ctx.lineWidth = 4;
    path([
      [len * 0.48, 0],
      [len - 5, 0],
    ]);
    ctx.stroke();
    ctx.strokeStyle = "#ffc979";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 26; i++) {
      const x = 18 + ((Math.max(24, len * 0.68) - 18) * i) / 26,
        y = i === 0 || i === 26 ? 0 : i % 2 ? -6 : 6;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    circle(ctx, f.x, f.y, 10, isGhost ? "#aacbc0" : "#ffc979", "#243a42", 2.5);
    circle(ctx, f.x, f.y, 3, "#51666b");
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    circle(ctx, 2, 16, 12, "#526a6c", "#b3c5b9", 2);
    path(F.hook);
    ctx.strokeStyle = "#223640";
    ctx.lineWidth = 18;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = isGhost ? "#b7e4d2" : "#b5c4b5";
    ctx.lineWidth = 12;
    ctx.stroke();
    path(F.hook.slice(-3));
    ctx.strokeStyle = "#ffc979";
    ctx.lineWidth = 10;
    ctx.stroke();
    circle(ctx, 0, 0, 22, "#263f49", "#b5c4b5", 2);
    circle(ctx, 2, 20, 3, "#22333e");
    ctx.restore();
    rotor(ctx, b.x, b.y, 18, s.rotor.a);
    if (!isGhost) {
      const r = F.reserve(s);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#ffc979";
      ctx.beginPath();
      ctx.arc(
        b.x,
        b.y,
        24,
        Math.PI * 0.56,
        Math.PI * 0.56 + Math.PI * 0.78 * r.a,
      );
      ctx.stroke();
      ctx.strokeStyle = "#8de0c3";
      ctx.beginPath();
      ctx.arc(
        b.x,
        b.y,
        24,
        -Math.PI * 0.44,
        -Math.PI * 0.44 + Math.PI * 0.78 * r.d,
      );
      ctx.stroke();
    }
    ctx.restore();
  }
  function background() {
    ctx.fillStyle = "#101f29";
    ctx.fillRect(0, 0, W, H);
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = -30; x <= W + 30; x += 24) {
        const wx = x + view.x * (0.04 + layer * 0.035);
        const y =
          H * (0.42 + layer * 0.14) +
          Math.sin(wx * 0.004 + layer) * 45 +
          Math.sin(wx * 0.009 - layer) * 20;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = ["#162a34", "#1c343d", "#203c43"][layer];
      ctx.fill();
    }
    ctx.strokeStyle = "#87b8af0b";
    ctx.lineWidth = 1;
    const spacing = 80 * view.scale,
      offset = (-view.x * view.scale) % spacing;
    for (let x = offset; x < W; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 155);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  }
  function drawTerrain() {
    for (const p of level.solids) {
      if (p.maxX < view.x - 100 || p.minX > view.x + W / view.scale + 100)
        continue;
      path(p.points, true);
      ctx.fillStyle =
        p.kind === "brass"
          ? "#b49663"
          : p.kind === "beam"
            ? "#52635f"
            : "#516463";
      ctx.fill();
      ctx.strokeStyle = "#263f46";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "#223c422c";
      ctx.lineWidth = 1;
      for (let x = Math.floor(p.minX / 56) * 56; x < p.maxX; x += 56) {
        path([
          [x, p.minY + 14],
          [x - 180, Math.min(p.maxY, p.minY + 370)],
        ]);
        ctx.stroke();
      }
      ctx.restore();
      for (let i = 0; i < p.points.length; i++) {
        const a = p.points[i],
          b = p.points[(i + 1) % p.points.length];
        if (b[0] > a[0] && Math.abs(b[1] - a[1]) < b[0] - a[0]) {
          path([a, b]);
          ctx.strokeStyle =
            p.kind === "brass"
              ? "#f2c47b"
              : p.kind === "beam"
                ? "#b5c4ad"
                : "#a6c4a4";
          ctx.lineWidth = 5;
          ctx.stroke();
        }
      }
    }
    for (const p of level.pegs) {
      if (p.wall === undefined)
        circle(ctx, p.x, p.y, 18, "#2b4850", "#466269", 1.5);
      circle(ctx, p.x, p.y, p.r, "#f2c47b", "#343f3f", 2);
      circle(ctx, p.x, p.y, 2, "#7a6749");
    }
  }
  function flag(p, n, lit) {
    ctx.strokeStyle = lit ? "#9cf0c6" : "#92aaa1";
    ctx.lineWidth = 3;
    path([
      [p.x, p.y],
      [p.x, p.y - 61],
    ]);
    ctx.stroke();
    path(
      [
        [p.x, p.y - 61],
        [p.x + 30, p.y - 52],
        [p.x, p.y - 41],
      ],
      true,
    );
    ctx.fillStyle = lit ? "#8de0c3" : "#647f7b";
    ctx.fill();
    ctx.font = "11px ui-monospace,monospace";
    ctx.fillStyle = lit ? "#ccf2da" : "#9db2a9";
    ctx.textAlign = "center";
    ctx.fillText(String(n), p.x + 10, p.y - 69);
    ctx.textAlign = "left";
  }
  function drawGoal() {
    if (!level.goal) return;
    const p = level.goal;
    ctx.save();
    ctx.strokeStyle = "#dfdab5";
    ctx.lineWidth = 5;
    path([
      [p.x - 34, p.y],
      [p.x - 34, p.y - 132],
      [p.x + 34, p.y - 132],
      [p.x + 34, p.y],
    ]);
    ctx.stroke();
    for (let j = 0; j < 8; j++) {
      ctx.fillStyle = j % 2 ? "#526c67" : "#e1ddb5";
      ctx.fillRect(p.x - 32 + j * 8, p.y - 139, 8, 13);
    }
    ctx.font = "10px ui-monospace,monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#e3d5a7";
    ctx.fillText("HOME", p.x, p.y - 153);
    ctx.restore();
  }
  function drawGhost() {
    if (ghostPose) drawMachine(ghostPose, 0.28, true);
  }
  function render(frame) {
    ({
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
      ghostPose,
    } = frame);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    background();
    ctx.save();
    ctx.scale(view.scale, view.scale);
    ctx.translate(-view.x, -view.y);
    drawTerrain();
    level.checks.forEach((p, i) => flag(p, i + 1, i <= checkpoint));
    drawGoal();
    if (showArc && !overview) {
      const c = F.com(state);
      for (let t = 0; t < 1.5; t += 0.075)
        circle(
          ctx,
          c.x + c.vx * t,
          c.y + c.vy * t + 0.5 * F.P.gravity * t * t,
          2.2,
          "#e8d4a281",
        );
      circle(ctx, c.x, c.y, 4, null, "#f4e0a9", 1);
    }
    drawGhost();
    drawMachine(state);
    if (!overview && !finished) {
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = "#cbe6cf60";
      const b = state.b;
      path([
        [b.x + Math.cos(aim) * 28, b.y + Math.sin(aim) * 28],
        [b.x + Math.cos(aim) * 195, b.y + Math.sin(aim) * 195],
      ]);
      ctx.stroke();
      ctx.restore();
      circle(
        ctx,
        state.b.x + Math.cos(aim) * 195,
        state.b.y + Math.sin(aim) * 195,
        4,
        null,
        "#bfd9c180",
        1,
      );
    }
    ctx.restore();
    if (overview) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#dbebdb";
      ctx.font = "12px system-ui";
      ctx.fillText("OVERVIEW · PAUSED · V OR CLICK TO RETURN", W / 2, H - 135);
      ctx.textAlign = "left";
    }
    const r = F.reserve(state);
    wg.setTransform(2, 0, 0, 2, 0, 0);
    wg.clearRect(0, 0, 64, 64);
    rotor(wg, 32, 32, 25, state.rotor.a);
    wg.lineWidth = 3;
    for (const [a, value, c] of [
      [Math.PI * 0.55, r.a, "#ffc979"],
      [-Math.PI * 0.45, r.d, "#8de0c3"],
    ]) {
      wg.strokeStyle = "#334b53";
      wg.beginPath();
      wg.arc(32, 32, 30, a, a + Math.PI * 0.8);
      wg.stroke();
      wg.strokeStyle = c;
      wg.beginPath();
      wg.arc(32, 32, 30, a, a + Math.PI * 0.8 * value);
      wg.stroke();
    }
  }

  return { render };
}
