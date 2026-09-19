import { physics as F } from "./physics.js";
import { defineCourse } from "./course.js";
import { expansion } from "./expansion.js";
const { box, polygon } = F;
function course(
  id,
  name,
  hint,
  start,
  solids,
  checks,
  goal,
  pegs = [],
  extra = {},
) {
  return defineCourse({
    id,
    name,
    hint,
    start,
    solids,
    checks,
    goal,
    pegs,
    width: goal ? goal[0] + 230 : 2200,
    top: -100,
    bottom: 980,
    ...extra,
  });
}
export const courses = [
  course(
    "first-spring",
    "First spring",
    "Point down and slightly left. Extend to hop right. The low steps will wait for you.",
    [180, 454],
    [
      box(-350, 560, 970, 450),
      box(620, 500, 370, 510),
      box(990, 435, 350, 575),
      box(1340, 370, 570, 640),
    ],
    [
      [790, 500],
      [1150, 435],
    ],
    [1660, 370],
  ),
  course(
    "room-to-land",
    "Room to land",
    "Wide landings. Small gaps. A lower path catches the hops that do not quite make it.",
    [150, 394],
    [
      box(-300, 500, 680, 520),
      box(530, 440, 330, 580),
      box(1020, 385, 350, 635),
      box(1530, 330, 490, 690),
      box(380, 710, 150, 310),
      box(860, 660, 160, 360),
      box(1370, 610, 160, 410),
    ],
    [
      [680, 440],
      [1190, 385],
    ],
    [1780, 330],
  ),
  course(
    "a-little-leverage",
    "A little leverage",
    "Tuck to reset your stroke. Low steps lead to a long, patient climb.",
    [170, 474],
    [
      box(-300, 580, 760, 440),
      polygon([
        [460, 580],
        [820, 430],
        [1010, 430],
        [1010, 1020],
        [460, 1020],
      ]),
      box(1010, 350, 360, 670),
      box(1370, 270, 370, 750),
      box(1740, 195, 500, 825),
    ],
    [
      [850, 430],
      [1510, 270],
    ],
    [2010, 195],
  ),
  course(
    "the-useful-end",
    "The useful end",
    "Turn the hook with A / D. The brass lip is solid: curl around it and let contact do the holding.",
    [170, 474],
    [
      box(-300, 580, 800, 440),
      box(500, 470, 290, 550),
      box(790, 345, 390, 675),
      box(1180, 250, 460, 770),
      box(1640, 160, 450, 860),
    ],
    [
      [640, 470],
      [1360, 250],
    ],
    [1870, 160],
    [
      { x: 725, y: 341, r: 8, wall: 790 },
      { x: 1115, y: 246, r: 8, wall: 1180 },
    ],
  ),
  course(
    "under-the-eaves",
    "Under the eaves",
    "A roof is something to push against. Keep the leg tucked when you swing the hook through.",
    [170, 474],
    [
      box(-300, 580, 890, 440),
      box(590, 505, 360, 515),
      box(950, 420, 420, 600),
      box(1370, 340, 680, 680),
      box(430, 195, 400, 42, "beam"),
      box(930, 80, 480, 42, "beam"),
    ],
    [
      [750, 505],
      [1190, 420],
    ],
    [1820, 340],
    [
      { x: 835, y: 215, r: 9 },
      { x: 1415, y: 100, r: 9 },
    ],
  ),
  course(
    "across-the-workshop",
    "Across the workshop",
    "The brass rails are optional handholds. Reverse the gyro before one direction runs out.",
    [170, 474],
    [
      box(-300, 580, 750, 440),
      box(450, 720, 170, 300),
      box(620, 485, 320, 535),
      box(940, 650, 170, 370),
      box(1110, 385, 370, 635),
      box(1480, 580, 170, 440),
      box(1650, 290, 550, 730),
    ],
    [
      [760, 485],
      [1280, 385],
    ],
    [1970, 290],
    [
      { x: 500, y: 335, r: 10 },
      { x: 995, y: 265, r: 10 },
      { x: 1540, y: 205, r: 10 },
    ],
  ),
  course(
    "home-before-dusk",
    "Home before dusk",
    "A little of everything. Take the next foothold, not the entire hillside.",
    [170, 474],
    [
      box(-300, 580, 760, 440),
      box(460, 500, 360, 520),
      box(820, 420, 330, 600),
      box(1150, 650, 140, 370),
      box(1290, 355, 440, 665),
      polygon([
        [1730, 355],
        [2050, 220],
        [2310, 220],
        [2310, 1020],
        [1730, 1020],
      ]),
      box(2310, 135, 450, 885),
      box(2760, 55, 470, 965),
    ],
    [
      [630, 500],
      [1480, 355],
      [2140, 220],
      [2510, 135],
    ],
    [2990, 55],
    [
      { x: 1225, y: 350, r: 9, wall: 1290 },
      { x: 2695, y: 49, r: 8, wall: 2760 },
    ],
    { width: 3260, top: -210 },
  ),
  course(
    "practice-yard",
    "Free-practice yard",
    "No finish line. Try the spring, the brass rail, and the hook. R always takes you home.",
    [210, 474],
    [
      box(-400, 580, 1100, 440),
      box(700, 500, 310, 520),
      box(1010, 390, 370, 630),
      box(1380, 265, 700, 755),
      box(230, 225, 280, 35, "beam"),
    ],
    [],
    null,
    [
      { x: 555, y: 275, r: 10 },
      { x: 635, y: 495, r: 8, wall: 700 },
      { x: 1315, y: 260, r: 8, wall: 1380 },
    ],
    { width: 2250 },
  ),
];
// Preserve original console indices and v1 score identities. New courses append.
const legacyIds = [
  "first-spring",
  "room-to-land",
  "a-little-leverage",
  "the-useful-end",
  "under-the-eaves",
  "across-the-workshop",
  "home-before-dusk",
  "practice-yard",
];
courses.forEach((course) => {
  course.legacyIndex = legacyIds.indexOf(course.id);
});
courses.push(...expansion);
export const timedCourses = courses.filter((course) => course.goal);
export const practiceIndex = courses.findIndex(
  (course) => course.id === "practice-yard",
);
