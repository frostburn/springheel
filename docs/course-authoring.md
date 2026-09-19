# Course authoring

New courses use `defineCourse` from `src/course.js`. Add data in `src/expansion.js`, or import another course pack from the catalog. The selector, count, and next-course button derive from the catalog. Keep the original eight numeric console slots in place; append new courses after them. The practice yard is displayed last in the selector and skipped during timed progression.

```js
defineCourse({
  id: "permanent-course-id",
  name: "A short climb",
  hint: "Point down and behind. Two shelves, two chances to settle.",
  start: [170, 474],
  solids: [box(-300, 580, 950, 440), box(650, 500, 600, 520)],
  checks: [[810, 500]],
  goal: [1080, 500],
});
```

`box` and `polygon` come from the physics module. Coordinates are pixels in simulation space, with positive y downward. Polygon winding is clockwise on the screen. Course geometry is static, shared data; do not mutate it in the render loop.

| Field           | Contract                                                                             |
| --------------- | ------------------------------------------------------------------------------------ |
| `id`            | Unique permanent save key; changing it starts a separate record table                |
| `start`         | Central axle x/y; normally 106 units above its platform                              |
| `checks`        | Ordered `[x, surfaceY]` pennants; retry spawns 106 units above each                  |
| `goal`          | `[x, surfaceY]`, or `null` for practice                                              |
| `solids`        | Solid polygons with broad-phase bounds from `box` or `polygon`                       |
| `pegs`          | Optional `{x,y,r}` circular contacts; `wall` adds a brass ledge to that x-coordinate |
| `top`, `bottom` | Overview upper bound and fall/retry boundary (defaults -100 and 980)                 |
| `width`         | Horizontal overview extent, normally goal x + 230                                    |

Leave room around starts and pennants for the whole hook and extended leg. Put them on level shelves, away from ceilings and platform edges. Use shallow recovery floors; an impossible wall after a missed hop negates their purpose. Add a checkpoint before asking for a new technique.

Keep the legacy-slot mapping in `courses.js` fixed: old numeric saves must always map to their original course. If terrain changes substantially enough to invalidate old times, choose a new ID and document the change.

`courses.test.js` checks each start/checkpoint for initial overlap and a stable resting position. `physics.test.js` contains ordinary-input completion runs; add a controller for the new route. Passing a scripted run proves one path exists, not that every recovery is pleasant. Finish with a human/browser playtest, including deliberately missed landings.
