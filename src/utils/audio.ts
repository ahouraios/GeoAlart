/**
 * Audio Chime Synthesizer using Web Audio API
 * Generates crystal-clear melodious chimes without external audio assets
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Restore mute preference from localStorage
    const saved = localStorage.getItem('geofence_sound_muted');
    if (saved !== null) {
      this.isMuted = saved === 'true';
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('geofence_sound_muted', String(muted));
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Proximity Alert Chime:
   * Smooth, modern melodic ascending arpeggio (C5 -> E5 -> G5 -> C6)
   */
  public playProximityChime() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Smooth attack & warm marimba/bell release
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.46);
    });
  }

  /**
   * Final Arrival Chime:
   * Triumphant golden harmony fanfare (C5, G5, E6, C6)
   */
  public playArrivalChime() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const chords = [
      { freq: 523.25, time: 0, dur: 0.8 },
      { freq: 659.25, time: 0.1, dur: 0.8 },
      { freq: 783.99, time: 0.2, dur: 0.9 },
      { freq: 1046.5, time: 0.3, dur: 1.2 },
      { freq: 1318.51, time: 0.35, dur: 1.4 },
    ];

    const now = ctx.currentTime;

    chords.forEach(({ freq, time, dur }) => {
      const startTime = now + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.32, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + dur + 0.05);
    });
  }

  /**
   * Gentle UI click feedback
   */
  public playTapBeep() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  }
}

export const soundEngine = new SoundEngine();
