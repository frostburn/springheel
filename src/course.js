import { physics } from "./physics.js";

/** Coordinates use +y downward. Checkpoints/goals sit on the walking surface. */
export function defineCourse({
  id,
  name,
  hint,
  start,
  solids,
  checks = [],
  goal = null,
  pegs = [],
  width,
  top = -100,
  bottom = 980,
  ...metadata
}) {
  return {
    ...metadata,
    id,
    name,
    hint,
    start,
    top,
    bottom,
    width: width ?? (goal ? goal[0] + 230 : 2200),
    solids: [
      ...solids,
      ...pegs
        .filter((p) => p.wall !== undefined)
        .map((p) => physics.box(p.x, p.y - 4, p.wall - p.x + 12, 8, "brass")),
    ],
    checks: checks.map(([x, y]) => ({ x, y })),
    goal: goal ? { x: goal[0], y: goal[1] } : null,
    pegs,
  };
}

export function nextCourseIndex(courses, index) {
  for (let i = index + 1; i < courses.length; i++)
    if (courses[i].goal) return i;
  return courses.findIndex((c) => !c.goal);
}

export function checkpointSpawn(level, index) {
  const checkpoint = level.checks[index];
  return checkpoint ? [checkpoint.x, checkpoint.y - 106] : level.start;
}
