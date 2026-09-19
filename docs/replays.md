# Records and ghost playback

The simulation steps at 240 Hz. The recorder observes each step and stores approximately 15 poses per second. The renderer samples the saved ghost at the current run time plus the fractional render accumulator; it does not advance the simulation or modify the recording.

## Version 2

```js
{
  version: 2,
  frames: [
    // time, bodyX, bodyY, bodyAngle, footX, footY, rotorAngle, segment
    [0, 170, 474, 0, 170, 570, 0, 0],
  ],
}
```

Times are finite, nonnegative seconds in nondecreasing order. Positions use simulation coordinates. Body/rotor angles are unwrapped radians, accumulated from the 240 Hz poses: a rotor can advance more than half a turn between samples, which would be ambiguous in a wrapped-angle recording. Segment IDs are nondecreasing nonnegative integers.

Recording starts with a t=0 pose on the first active input and forces a final pose on completion. A retry records the old pose when finite, then a new segment at the same timestamp. Playback chooses the last equal-time frame, so the cut happens at exactly that time. It never interpolates across segments or gaps above 0.25 seconds. A binary search finds the surrounding samples; body/foot positions and continuous angles interpolate linearly. The last pose stays for 0.2 seconds and then disappears. Recordings stop at 9,000 frames; runs and best times continue normally.

## Legacy compatibility

Old ghosts are seven-element frame arrays with wrapped angles and no segment marker. They use shortest-angle interpolation. Movement above 120 units between samples is treated as a likely retry and held until the next sample. Original data cannot reconstruct multi-turn flywheel direction or every short reset; newly recorded ghosts resolve those ambiguities.

The old `springheel-hook-v1` key stores scores by original course index. `createRecords` maps them to permanent IDs. On the next personal best it writes `springheel-records-v2`, keyed by those IDs, and leaves the old key untouched. New data takes precedence. Legacy ghosts retain their legacy encoding when resaved alongside new records. Invalid ghost data is discarded without losing a valid best time; malformed times are ignored. Quota failures or blocked storage retain a usable in-memory record for the session.

Validation happens on loading/saving, not each animation frame. Keep it at that boundary when extending the schema. Bump the replay version when changing frame semantics.
