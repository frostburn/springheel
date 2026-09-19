import test from "node:test";
import assert from "node:assert/strict";
import { courses, timedCourses, practiceIndex } from "../src/courses.js";
import { checkpointSpawn, nextCourseIndex } from "../src/course.js";
import { physics as F } from "../src/physics.js";
test("twelve challenges and one yard have unique, stable identities", () => {
  assert.equal(timedCourses.length, 12);
  assert.equal(courses.length, 13);
  assert.equal(new Set(courses.map((c) => c.id)).size, courses.length);
  assert.equal(courses[7].id, "practice-yard");
  assert.equal(nextCourseIndex(courses, 6), 8);
  assert.equal(nextCourseIndex(courses, 12), practiceIndex);
});
for (const course of courses)
  test(`${course.name}: starts and checkpoint spawns are clear and supported`, () => {
    for (let index = -1; index < course.checks.length; index++) {
      const start = checkpointSpawn(course, index),
        s = F.create(...start);
      assert.equal(
        F.contactList(s, course).length,
        0,
        `spawn ${index} overlaps terrain`,
      );
      for (let n = 0; n < 480; n++) F.step(s, { aim: Math.PI / 2 }, course);
      assert.ok(
        Math.abs(s.b.x - start[0]) < 10 && Math.abs(s.b.y - start[1]) < 15,
        `spawn ${index} is not supported`,
      );
    }
    for (const solid of course.solids) {
      assert.ok(solid.points.length >= 3);
      assert.ok(solid.points.flat().every(Number.isFinite));
      let twiceArea = 0;
      for (let i = 0; i < solid.points.length; i++) {
        const a = solid.points[i],
          b = solid.points[(i + 1) % solid.points.length];
        twiceArea += a[0] * b[1] - b[0] * a[1];
      }
      assert.ok(
        twiceArea > 0,
        "terrain winding must be clockwise in screen coordinates",
      );
    }
  });
