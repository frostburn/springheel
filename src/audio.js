export function createSoundPlayer(isMuted) {
  let audio = null;
  return function sound(type, strength = 1) {
    if (isMuted()) return;
    try {
      if (!audio)
        audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume().catch(() => {});
      const t = audio.currentTime,
        o = audio.createOscillator(),
        filter = audio.createBiquadFilter(),
        gain = audio.createGain();
      o.type = "triangle";
      const f =
        type === "check"
          ? 540
          : type === "finish"
            ? 660
            : type === "retry"
              ? 190
              : 100 + strength * 80;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(
        type === "land" ? 45 : f * 1.5,
        t + 0.14,
      );
      filter.type = "lowpass";
      filter.frequency.value = type === "land" ? 600 : 1200;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(
        0.08 * strength + 0.008,
        t + 0.008,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(filter);
      filter.connect(gain);
      gain.connect(audio.destination);
      o.start(t);
      o.stop(t + 0.3);
      o.onended = () => {
        o.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    } catch {}
  };
}
