/**
 * Synthesizes a subtle two-note Web Audio API chime when the active turn transitions
 * to the local player. Zero external audio file assets required.
 */
export function playTurnNotificationChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Two pleasant marimba/bell-like sine tones (E5 -> B5)
    const frequencies = [659.25, 987.77];

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.36);
    });
  } catch {
    // Ignore autoplay-policy blocks before first user gesture
  }
}

