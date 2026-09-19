# Springheel

A little leverage: a browser physics game about a spring leg, a reaction-wheel gyro, and a hook-shaped chassis. Twelve courses and a free-practice yard. No lives, damage, or runtime downloads.

Open **`index.html`** in a browser. It is the complete offline release: no installation or build is needed to play. Alternatively, serve the repository with `python3 -m http.server 8000`. The game makes no network requests. Sound starts muted.

## Develop

Use Node 20 or later. The readable ES modules, HTML, and CSS live in `src/`; `index.html` is generated and committed for downloads and static hosting.

```sh
npm ci
npm run dev       # source at http://127.0.0.1:8000; reload after editing
npm run format    # consistent formatting
npm run build     # regenerate the standalone index.html
npm run check     # formatting, release freshness, and regression suite
```

Only the development tools (esbuild and Prettier) are dependencies; neither ships as a runtime dependency. The lockfile pins installs. CI runs on Node 24, matching the development runtime. See [CONTRIBUTING.md](CONTRIBUTING.md) for the code map and [course authoring](docs/course-authoring.md) for adding terrain safely.

## License

Springheel is released under the [MIT License](LICENSE). The standalone HTML includes the license notice.

## Courses

The original seven courses retain their layouts and saved-record identities. Version 2.1 adds five short challenges before the practice yard:

| Course                 | Main challenge                                                      |
| ---------------------- | ------------------------------------------------------------------- |
| 08 · Tidal steps       | Descend to the quay, control the landing, then climb out            |
| 09 · The sawtooth mile | Alternate ramps, shelves, and small drops                           |
| 10 · Low clearance     | Time the spring around two low lintels                              |
| 11 · Brass orchard     | Hop between plinths with optional brass catches and recovery floors |
| 12 · Last light        | Link a ramp, a roof, and rising terraces                            |

Every course is available immediately in the selector. Finishing course seven now continues into the expansion; finishing course twelve offers the yard.

## Controls

| Input         | Action                                                                       |
| ------------- | ---------------------------------------------------------------------------- |
| Mouse pointer | Aim the leg in world space, independently of the chassis                     |
| Left mouse    | Extend the spring's resting length / kick                                    |
| Right mouse   | Retract / crouch; takes priority over left mouse                             |
| A / D         | Request counterclockwise / clockwise chassis rotation through the gyro motor |
| S             | Brake the flywheel relative to the chassis; the chassis takes the reaction   |
| R             | Retry the latest checkpoint, keeping the elapsed time                        |
| Shift+R       | Restart the course and clock                                                 |
| V             | Paused course overview                                                       |
| P / Escape    | Pause / resume                                                               |
| I             | Toggle the free-flight centre-of-mass guide                                  |
| G             | Toggle the personal-best ghost                                               |
| H             | Field guide, including a hanging-start practice button                       |
| M             | Toggle synthesized sound                                                     |

On touch screens, drag on the playfield to aim and use the bottom buttons to turn, brake, tuck, and kick. Pointer cancellation, focus loss, and opening the guide clear held inputs. Losing focus also pauses the simulation.

**Chasing a record:** click **Restart** in the header or press **Shift+R** for a fresh course, clock, and recording while keeping your saved best and ghost. **Retry / R** still returns to the checkpoint with the clock running.

**First hop:** point below and a little behind the axle. Let the foot plant, then extend. Release to reset the stroke. A crouch followed by extension gives a bigger hop. Point at the ground to push away from, not at the destination.

**Hook practice:** open the field guide and choose the hanging start. The machine starts threaded onto a brass rail. Hold A to peel out. The hook can also catch protruding brass ledges during ordinary motion; there is no grab button, attraction, snap-to-anchor, or hidden attachment joint.

## What the instruments mean

The flywheel has three unequal coloured sectors and a white index spoke. It rotates independently of the chassis. The A/D rim arcs and bars show remaining **directional speed headroom**, not an invented energy battery. One direction can run out while the other remains available. Reverse the motor or brake to exchange momentum; there is no free in-flight recharge.

A/D use a bounded motor-torque controller that requests a turn rate. They do not overwrite angular velocity. Releasing a key coasts against chassis air resistance: fast spins fade more strongly than slow turns. Contact loads, leg reactions, air drag, and rotor saturation can prevent the requested rate from being reached. The enclosed flywheel is not air-braked.

The leg label reports rest / extend / tuck. The leg motor is not coupled to a stamina meter. The optional dotted trajectory is for the combined centre of mass under gravity alone; it ignores future collisions and is not a foot-placement prediction.

## Less punishment, still physics

Pennants save checkpoints. Low catch floors offer another chance. R restores a checkpoint without a death animation or lost life; retries keep the run clock going. Best times and sampled ghosts are stored locally when browser storage is available. Storage failures are nonfatal and leave the current session playable. Ghost recordings are capped at 9,000 samples, approximately ten minutes at 15 Hz (retry boundaries add samples).

Ghosts interpolate body position, foot position, and rotation at display time. New recordings accumulate full turns between samples so the fast flywheel keeps spinning in the correct direction. Retries create explicit cuts instead of sliding across the course. Older ghosts also interpolate, using shortest-angle rotation and a conservative jump detector; their original samples do not contain full-turn or retry metadata. See [the replay format](docs/replays.md).

Records use stable course IDs. Existing numeric-slot records migrate in memory and are saved in the new format on the next personal best; the original save is left intact. Saves remain local to the browser and origin. Downloaded copies may have separate storage depending on browser behavior.

## Physics and implementation

Source modules separate the solver, course data, canvas rendering, sound, ghost recording/playback, and persistence. The build embeds everything into `index.html`. Tests import the source modules directly and compare the bundled solver against the source solver.

- A fixed 1/240-second step integrates a rigid chassis, a massive foot, and an independent rotor. The chassis centre of mass is the central axle; its lower counterweight represents the balancing mass. Inertias and lengths use game-scale units, not a scale drawing of a manufactured mechanism.
- The massless telescopic strut has an actuated, damped radial spring. A bounded angular servo aims the foot. Both apply equal/opposite forces; the chassis also receives the opposite orbital torque from aiming. Radial extension at the centre produces no direct chassis torque.
- The gyro exchanges equal/opposite angular impulses with the chassis. Motor impulses are limited near the relative wheel-speed limit; no body velocity or momentum is silently clipped. Contact or aiming can back-drive the rotor beyond the motor's nominal speed limit.
- Rounded chassis samples, the foot, and the rod collide with static solid terrain and brass rails. Sequential contact impulses supply normal forces and friction. A small contact-only penetration repair addresses numerical overlap. This is a discrete game solver, not an exact analytic contact solution.
- Rotational air resistance applies an external torque to the exposed chassis: `-bodyI * airDensity * (0.9*w + 0.25*w*abs(w))`. Its drag-only step is integrated analytically, so it cannot reverse spin or overshoot. There is no translational drag or arbitrary air steering: the combined centre of mass remains ballistic. The air carries away angular momentum; internal motors still exchange equal/opposite impulses. Set `world.airDensity = 0` for vacuum conservation tests (default is 1). The internal rotor retains its momentum unless acted on by its motor/brake. Springs, servos, brakes, drag, and contacts may dissipate energy; powered motors supply work.

The render loop limits catch-up work after slow frames instead of applying one large unstable time step. The scene and sound have no external dependencies. Native buttons, a course selector, a modal field guide, and a responsive HUD surround the canvas.

## Tests

Run `npm ci` once, then `npm run check`. `npm test` runs the suite without rebuilding, so run `npm run build` after source edits.

The suite covers vacuum conservation; ballistic centre-of-mass motion; rotor saturation and air drag; hopping, catches, ledge support and release; scripted completion of courses 1, 3, 5, 7 and all five new courses; safe starts/checkpoints across all terrain; replay timing, rotation and reset cuts; storage migration and failures; deterministic offline builds; and full-app wiring with a minimal DOM/canvas stub. These deterministic runs are regression checks, not human records or an exhaustive playtest. The stub does not verify rendering, browser focus behavior, or native storage.

Opening the map preserves the underlying pause state and temporarily hides the pause card. Closing the map restores that state; pressing Pause while viewing the map always returns to a paused game.

For browser smoke testing, check hopping, gyro reserves, the hanging-start exercise, checkpoint retry, full restart, finish/next-course flow, pause, the map and modal, sound, pointer cancellation, touch controls, and a narrow viewport. Native local-storage persistence and cross-browser audio should also be checked on the eventual hosting origin.

## Workshop console

`springheel.inspect()` reports momentum, centre of mass, and gyro reserves. `springheel.load('practice-yard')` opens the yard; original numeric indices still work, including `load(7)`. `springheel.load('brass-orchard')` opens a new course. `springheel.hangingStart()` sets up the rail exercise. `springheel.snapshot()` and `springheel.setState(snapshot)` support reproducible physics investigations. `springheel.physics` exposes the solver and constants. These tools do not run unless called.
