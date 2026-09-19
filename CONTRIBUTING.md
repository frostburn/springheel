# Working on Springheel

Keep the spring, the physical hook, and the Newtonian reactions. Small courses, generous checkpoints, and instant retries keep experimentation affordable. Treat the standalone HTML as a release artifact; edit `src/` and rebuild it.

## Code map

| File                               | Responsibility                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `src/main.js`                      | DOM events, run lifecycle, fixed-step scheduling, camera, HUD, console tools        |
| `src/physics.js`                   | Pure state creation and stepping, collision geometry, contacts, momentum inspection |
| `src/courses.js`                   | Original terrain, stable IDs, legacy slots, course catalog                          |
| `src/expansion.js`                 | Five additional courses as named data objects                                       |
| `src/course.js`                    | Course normalization, progression and checkpoint spawn coordinates                  |
| `src/renderer.js`                  | Canvas artwork; consumes a frame description without changing simulation state      |
| `src/replay.js`                    | Validated, versioned ghost data, recording and interpolation                        |
| `src/records.js`                   | Injected storage, old-save migration, best-time comparison                          |
| `src/audio.js`                     | Optional synthesized sound with lazy audio-context creation                         |
| `src/index.html`, `src/styles.css` | Accessible HTML controls and responsive layout                                      |
| `scripts/`                         | Source server and standalone release build                                          |
| `tests/`                           | Node test runner; physics, courses, replay, records, app wiring and build           |

## Change workflow

1. Install with `npm ci`; use `npm run dev` to serve the source modules.
2. Make a focused change. Cover new state transitions or physical behavior with an appropriate regression check.
3. Run `npm run format`, `npm run build`, and `npm run check`.
4. Check the actual browser on desktop and a narrow viewport. Test the changed control or course; inspect the console. A stubbed DOM passing does not constitute a browser test.
5. Commit source, relevant tests/docs, lockfile changes, and the rebuilt `index.html` together.

There is no production package install. Build output must have no external runtime asset references, fetches, imports or remote fonts. `build:check` rejects stale artifacts; the build embeds source-module comments to keep the downloaded HTML inspectable.

Use `src/version.js` and `package.json` together for releases; the build test catches a mismatch. Update the package lock with `npm install --package-lock-only`. No automatic release/deployment is configured.

## Physics boundaries

- Internal actuators exchange momentum; keep equal/opposite reactions.
- Chassis drag is an explicit external torque. Use `airDensity: 0` and `gravity: 0` for closed-system momentum tests.
- Keep the 1/240-second solver step separate from render cadence. Clamp catch-up time instead of taking one large step.
- No hidden grab joint, teleporting foot, arbitrary air thrust, or angular-velocity clamp.
- Rendering and replay interpolation must never feed interpolated poses back into live physics.

## Manual smoke checks

Open the generated `index.html` directly as well as the source server. Verify a hop, a gyro turn, hanging-start release, sound on/off, checkpoint retry, full restart, a course finish and next-course transition, map from both running and paused states, guide closure, loss of focus, and touch press/release/cancel. Set a personal best, retry the course, and watch the ghost through a landing and a checkpoint reset. Check persistence on the eventual hosting origin.

See [course authoring](docs/course-authoring.md) and [replays](docs/replays.md) for the data contracts.
