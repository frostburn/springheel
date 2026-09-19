import { normalizeReplay } from "./replay.js";

export const RECORDS_KEY = "springheel-records-v2";
export const LEGACY_KEY = "springheel-hook-v1";
function parse(value) {
  try {
    return JSON.parse(value) || {};
  } catch {
    return {};
  }
}
function record(value) {
  if (!value || !Number.isFinite(value.time) || value.time <= 0) return null;
  return { time: value.time, ghost: normalizeReplay(value.ghost) };
}

/** Storage is injected: blocked file:// storage remains a playable session. */
export function createRecords(storage, courses) {
  const bests = new Map();
  let data = {},
    legacy = {};
  try {
    data = parse(storage?.getItem(RECORDS_KEY));
    legacy = parse(storage?.getItem(LEGACY_KEY));
  } catch {}
  for (const course of courses) {
    const best =
      record(data[course.id]) ??
      (course.legacyIndex !== undefined
        ? record(legacy[course.legacyIndex])
        : null);
    if (best) bests.set(course.id, best);
  }
  return {
    best(id) {
      return bests.get(id) || null;
    },
    save(id, time, ghost) {
      const previous = bests.get(id);
      if (previous && previous.time <= time)
        return { isBest: false, persisted: true };
      const next = record({ time, ghost });
      if (!next) return { isBest: false, persisted: false };
      bests.set(id, next);
      try {
        if (!storage) throw new Error("No storage");
        // Legacy ghosts remain arrays on disk; v2 uses its explicit version tag.
        const entries = [...bests].map(([key, r]) => [
          key,
          { ...r, ghost: r.ghost?.version === 1 ? r.ghost.frames : r.ghost },
        ]);
        storage.setItem(
          RECORDS_KEY,
          JSON.stringify(Object.fromEntries(entries)),
        );
        return { isBest: true, persisted: true };
      } catch {
        return { isBest: true, persisted: false };
      }
    },
  };
}
