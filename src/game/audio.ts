/**
 * Procedural Web Audio API sound synthesizer for Slide Down
 * Zero external audio files, 100% synthesized in code.
 */

class SoundSystem {
  private ctx: AudioContext | null = null;
  private soundEnabled = true;
  private musicEnabled = true;
  private rollingOsc: OscillatorNode | null = null;
  private rollingGain: GainNode | null = null;
  private musicInterval: number | null = null;
  private initialized = false;

  public init() {
    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;

      // Initialize continuous rolling sound
      this.setupRollingSound();
    } catch {
      // Audio not supported in environment
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (!enabled && this.rollingGain) {
      this.rollingGain.gain.value = 0;
    }
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }

  private setupRollingSound() {
    if (!this.ctx) return;
    try {
      this.rollingOsc = this.ctx.createOscillator();
      this.rollingOsc.type = 'triangle';
      this.rollingOsc.frequency.setValueAtTime(60, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, this.ctx.currentTime);

      this.rollingGain = this.ctx.createGain();
      this.rollingGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.rollingOsc.connect(filter);
      filter.connect(this.rollingGain);
      this.rollingGain.connect(this.ctx.destination);

      this.rollingOsc.start();
    } catch {
      // ignore
    }
  }

  public updateRollingSound(speed: number, grounded: boolean, alive: boolean) {
    if (!this.ctx || !this.rollingOsc || !this.rollingGain || !this.soundEnabled || !alive) {
      if (this.rollingGain) this.rollingGain.gain.value = 0;
      return;
    }

    if (!grounded) {
      // In air - fade out rolling rumble
      this.rollingGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      return;
    }

    // Pitch & volume scale with speed
    const pitch = 50 + speed * 2.8;
    const vol = Math.min(0.16, (speed / 40) * 0.12);

    this.rollingOsc.frequency.setTargetAtTime(pitch, this.ctx.currentTime, 0.05);
    this.rollingGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  public playBoost() {
    if (!this.ctx || !this.soundEnabled) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {}
  }

  public playJump() {
    if (!this.ctx || !this.soundEnabled) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.3);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch {}
  }

  public playCrash() {
    if (!this.ctx || !this.soundEnabled) return;
    this.init();
    try {
      const now = this.ctx.currentTime;

      // Sub-bass hit
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);

      // Noise burst for shatter
      const bufferSize = this.ctx.sampleRate * 0.3;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.3);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
    } catch {}
  }

  public playFall() {
    if (!this.ctx || !this.soundEnabled) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.8);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.9);
    } catch {}
  }

  public playClick() {
    if (!this.ctx || !this.soundEnabled) return;
    this.init();
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {}
  }

  public startMusic() {
    if (!this.musicEnabled || this.musicInterval !== null || !this.ctx) return;
    this.init();

    // Procedural cyber bass & synth arpeggio in D Dorian (D, F, G, A, C)
    const notes = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23];
    let step = 0;

    this.musicInterval = window.setInterval(() => {
      if (!this.ctx || !this.musicEnabled) return;
      try {
        const now = this.ctx.currentTime;
        const note = notes[step % notes.length];
        step++;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = step % 4 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(note, now);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);

        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
      } catch {}
    }, 180); // ~133 BPM 16th notes
  }

  public stopMusic() {
    if (this.musicInterval !== null) {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  public stopAll() {
    if (this.rollingGain) this.rollingGain.gain.value = 0;
    this.stopMusic();
  }
}

export const audioManager = new SoundSystem();
