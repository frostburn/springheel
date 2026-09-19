# Springheel

A little leverage: a single-file browser physics game about a spring leg, a reaction-wheel gyro, and a hook-shaped chassis. Seven courses and a free-practice yard. No lives, damage, external assets, libraries, installation, or build step.

Open **`index.html`** in a browser. Alternatively, serve this directory with `python3 -m http.server 8000` and open the local server. The game itself makes no network requests. Sound starts muted.

## Controls

| Input | Action |
| --- | --- |
| Mouse pointer | Aim the leg in world space, independently of the chassis |
| Left mouse | Extend the spring's resting length / kick |
| Right mouse | Retract / crouch; takes priority over left mouse |
| A / D | Request counterclockwise / clockwise chassis rotation through the gyro motor |
| S | Brake the flywheel relative to the chassis; the chassis takes the reaction |
| R | Retry the latest checkpoint, keeping the elapsed time |
| Shift+R | Restart the course and clock |
| V | Paused course overview |
| P / Escape | Pause / resume |
| I | Toggle the free-flight centre-of-mass guide |
| G | Toggle the personal-best ghost |
| H | Field guide, including a hanging-start practice button |
| M | Toggle synthesized sound |

On touch screens, drag on the playfield to aim and use the bottom buttons to turn, brake, tuck, and kick. Pointer cancellation, focus loss, and opening the guide clear held inputs. Losing focus also pauses the simulation.

**First hop:** point below and a little behind the axle. Let the foot plant, then extend. Release to reset the stroke. A crouch followed by extension gives a bigger hop. Point at the ground to push away from, not at the destination.

**Hook practice:** open the field guide and choose the hanging start. The machine starts threaded onto a brass rail. Hold A to peel out. The hook can also catch protruding brass ledges during ordinary motion; there is no grab button, attraction, snap-to-anchor, or hidden attachment joint.

## What the instruments mean

The flywheel has three unequal coloured sectors and a white index spoke. It rotates independently of the chassis. The A/D rim arcs and bars show remaining **directional speed headroom**, not an invented energy battery. One direction can run out while the other remains available. Reverse the motor or brake to exchange momentum; there is no free in-flight recharge.

A/D use a bounded motor-torque controller that requests a turn rate. They do not overwrite angular velocity. Releasing a key coasts. Contact loads, leg reactions, and rotor saturation can prevent the requested rate from being reached.

The leg label reports rest / extend / tuck. The leg motor is not coupled to a stamina meter. The optional dotted trajectory is for the combined centre of mass under gravity alone; it ignores future collisions and is not a foot-placement prediction.

## Less punishment, still physics

Pennants save checkpoints. Low catch floors offer another chance. R restores a checkpoint without a death animation or lost life; retries keep the run clock going. Best times and sampled ghosts are stored locally when browser storage is available. Storage failures are nonfatal and leave the current session playable. Ghost recordings are capped at 9,000 samples, approximately ten minutes at 15 Hz.

## Physics and implementation

All runtime code, styles, geometry, artwork, and sound are in `index.html`. The physics script is separate from the UI script within that file so the tests exercise exactly the shipped solver.

- A fixed 1/240-second step integrates a rigid chassis, a massive foot, and an independent rotor. The chassis centre of mass is the central axle; its lower counterweight represents the balancing mass. Inertias and lengths use game-scale units, not a scale drawing of a manufactured mechanism.
- The massless telescopic strut has an actuated, damped radial spring. A bounded angular servo aims the foot. Both apply equal/opposite forces; the chassis also receives the opposite orbital torque from aiming. Radial extension at the centre produces no direct chassis torque.
- The gyro exchanges equal/opposite angular impulses with the chassis. Motor impulses are limited near the relative wheel-speed limit; no body velocity or momentum is silently clipped. Contact or aiming can back-drive the rotor beyond the motor's nominal speed limit.
- Rounded chassis samples, the foot, and the rod collide with static solid terrain and brass rails. Sequential contact impulses supply normal forces and friction. A small contact-only penetration repair addresses numerical overlap. This is a discrete game solver, not an exact analytic contact solution.
- There is no arbitrary air steering or global linear/angular damping. In free flight, internal input preserves total linear and angular momentum; gravity moves the combined centre of mass ballistically. Springs, servos, brakes, and contacts may dissipate energy; powered motors supply work.

The render loop limits catch-up work after slow frames instead of applying one large unstable time step. The scene and sound have no external dependencies. Native buttons, a course selector, a modal field guide, and a responsive HUD surround the canvas.

## Tests

Run `npm test` (Node 20 or later; no `npm install` needed).

The 20 regression tests cover script parsing and offline packaging; free-flight conservation; ballistic centre-of-mass motion; rotor saturation, rate control, and braking; radial versus angular leg reactions; crouch priority; supported hopping; collision normals and rod geometry; long-run stability; a moving hook catch; rail and ledge support; physical release; and scripted completion of courses 1, 3, 5, and 7 using ordinary aim/stroke inputs. These deterministic runs are regression checks, not claimed human records or an exhaustive playtest of every route.

For browser smoke testing, check hopping, gyro reserves, the hanging-start exercise, checkpoint retry, full restart, finish/next-course flow, pause, the map and modal, sound, pointer cancellation, touch controls, and a narrow viewport. Native local-storage persistence and cross-browser audio should also be checked on the eventual hosting origin.

## Workshop console

`springheel.inspect()` reports momentum, centre of mass, and gyro reserves. `springheel.load(7)` opens the yard; `springheel.hangingStart()` sets up the rail exercise. `springheel.snapshot()` and `springheel.setState(snapshot)` support reproducible physics investigations. `springheel.physics` exposes the solver and constants. These tools do not run unless called.
